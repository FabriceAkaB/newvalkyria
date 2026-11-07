import { randomBytes } from "node:crypto";

import { CLUB_ID } from "@/lib/club";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { env } from "@/lib/env";
import { getLiveTasks, setTaskOwner, setTaskStatus, todayIso } from "@/lib/mandalart-repo";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { bucketOf, byDue, isJpOwner, isOpenTask, JP, reminderKind, type Bucket, type TeamTaskStatus } from "@/lib/team-tasks-core";

/** Espace JP : les tâches de JP et celles qu'il confie (table `team_tasks`). Une personne qui reçoit une tâche a un
 *  courriel avec son lien /tache/[token] ; elle dit « je m'en occupe » ou « c'est fait » sans compte. Une tâche du
 *  Mandalart confiée change de responsable dans le Mandalart et s'y coche quand elle est faite. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface TeamTask {
  id: string;
  title: string;
  details: string | null;
  mandalart_code: string | null;
  assignee: string;
  assignee_email: string | null;
  created_by: string;
  due: string | null;
  status: TeamTaskStatus;
  token: string | null;
  sent_at: string | null;
  seen_at: string | null;
  reminded_at: string | null;
  done_at: string | null;
  done_note: string | null;
  evidence_url: string | null;
  created_at: string;
}

export interface Assignee {
  name: string;
  email: string | null;
  role: string;
}

const COLS = "id, title, details, mandalart_code, assignee, assignee_email, created_by, due, status, token, sent_at, seen_at, reminded_at, done_at, done_note, evidence_url, created_at";
const norm = (r: any): TeamTask => ({ ...r, due: r.due ? String(r.due).slice(0, 10) : null });

/** Les personnes à qui JP peut confier une tâche : la direction (fiches de l'équipe) et les éducateurs actifs. */
export async function getAssignees(): Promise<Assignee[]> {
  const [{ data: staff }, { data: coaches }] = await Promise.all([
    db().from("staff_members").select("full_name, role, email, coach_id, active").eq("club_id", CLUB_ID).eq("active", true).order("sort_order"),
    db().from("coaches").select("first_name, last_name, email, status, role").order("first_name")
  ]);
  const out: Assignee[] = [];
  const seen = new Set<string>();
  const add = (name: string, email: string | null, role: string) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key) || /jean-paul aka|\(jp\)/i.test(name)) return;
    seen.add(key);
    out.push({ name, email, role });
  };
  for (const s of (staff ?? []) as any[]) add(String(s.full_name).trim(), s.email ?? null, s.role ?? "Équipe");
  for (const c of (coaches ?? []) as any[]) {
    if (c.status && !/actif|active/i.test(String(c.status))) continue;
    add(`${c.first_name ?? ""} ${c.last_name ?? ""}`.replace(/\s+/g, " ").trim(), c.email ?? null, "Éducateur");
  }
  return out;
}

export async function listTeamTasks(opts: { openOnly?: boolean } = {}): Promise<TeamTask[]> {
  let q = db().from("team_tasks").select(COLS).eq("club_id", CLUB_ID);
  if (opts.openOnly) q = q.in("status", ["a_faire", "en_cours"]);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return ((data ?? []) as any[]).map(norm);
}

export async function getTeamTaskByToken(token: string): Promise<TeamTask | null> {
  if (!/^[A-Za-z0-9_-]{12,40}$/.test(token)) return null;
  const { data } = await db().from("team_tasks").select(COLS).eq("token", token).maybeSingle();
  return data ? norm(data) : null;
}

