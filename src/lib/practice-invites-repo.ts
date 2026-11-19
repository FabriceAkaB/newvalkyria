import { randomBytes } from "node:crypto";

import { CLUB_ID } from "@/lib/club";
import { getResendClient } from "@/lib/resend";
import { env } from "@/lib/env";
import type { McsSession } from "@/lib/mcs-robot";
import { sameMemberName } from "@/lib/mcs-rules";
import { logOutreach } from "@/lib/outreach";
import { ACTIVE_INVITES, inviteSettings, isWeekday, invitesNeeded, overlaps, rankCandidates, rankReason, type Candidate, type InviteSettings } from "@/lib/practice-invites";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";

/** Invitations à l'avancé : lecture des absences annoncées dans MonClubSportif, propositions à confirmer par JP,
 *  courriel au parent, réponse oui / non, ajout de la fille à la pratique dans MonClubSportif. */

function db() {
  return getSupabaseAdminClient() as any;
}

const CHRISTINE = "Christinedurand.2@hotmail.com";
const SETTINGS_KEY = "invitations_avance";
const PRIORITY_KEY = "invitations_priorites";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const frDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const frTime = (t: string) => t.slice(0, 5).replace(":", " h ");

async function getSetting(key: string): Promise<unknown> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", key).maybeSingle();
  return data?.value ?? null;
}
async function setSetting(key: string, value: unknown): Promise<void> {
  const { error } = await db().from("app_settings").upsert({ club_id: CLUB_ID, key, value, updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
}

export const getInviteSettings = async (): Promise<InviteSettings> => inviteSettings(await getSetting(SETTINGS_KEY));
export const saveInviteSettings = async (raw: unknown) => setSetting(SETTINGS_KEY, inviteSettings(raw));
async function getPriorities(): Promise<Record<string, string[]>> {
  const v = await getSetting(PRIORITY_KEY);
  return v && typeof v === "object" ? (v as Record<string, string[]>) : {};
}
/** L'ordre choisi par JP pour un groupe avancé (les autres filles suivent selon les règles). */
export async function savePriority(slotId: string, pinned: string[]): Promise<void> {
  const all = await getPriorities();
  all[slotId] = [...new Set(pinned)].slice(0, 30);
  await setSetting(PRIORITY_KEY, all);
}

/* ── Groupes avancés et filles de l'intermédiaire ─────────────────── */

export interface AdvancedGroup {
  slotId: string;
  label: string;
  day: string;
  start: string;
  end: string | null;
  location: string;
  categories: string[];
  team: { id: string; mcsTeamId: number; mcsSeasonId: number } | null;
}

export interface RankedCandidate extends Candidate {
  rank: number;
  reason: string;
  parentName: string | null;
  parentEmail: string | null;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  ownGroup: string;
}

async function activeSeasonId(): Promise<string | null> {
  const { data } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  return data?.id ?? null;
}

export async function getAdvancedGroups(): Promise<AdvancedGroup[]> {
  const season = await activeSeasonId();
  const [{ data: slots }, { data: regs }, { data: teams }] = await Promise.all([
    db().from("time_slot_templates").select("id, day, start_time, end_time, location, advanced_only, active, season_id").eq("active", true).eq("advanced_only", true),
    db().from("registrations").select("time_slot_template_id, category_id").eq("status", "paid").eq("is_trial", false).eq("season_id", season),
    db().from("mcs_teams").select("id, name, kind, slot_ids, mcs_team_id, mcs_season_id, active").eq("club_id", CLUB_ID)
  ]);
  return ((slots ?? []) as any[])
    .filter((s) => !season || s.season_id === season)
    .map((s) => {
      const categories = [...new Set(((regs ?? []) as any[]).filter((r) => r.time_slot_template_id === s.id).map((r) => String(r.category_id)))].sort();
      const team = ((teams ?? []) as any[]).find((t) => t.active !== false && t.kind === "pratique" && (t.slot_ids ?? []).includes(s.id) && t.mcs_team_id && t.mcs_season_id);
      return {
        slotId: s.id,
        label: team?.name ?? `${s.day} ${categories.join("-")} avancé`,
        day: s.day,
        start: String(s.start_time).slice(0, 5),
        end: s.end_time ? String(s.end_time).slice(0, 5) : null,
        location: s.location ?? "",
        categories,
        team: team ? { id: team.id, mcsTeamId: Number(team.mcs_team_id), mcsSeasonId: Number(team.mcs_season_id) } : null
      };
    });
}

/** Les filles de l'intermédiaire du même âge que le groupe avancé, dans l'ordre des priorités. */
export async function getCandidates(group: AdvancedGroup): Promise<RankedCandidate[]> {
  const season = await activeSeasonId();
  const since = addDays(todayIso(), -60);
  const [{ data: regs }, { data: slots }, priorities, { data: sent }] = await Promise.all([
    db().from("registrations").select("id, player_first_name, player_last_name, player_dob, parent_name, parent_email, category_id, time_slot_template_id, advanced_group").eq("status", "paid").eq("is_trial", false).eq("season_id", season).in("category_id", group.categories.length ? group.categories : ["—"]),
    db().from("time_slot_templates").select("id, day, start_time, end_time, advanced_only"),
    getPriorities(),
    db().from("practice_invitations").select("registration_id, status").eq("club_id", CLUB_ID).in("status", ["envoyee", "acceptee", "refusee", "expiree"])
  ]);
  const slotOf = new Map(((slots ?? []) as any[]).map((s) => [s.id, s] as const));
  const pool = ((regs ?? []) as any[]).filter((r) => {
    const own = slotOf.get(r.time_slot_template_id);
    if (r.time_slot_template_id === group.slotId || r.advanced_group || own?.advanced_only) return false;
    // Jamais deux pratiques en même temps.
    return !(own && overlaps({ day: own.day, start: String(own.start_time).slice(0, 5), end: own.end_time ? String(own.end_time).slice(0, 5) : null }, { day: group.day, start: group.start, end: group.end }));
  });
  const ids = pool.map((r) => r.id);
  const [{ data: evals }, { data: att }] = ids.length
    ? await Promise.all([
        db().from("player_evaluations").select("registration_id, ratings, created_at").in("registration_id", ids).gte("created_at", since),
        db().from("activity_player_attendance").select("registration_id, status, activity:coach_activities!inner(activity_date)").in("registration_id", ids).gte("activity.activity_date", since).lte("activity.activity_date", todayIso())
      ])
    : [{ data: [] }, { data: [] }];
  const pinned = priorities[group.slotId] ?? [];
  const list = pool.map((r) => {
    const scores = ((evals ?? []) as any[]).filter((e) => e.registration_id === r.id).flatMap((e) => Object.values(e.ratings ?? {}).map(Number).filter((v) => v >= 1 && v <= 5));
    const marks = ((att ?? []) as any[]).filter((a) => a.registration_id === r.id);
    const idx = pinned.indexOf(r.id);
    const own = slotOf.get(r.time_slot_template_id);
    return {
      registrationId: r.id,
      name: `${String(r.player_first_name).trim()} ${String(r.player_last_name).trim()}`,
      firstName: String(r.player_first_name).trim(),
      lastName: String(r.player_last_name).trim(),
      birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null,
      parentName: r.parent_name ?? null,
      parentEmail: r.parent_email?.trim() || null,
      ownGroup: own ? `${own.day} ${String(own.start_time).slice(0, 5).replace(":", " h ")} (${r.category_id})` : String(r.category_id),
      pinned: idx >= 0 ? idx + 1 : null,
      invites: ((sent ?? []) as any[]).filter((s) => s.registration_id === r.id).length,
      evalAvg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      attendance: marks.length ? marks.filter((m) => ["present", "late", "left_early"].includes(m.status)).length / marks.length : null
    };
  });
  return rankCandidates(list).map((c, i) => ({ ...c, rank: i + 1, reason: rankReason(c) }));
}

/* ── Absences annoncées → propositions ───────────────────────────── */

export interface InviteRow {
  id: string;
  slot_id: string;
  practice_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  group_label: string;
  mcs_event_id: number | null;
  registration_id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  rank: number | null;
  reason: string | null;
  status: string;
  token: string;
  sent_at: string | null;
  answered_at: string | null;
  mcs_added_at: string | null;
  mcs_error: string | null;
}

export async function listInvites(opts: { from?: string } = {}): Promise<InviteRow[]> {
  const { data, error } = await db().from("practice_invitations").select("*").eq("club_id", CLUB_ID).gte("practice_date", opts.from ?? addDays(todayIso(), -14)).order("practice_date").order("rank");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ ...r, practice_date: String(r.practice_date).slice(0, 10) }));
}