export const taskUrl = (token: string) => `${env.publicSiteUrl}/tache/${token}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const frDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const firstName = (name: string) => name.split(/\s+/)[0];

async function sendMail(to: string, subject: string, html: string) {
  if (!isEmailConfigured()) return;
  await getResendClient().emails.send({ from: env.resendFrom, to, subject, html });
}

function taskEmail(t: TeamTask, intro: string): string {
  const url = taskUrl(t.token!);
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px">
  <p>Bonjour ${esc(firstName(t.assignee))},</p>
  <p>${intro}</p>
  <div style="background:#f4f0fb;border-radius:10px;padding:14px 16px;margin:14px 0">
    <p style="margin:0;font-weight:bold;font-size:16px">${esc(t.title)}</p>
    ${t.details ? `<p style="margin:8px 0 0;white-space:pre-wrap">${esc(t.details)}</p>` : ""}
    ${t.due ? `<p style="margin:8px 0 0;color:#5b2a86"><strong>Pour le ${esc(frDay(t.due))}</strong></p>` : ""}
  </div>
  <p><a href="${url}" style="display:inline-block;background:#5b2a86;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Voir la tâche et dire où j'en suis</a></p>
  <p style="font-size:13px;color:#666">Sur cette page, tu peux dire « je m'en occupe », puis « c'est fait » avec une note ou un lien. JP est avisé tout de suite.</p>
</div>`;
}

/** Ajoute une tâche à JP ou la confie à quelqu'un (courriel avec son lien). Une tâche du Mandalart déjà confiée est
 *  reprise à l'ancienne personne et donnée à la nouvelle. */
export async function createTeamTask(input: {
  title: string;
  details?: string | null;
  due?: string | null;
  assignee: string;
  assigneeEmail?: string | null;
  mandalartCode?: string | null;
  by?: string;
}): Promise<TeamTask> {
  const assignee = input.assignee.trim() || JP;
  const toJp = assignee === JP;
  let title = input.title.trim();
  let due = input.due ?? null;
  if (input.mandalartCode) {
    const mt = (await getLiveTasks()).find((t) => t.code === input.mandalartCode);
    if (!mt) throw new Error("Tâche du Mandalart introuvable");
    if (!title) title = mt.title;
    if (!due) due = mt.due;
    await db()
      .from("team_tasks")
      .update({ status: "abandonne", updated_at: new Date().toISOString() })
      .eq("club_id", CLUB_ID)
      .eq("mandalart_code", input.mandalartCode)
      .in("status", ["a_faire", "en_cours"]);
    await setTaskOwner(input.mandalartCode, toJp ? null : assignee, input.by ?? JP);
    // Une tâche du Mandalart reprise par JP n'a pas besoin d'une 2e ligne : elle est déjà dans sa journée.
    if (toJp) {
      const { data } = await db().from("team_tasks").select(COLS).eq("club_id", CLUB_ID).eq("mandalart_code", input.mandalartCode).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return norm(data ?? { id: "", title, details: null, mandalart_code: input.mandalartCode, assignee: JP, assignee_email: null, created_by: JP, due, status: "a_faire", token: null, sent_at: null, seen_at: null, reminded_at: null, done_at: null, done_note: null, evidence_url: null, created_at: new Date().toISOString() });
    }
  }
  if (title.length < 3) throw new Error("Écris la tâche (3 caractères minimum)");
  const email = toJp ? null : input.assigneeEmail?.trim() || null;
  if (!toJp && !email) throw new Error(`Il faut le courriel de ${assignee} pour lui envoyer la tâche`);
  const row = {
    club_id: CLUB_ID,
    title,
    details: input.details?.trim() || null,
    mandalart_code: input.mandalartCode ?? null,
    assignee,
    assignee_email: email,
    created_by: input.by ?? JP,
    due,
    token: toJp ? null : randomBytes(15).toString("base64url")
  };
  const { data, error } = await db().from("team_tasks").insert(row).select(COLS).single();
  if (error) throw error;
  const task = norm(data);
  if (!toJp && email) {
    await sendMail(email, `Tâche de JP : ${title}`, taskEmail(task, "JP te confie une tâche pour l'académie :"));
    await db().from("team_tasks").update({ sent_at: new Date().toISOString() }).eq("id", task.id);
  }
  return task;
}

/** Statut d'une tâche, par JP (admin) ou par la personne (lien). Faite = case du Mandalart cochée et JP avisé. */
export async function setTeamTaskStatus(input: { id?: string; token?: string; status: TeamTaskStatus; note?: string | null; evidenceUrl?: string | null; by: string }): Promise<TeamTask> {
  const current = input.token ? await getTeamTaskByToken(input.token) : await getTeamTaskById(input.id!);
  if (!current) throw new Error("Tâche introuvable");
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now, done_at: input.status === "fait" ? current.done_at ?? now : null };
  if (input.note !== undefined) patch.done_note = input.note?.trim() || null;
  if (input.evidenceUrl !== undefined) patch.evidence_url = input.evidenceUrl?.trim() || null;
  const { data, error } = await db().from("team_tasks").update(patch).eq("id", current.id).select(COLS).single();
  if (error) throw error;
  const task = norm(data);
  if (task.mandalart_code && (input.status === "fait" || input.status === "en_cours")) {
    const note = [input.status === "fait" ? `Faite par ${task.assignee}` : `${task.assignee} s'en occupe`, task.done_note].filter(Boolean).join(" : ");
    await setTaskStatus({ code: task.mandalart_code, status: input.status, note, evidenceUrl: task.evidence_url ?? undefined, by: input.by });
  }
  if (input.token && current.status !== task.status) {
    const verb = task.status === "fait" ? "a terminé" : task.status === "en_cours" ? "s'occupe de" : "a changé le statut de";
    await sendMail(
      OWNER_NOTIFY_EMAIL,
      `${task.assignee} ${verb} : ${task.title}`,
      `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px">
        <p><strong>${esc(task.assignee)}</strong> ${verb} la tâche <strong>${esc(task.title)}</strong>.</p>
        ${task.done_note ? `<p style="white-space:pre-wrap;background:#f4f0fb;padding:10px 14px;border-radius:8px">${esc(task.done_note)}</p>` : ""}
        ${task.evidence_url ? `<p>Lien : <a href="${esc(task.evidence_url)}">${esc(task.evidence_url)}</a></p>` : ""}
        <p><a href="${env.publicSiteUrl}/admin/moi/confiees">Voir les tâches confiées</a></p>
      </div>`
    );
  }
  return task;
}

async function getTeamTaskById(id: string): Promise<TeamTask | null> {
  const { data } = await db().from("team_tasks").select(COLS).eq("id", id).maybeSingle();
  return data ? norm(data) : null;
}

/** JP reprend une tâche confiée : elle est fermée pour la personne et revient à JP dans le Mandalart. */
export async function takeBackTeamTask(id: string): Promise<void> {
  const t = await getTeamTaskById(id);
  if (!t) throw new Error("Tâche introuvable");
  await db().from("team_tasks").update({ status: "abandonne", updated_at: new Date().toISOString() }).eq("id", id);
  if (t.mandalart_code) await setTaskOwner(t.mandalart_code, null, JP);
}

export async function markTeamTaskSeen(t: TeamTask): Promise<void> {
  if (!t.seen_at) await db().from("team_tasks").update({ seen_at: new Date().toISOString() }).eq("id", t.id);
}

/** Rappels du matin aux personnes qui ont une tâche : la veille de l'échéance, puis aux 2 jours en retard. */
export async function sendTeamTaskReminders(today = todayIso()): Promise<{ sent: number }> {
  const tasks = await listTeamTasks({ openOnly: true });
  let sent = 0;
  for (const t of tasks) {
    const kind = reminderKind(t, today);
    if (!kind || !t.token || !t.assignee_email) continue;
    const intro = kind === "veille" ? "Petit rappel : cette tâche est pour demain." : "Cette tâche est en retard. Dis à JP où tu en es (ou si elle ne te revient pas) sur ta page :";
    await sendMail(t.assignee_email, `${kind === "veille" ? "Rappel" : "En retard"} : ${t.title}`, taskEmail(t, intro));
    await db().from("team_tasks").update({ reminded_at: new Date().toISOString() }).eq("id", t.id);
    sent++;
  }
  return { sent };
}

export interface DayEntry {
  key: string;
  title: string;
  due: string | null;
  bucket: Bucket;
  source: "mandalart" | "perso";
  /** Code Mandalart (si la tâche vient du plan). */
  code: string | null;
  star: boolean;
  status: TeamTaskStatus;
  /** Ligne team_tasks (tâche perso de JP). */
  taskId: string | null;
  objectiveName: string | null;
}

export interface JpDay {
  today: string;
  mine: DayEntry[];
  delegated: (TeamTask & { bucket: Bucket })[];
  doneThisWeek: number;
  assignees: Assignee[];
}