const mcsIdOf = (key: string) => {
  const m = String(key).match(/^(event|game)-(\d+)@/);
  return m ? Number(m[2]) : null;
};

/** Lit les absences annoncées des pratiques avancées des prochains jours et propose les invitations (à confirmer par
 *  JP : une tâche par pratique). Les invitations des pratiques passées expirent. */
export async function scanAbsencesAndPropose(session: McsSession): Promise<{ proposed: number; practices: string[]; errors: string[] }> {
  const settings = await getInviteSettings();
  const today = todayIso();
  await expireOld(today);
  if (!settings.enabled) return { proposed: 0, practices: [], errors: [] };
  const groups = (await getAdvancedGroups()).filter((g) => g.team);
  const until = addDays(today, settings.horizonDays);
  const nowMin = Number(new Date().toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" }).replace(":", "")) ;
  let proposed = 0;
  const practices: string[] = [];
  const errors: string[] = [];
  for (const g of groups) {
    try {
      const [{ data: events }, { data: regs }, grid] = await Promise.all([
        db().from("mcs_events").select("key, event_date, start_time, end_time, type, location").eq("team_id", g.team!.id).gte("event_date", today).lte("event_date", until),
        db().from("registrations").select("id, player_first_name, player_last_name").eq("status", "paid").eq("is_trial", false).eq("time_slot_template_id", g.slotId),
        session.upcomingPresences(g.team!.mcsTeamId, g.team!.mcsSeasonId)
      ]);
      const evById = new Map(((events ?? []) as any[]).filter((e) => e.type !== "Match" && e.type !== "Tournoi").map((e) => [mcsIdOf(e.key), e] as const));
      let candidates: RankedCandidate[] | null = null;
      for (const ev of grid.events) {
        const e = evById.get(ev.id);
        if (!e) continue;
        const date = String(e.event_date).slice(0, 10);
        if (!isWeekday(date)) continue;
        const start = String(e.start_time ?? g.start).slice(0, 5);
        // Le jour même, seulement s'il reste au moins 3 heures pour prévenir la famille.
        if (date === today && Number(start.replace(":", "")) - nowMin < 300) continue;
        const absent = ((regs ?? []) as any[]).filter((r) => grid.rows.some((row) => row.states[ev.id] === "absent" && sameMemberName(row.name, String(r.player_first_name), String(r.player_last_name))));
        const { data: existing } = await db().from("practice_invitations").select("registration_id, status").eq("slot_id", g.slotId).eq("practice_date", date);
        const active = ((existing ?? []) as any[]).filter((x) => ACTIVE_INVITES.includes(x.status)).length;
        const need = invitesNeeded(absent.length, active, settings.threshold);
        if (!need) continue;
        candidates ??= await getCandidates(g);
        const taken = new Set(((existing ?? []) as any[]).map((x) => x.registration_id));
        const picks = candidates.filter((c) => !taken.has(c.registrationId) && c.parentEmail).slice(0, need);
        if (!picks.length) continue;
        const reason = `${absent.length} absentes annoncées : ${absent.map((r) => `${String(r.player_first_name).trim()} ${String(r.player_last_name).trim().charAt(0)}.`).join(", ")}`;
        const { error } = await db().from("practice_invitations").insert(
          picks.map((c) => ({
            club_id: CLUB_ID,
            slot_id: g.slotId,
            practice_date: date,
            start_time: start,
            end_time: e.end_time ? String(e.end_time).slice(0, 5) : g.end,
            location: e.location ?? g.location,
            group_label: g.label,
            mcs_event_id: ev.id,
            registration_id: c.registrationId,
            player_name: c.name,
            parent_name: c.parentName,
            parent_email: c.parentEmail,
            rank: c.rank,
            reason: `${reason} · ${c.reason}`,
            token: randomBytes(18).toString("base64url")
          }))
        );
        if (error) throw new Error(error.message);
        proposed += picks.length;
        practices.push(`${g.label} ${date}`);
        await syncProposalTask(g.slotId, date);
      }
    } catch (err) {
      errors.push(`${g.label} : ${err instanceof Error ? err.message : "erreur"}`);
    }
  }
  return { proposed, practices, errors };
}

/** La tâche de JP pour une pratique : confirmer les invitations proposées (cochée quand il n'en reste plus). */
async function syncProposalTask(slotId: string, date: string): Promise<void> {
  const { data } = await db().from("practice_invitations").select("player_name, group_label, start_time, reason, rank").eq("slot_id", slotId).eq("practice_date", date).eq("status", "proposee").order("rank");
  const rows = (data ?? []) as any[];
  const ref = `invitations:${slotId}:${date}`;
  if (!rows.length) return syncRefTask(ref, { title: "Invitations à l'avancé confirmées", done: true, doneNote: "Envoyées ou retirées" });
  const n = rows.length;
  await syncRefTask(ref, {
    title: `Confirmer ${n} invitation${n > 1 ? "s" : ""} à l'avancé : ${rows[0].group_label}, ${frDate(date)}`,
    details: [`${String(rows[0].reason ?? "").split(" · ")[0]}.`, `Proposées : ${rows.map((r) => r.player_name).join(", ")}.`, "Un clic pour envoyer : Coaching › Joueuses › Invitations à l'avancé (/admin/coaching/invitations)."].join("\n"),
    due: todayIso()
  });
}

async function expireOld(today: string): Promise<void> {
  const { data } = await db().from("practice_invitations").select("id, slot_id, practice_date").eq("club_id", CLUB_ID).in("status", ["proposee", "envoyee"]).lt("practice_date", today);
  const rows = (data ?? []) as any[];
  if (!rows.length) return;
  await db().from("practice_invitations").update({ status: "expiree", updated_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
  for (const k of new Set(rows.map((r) => `${r.slot_id}|${String(r.practice_date).slice(0, 10)}`))) {
    const [s, d] = k.split("|");
    await syncRefTask(`invitations:${s}:${d}`, { title: "Invitations à l'avancé", done: true, doneNote: "Pratique passée" }).catch(() => null);
  }
}

/* ── JP confirme → courriel au parent ────────────────────────────── */

const inviteUrl = (token: string) => `${env.publicSiteUrl}/invitation/${token}`;

function inviteEmail(r: InviteRow): { subject: string; html: string; text: string } {
  const first = (r.parent_name ?? "").trim().split(/\s+/)[0];
  const girl = r.player_name.split(" ")[0];
  const when = `${frDate(r.practice_date)} de ${frTime(r.start_time)}${r.end_time ? ` à ${frTime(r.end_time)}` : ""}`;
  const where = r.location ?? "";
  const url = inviteUrl(r.token);
  const lines = [
    `Bonne nouvelle : des places se libèrent à la pratique du groupe avancé (${r.group_label.replace(/\s*AV$/, "")}) le ${when}${where ? `, ${where}` : ""}.`,
    `Comme promis, nous invitons les filles du groupe intermédiaire à venir s'entraîner avec l'avancé pour progresser, et ${girl} est invitée. C'est sans frais.`,
    "Pouvez-vous nous dire si elle sera là ? Un clic suffit."
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">
    <p>Bonjour${first ? ` ${first}` : ""},</p>${lines.map((l) => `<p>${l}</p>`).join("")}
    <p><a href="${url}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">Répondre à l'invitation</a></p>
    <p style="font-size:13px;color:#666;margin-top:-6px">Ou copiez ce lien : <a href="${url}">${url}</a></p>
    <p>Au plaisir de la voir sur le terrain,<br/>L'équipe New Valkyria</p></div>`;
  const text = `Bonjour${first ? ` ${first}` : ""},\n\n${lines.join("\n\n")}\n\nRépondre à l'invitation : ${url}\n\nAu plaisir de la voir sur le terrain,\nL'équipe New Valkyria`;
  return { subject: `${girl} est invitée à la pratique du groupe avancé, ${frDate(r.practice_date)}`, html, text };
}

/** JP confirme : chaque invitation proposée de cette pratique part au parent (Christine en copie). */
export async function confirmInvites(slotId: string, date: string): Promise<{ sent: string[]; failed: string[] }> {
  const { data } = await db().from("practice_invitations").select("*").eq("slot_id", slotId).eq("practice_date", date).eq("status", "proposee").order("rank");
  const sent: string[] = [];
  const failed: string[] = [];
  const client = getResendClient();
  for (const r of ((data ?? []) as any[]).map((x) => ({ ...x, practice_date: String(x.practice_date).slice(0, 10) })) as InviteRow[]) {
    if (!r.parent_email) {
      failed.push(`${r.player_name} (pas de courriel)`);
      continue;
    }
    const mail = inviteEmail(r);
    const res = await client.emails.send({ to: r.parent_email, cc: CHRISTINE, ...mail } as never).catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : "erreur" } }));
    const err = (res as { error?: { message: string } | null })?.error;
    if (err) {
      failed.push(`${r.player_name} (${err.message})`);
      continue;
    }
    await db().from("practice_invitations").update({ status: "envoyee", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id);
    await logOutreach({ parentEmail: r.parent_email, parentName: r.parent_name, playerName: r.player_name, registrationId: r.registration_id, campaign: "Invitation à l'avancé", subject: mail.subject, kind: "relance", notes: `${r.group_label}, ${r.practice_date} ${r.start_time}` }).catch(() => null);
    sent.push(r.player_name);
  }
  await syncProposalTask(slotId, date);
  return { sent, failed };
}

/** JP retire une proposition (la suivante sur la liste pourra être proposée au prochain passage du robot). */
export async function cancelInvite(id: string): Promise<void> {
  const { data } = await db().from("practice_invitations").update({ status: "annulee", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "proposee").select("slot_id, practice_date").maybeSingle();
  if (data) await syncProposalTask(data.slot_id, String(data.practice_date).slice(0, 10));
}

/* ── Réponse du parent ───────────────────────────────────────────── */

export async function getInviteByToken(token: string): Promise<InviteRow | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const { data } = await db().from("practice_invitations").select("*").eq("token", token).maybeSingle();
  return data ? { ...data, practice_date: String(data.practice_date).slice(0, 10) } : null;
}

/** Oui ou non du parent (modifiable jusqu'au jour de la pratique). Un oui ajoute la fille dans MonClubSportif au
 *  prochain passage du robot ; un non libère la place pour la suivante sur la liste. */
export async function answerInvite(token: string, accept: boolean): Promise<InviteRow | null> {
  const r = await getInviteByToken(token);
  if (!r || !["envoyee", "acceptee", "refusee"].includes(r.status) || r.practice_date < todayIso()) return r;
  const status = accept ? "acceptee" : "refusee";
  const { data } = await db().from("practice_invitations").update({ status, answered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", r.id).select("*").single();
  if (r.status !== status && r.parent_email) {
    await logOutreach({ parentEmail: r.parent_email, parentName: r.parent_name, playerName: r.player_name, registrationId: r.registration_id, campaign: "Invitation à l'avancé", kind: accept ? "reponse" : "refus", notes: `${accept ? "Oui" : "Non"} pour ${r.group_label}, ${r.practice_date}` }).catch(() => null);
  }
  return { ...data, practice_date: String(data.practice_date).slice(0, 10) };
}

/* ── Oui → la fille est ajoutée à la pratique dans MonClubSportif ─── */

/** Ajoute chaque invitée qui a dit oui à l'équipe avancée (remplaçante, assignée à cette pratique seulement) et la
 *  marque présente. En cas d'échec : une tâche pour JP, avec quoi faire à la main. */
export async function addAcceptedToMcs(session: McsSession): Promise<{ added: string[]; errors: string[] }> {
  const { data } = await db().from("practice_invitations").select("*").eq("club_id", CLUB_ID).eq("status", "acceptee").is("mcs_added_at", null).gte("practice_date", todayIso());
  const rows = (data ?? []) as any[];
  if (!rows.length) return { added: [], errors: [] };
  const groups = await getAdvancedGroups();
  const added: string[] = [];
  const errors: string[] = [];
  for (const r of rows) {
    const g = groups.find((x) => x.slotId === r.slot_id);
    try {
      if (!g?.team || !r.mcs_event_id) throw new Error("équipe avancée ou pratique introuvable dans MonClubSportif");
      const { mcsTeamId: team, mcsSeasonId: season } = g.team;
      const { data: reg } = await db().from("registrations").select("player_first_name, player_last_name, player_dob, parent_email").eq("id", r.registration_id).single();
      const first = String(reg.player_first_name).trim();
      const last = String(reg.player_last_name).trim();
      const find = async () => (await session.roster(team, season)).find((m) => sameMemberName(m.name, first, last)) ?? null;
      let member = await find();
      if (!member) {
        await session.addMember(team, season, { firstName: first, lastName: last, gender: "female", birthYear: reg.player_dob ? Number(String(reg.player_dob).slice(0, 4)) : null, parentEmail: reg.parent_email?.trim() || null }, { assignAll: false });
        member = await find();
        if (!member) throw new Error("ajoutée, mais introuvable dans la liste de l'équipe");
        await session.updateMember(team, season, member.id, { type: "reserve" });
      }
      const current = (await session.memberAssignmentList(team, season, member.id)).filter((a) => a.checked).map((a) => a.id);
      const eventId = String(r.mcs_event_id);
      if (!current.includes(eventId)) await session.setMemberAssignments(team, season, member.id, [...current, eventId]);
      await session.setPresence(team, season, Number(r.mcs_event_id), member.id, "present");
      await db().from("practice_invitations").update({ mcs_added_at: new Date().toISOString(), mcs_error: null, updated_at: new Date().toISOString() }).eq("id", r.id);
      added.push(`${r.player_name} (${r.group_label}, ${String(r.practice_date).slice(0, 10)})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erreur";
      errors.push(`${r.player_name} : ${msg}`);
      await db().from("practice_invitations").update({ mcs_error: msg.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", r.id);
      await syncRefTask(`invitation-mcs:${r.id}`, {
        title: `Ajouter ${r.player_name} à la pratique avancée du ${frDate(String(r.practice_date).slice(0, 10))} dans MonClubSportif`,
        details: `Sa famille a accepté l'invitation, mais le robot n'a pas pu l'ajouter (${msg}). Dans l'équipe ${r.group_label} : l'ajouter comme remplaçante, l'assigner à cette pratique seulement, la mettre présente.`,
        due: todayIso()
      }).catch(() => null);
    }
  }
  return { added, errors };
}

/** Le passage du robot : propositions d'après les absences, puis ajout des « oui » dans MonClubSportif. */
export async function runPracticeInvites(): Promise<{ proposed: number; added: number; errors: string[]; skipped?: string }> {
  const { getMcsRules } = await import("@/lib/mcs-rules-repo");
  const { openRobotSession } = await import("@/lib/mcs-robot-runner");
  const rules = await getMcsRules();
  if (!rules.robotActive) return { proposed: 0, added: 0, errors: [], skipped: "Robot pas encore activé" };
  const session = await openRobotSession();
  if (!session) return { proposed: 0, added: 0, errors: [], skipped: "Compte robot pas enregistré" };
  const scan = await scanAbsencesAndPropose(session);
  const mcs = await addAcceptedToMcs(session);
  return { proposed: scan.proposed, added: mcs.added.length, errors: [...scan.errors, ...mcs.errors] };
}