/** « Ma journée » : ce qui revient à JP (Mandalart dont il est responsable + sa liste), et ce qu'il a confié. */
export async function getJpDay(today = todayIso()): Promise<JpDay> {
  const [live, tasks, assignees] = await Promise.all([getLiveTasks(today), listTeamTasks(), getAssignees()]);
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const limit = horizon.toISOString().slice(0, 10);
  const mandalart: DayEntry[] = live
    .filter((t) => (t.status === "a_faire" || t.status === "en_cours") && isJpOwner(t.owner) && (!t.due || t.due <= limit))
    .filter((t) => t.due) // sans date : restent dans le Mandalart, pas dans la journée
    .map((t) => ({ key: t.code, title: t.title, due: t.due, bucket: bucketOf(t.due, today), source: "mandalart", code: t.code, star: t.priority === "star", status: t.status as TeamTaskStatus, taskId: null, objectiveName: t.objectiveName }));
  const perso: DayEntry[] = tasks
    .filter((t) => t.assignee === JP && isOpenTask(t.status) && !t.mandalart_code)
    .map((t) => ({ key: t.id, title: t.title, due: t.due, bucket: bucketOf(t.due, today), source: "perso", code: null, star: false, status: t.status, taskId: t.id, objectiveName: null }));
  const weekStart = new Date(`${today}T12:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const ws = weekStart.toISOString().slice(0, 10);
  const doneThisWeek =
    live.filter((t) => t.status === "fait" && isJpOwner(t.owner) && t.doneAt && t.doneAt.slice(0, 10) >= ws).length +
    tasks.filter((t) => t.status === "fait" && t.done_at && t.done_at.slice(0, 10) >= ws).length;
  return {
    today,
    mine: [...mandalart, ...perso].sort((a, b) => byDue(a, b) || Number(b.star) - Number(a.star)),
    delegated: tasks.filter((t) => t.assignee !== JP).map((t) => ({ ...t, bucket: bucketOf(t.due, today) })),
    doneThisWeek,
    assignees
  };
}

// ───────────────────────── Le mois (liste du 1er) ─────────────────────────

export interface JpMonth {
  /** AAAA-MM */
  month: string;
  today: string;
  /** Ce qui revient à JP ce mois-ci : en retard d'avant + échéance dans le mois (Mandalart et sa liste). */
  mine: DayEntry[];
  /** Ce qu'il a confié et qui n'est pas fini (toutes échéances), puis ce qui a été fait le mois passé. */
  delegatedOpen: TeamTask[];
  delegatedDoneLastMonth: TeamTask[];
  doneLastMonth: number;
}

const monthOf = (iso: string) => iso.slice(0, 7);
const prevMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

export async function getJpMonth(today = todayIso()): Promise<JpMonth> {
  const month = monthOf(today);
  const last = prevMonth(month);
  const [live, tasks] = await Promise.all([getLiveTasks(today), listTeamTasks()]);
  const inScope = (due: string | null) => !due || monthOf(due) <= month;
  const mandalart: DayEntry[] = live
    .filter((t) => (t.status === "a_faire" || t.status === "en_cours") && isJpOwner(t.owner) && t.due && monthOf(t.due) <= month)
    .map((t) => ({ key: t.code, title: t.title, due: t.due, bucket: bucketOf(t.due, today), source: "mandalart", code: t.code, star: t.priority === "star", status: t.status as TeamTaskStatus, taskId: null, objectiveName: t.objectiveName }));
  const perso: DayEntry[] = tasks
    .filter((t) => t.assignee === JP && isOpenTask(t.status) && !t.mandalart_code && inScope(t.due))
    .map((t) => ({ key: t.id, title: t.title, due: t.due, bucket: bucketOf(t.due, today), source: "perso", code: null, star: false, status: t.status, taskId: t.id, objectiveName: null }));
  const doneLast =
    live.filter((t) => t.status === "fait" && isJpOwner(t.owner) && t.doneAt && monthOf(t.doneAt) === last).length +
    tasks.filter((t) => t.assignee === JP && t.status === "fait" && t.done_at && monthOf(t.done_at) === last).length;
  return {
    month,
    today,
    mine: [...mandalart, ...perso].sort((a, b) => byDue(a, b) || Number(b.star) - Number(a.star)),
    delegatedOpen: tasks.filter((t) => t.assignee !== JP && isOpenTask(t.status)).sort(byDue),
    delegatedDoneLastMonth: tasks.filter((t) => t.assignee !== JP && t.status === "fait" && t.done_at && monthOf(t.done_at) === last),
    doneLastMonth: doneLast
  };
}

const MONTH_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabelFr = (ym: string) => `${MONTH_FR[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** Le 1er du mois (à partir de 8 h, une seule fois) : la liste du mois à JP — ses tâches et celles qu'il a confiées. */
export async function sendJpMonthlyList(opts: { today?: string; force?: boolean } = {}): Promise<{ sent: boolean; reason?: string }> {
  const today = opts.today ?? todayIso();
  if (!opts.force && today.slice(8, 10) !== "01") return { sent: false, reason: "pas le 1er" };
  const KEY = "jp_month_list_sent";
  const { data: flag } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", KEY).maybeSingle();
  if (!opts.force && flag?.value === monthOf(today)) return { sent: false, reason: "déjà envoyée" };
  const m = await getJpMonth(today);
  const line = (title: string, meta: string) => `<li style="margin:0 0 6px">${esc(title)} <span style="color:#6b6478;font-size:13px">· ${esc(meta)}</span></li>`;
  const due = (d: string | null) => (d ? (d < today ? `en retard, prévue ${frDay(d)}` : frDay(d)) : "sans date");
  const late = m.mine.filter((e) => e.bucket === "retard");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1a1a2e;max-width:640px">
  <h2 style="margin:0 0 4px">Ton mois de ${esc(monthLabelFr(m.month))}</h2>
  <p style="margin:0 0 16px;color:#6b6478">Le mois passé : ${m.doneLastMonth} tâche${m.doneLastMonth > 1 ? "s" : ""} faite${m.doneLastMonth > 1 ? "s" : ""} par toi, ${m.delegatedDoneLastMonth.length} par ton équipe.</p>
  <h3 style="margin:18px 0 8px">À toi (${m.mine.length}${late.length ? `, dont ${late.length} en retard` : ""})</h3>
  ${m.mine.length ? `<ul style="padding-left:18px;margin:0">${m.mine.map((e) => line(`${e.star ? "⭐ " : ""}${e.title}`, `${due(e.due)}${e.code ? ` · Mandalart ${e.code}` : ""}`)).join("")}</ul>` : "<p>Rien de prévu : choisis tes priorités dans le Mandalart.</p>"}
  <h3 style="margin:18px 0 8px">Confiées, à suivre (${m.delegatedOpen.length})</h3>
  ${m.delegatedOpen.length ? `<ul style="padding-left:18px;margin:0">${m.delegatedOpen.map((t) => line(`${t.assignee} : ${t.title}`, `${due(t.due)} · ${t.status === "en_cours" ? "s'en occupe" : t.seen_at ? "vue, pas commencée" : "pas encore ouverte"}`)).join("")}</ul>` : "<p>Rien de confié en cours. Qu'est-ce que Christine ou Annie pourrait prendre ce mois-ci ?</p>"}
  ${m.delegatedDoneLastMonth.length ? `<h3 style="margin:18px 0 8px">Faites par ton équipe le mois passé</h3><ul style="padding-left:18px;margin:0">${m.delegatedDoneLastMonth.map((t) => line(`${t.assignee} : ${t.title}`, t.done_note ?? "faite")).join("")}</ul>` : ""}
  <p style="margin:20px 0 0"><a href="${env.publicSiteUrl}/admin/moi/mois" style="display:inline-block;background:#5b2a86;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Ouvrir mon mois</a></p>
</div>`;
  await sendMail(OWNER_NOTIFY_EMAIL, `Ton mois de ${monthLabelFr(m.month)} : ${m.mine.length} à toi, ${m.delegatedOpen.length} confiées`, html);
  await db().from("app_settings").upsert({ club_id: CLUB_ID, key: KEY, value: monthOf(today), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  return { sent: true };
}
