import { randomBytes } from "node:crypto";

import { CLUB_ID } from "@/lib/club";
import {
  addDaysIso,
  CONTENT_TASK_CODES,
  DEFAULT_FILMER,
  FILMED_STATUSES,
  interviewsPerWeek,
  slotRemaining,
  weekQuotas,
  weekStart,
  type CalendarItem,
  type InterviewSlot,
  type InterviewStatus,
  type WeekQuota
} from "@/lib/content-core";
import { env } from "@/lib/env";
import { isOpen, type LiveTask } from "@/lib/mandalart-core";
import { getLiveTasks } from "@/lib/mandalart-repo";
import { listChannelStats, listPosts } from "@/lib/marketing-posts";
import { followerSeries, FOLLOWER_NETWORKS, networkLabel, type MarketingPost } from "@/lib/marketing-posts-core";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Espace « Création de contenu » : lit les pratiques (coach_activities), les vidéos Veo (match_videos),
 *  les tournages (jp_video_shoots) et les publications (marketing_posts) ; écrit seulement ses propres tables
 *  (content_captures, content_interview_slots, content_interviews). Règles : content-core.ts. */

const db = () => getSupabaseAdminClient() as any;
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/* ── Pratiques et matchs de la semaine : ball mastery à 360°, photos des joueuses ── */

export type CaptureKind = "ball_mastery_360" | "photos_match";

export interface PracticeCapture {
  activityId: string;
  date: string;
  start: string;
  end: string;
  title: string;
  location: string | null;
  type: "Pratique" | "Match";
  /** Pratique en gymnase : on y filme le ball mastery à 360°. */
  gym: boolean;
  /** Ce qui se capte à cette activité : ball mastery 360° (pratique) ou photos des joueuses (match). */
  kind: CaptureKind;
  captured: boolean;
  url: string | null;
  filmedBy: string | null;
  note: string | null;
  veo: boolean;
}

export async function getWeekPractices(from: string, days = 7): Promise<PracticeCapture[]> {
  const to = addDaysIso(from, days - 1);
  const { data: acts, error } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, end_time, title, location, activity_type, organization")
    .gte("activity_date", from)
    .lte("activity_date", to)
    .in("activity_type", ["Pratique", "Match"])
    .is("organization", null)
    .order("activity_date")
    .order("start_time");
  if (error) throw error;
  // Les garçons ne sont pas filmés : seules les activités des filles comptent.
  const girls = ((acts ?? []) as any[]).filter((a) => !/gar[cç]on/i.test(`${a.title ?? ""}`));
  const ids = girls.map((a: any) => a.id);
  const [{ data: caps }, { data: vids }] = ids.length
    ? await Promise.all([
        db().from("content_captures").select("activity_id, kind, url, filmed_by, note").in("activity_id", ids),
        db().from("match_videos").select("activity_id").in("activity_id", ids)
      ])
    : [{ data: [] }, { data: [] }];
  return girls.map((a) => {
    const type = a.activity_type === "Match" ? "Match" : "Pratique";
    const kind: CaptureKind = type === "Match" ? "photos_match" : "ball_mastery_360";
    const c = ((caps ?? []) as any[]).find((x) => x.activity_id === a.id && x.kind === kind);
    const loc = String(a.location ?? "");
    return {
      activityId: a.id,
      date: String(a.activity_date).slice(0, 10),
      start: String(a.start_time).slice(0, 5),
      end: String(a.end_time).slice(0, 5),
      title: a.title,
      location: a.location,
      type,
      gym: type === "Pratique" && (/gym/i.test(loc) || !/synth|terrebonne|rosem/i.test(loc)),
      kind,
      captured: !!c,
      url: c?.url ?? null,
      filmedBy: c?.filmed_by ?? null,
      note: c?.note ?? null,
      veo: ((vids ?? []) as any[]).some((v) => v.activity_id === a.id)
    };
  });
}

export async function setCapture(input: { activityId: string; kind: CaptureKind; done: boolean; url?: string | null; filmedBy?: string | null; note?: string | null }): Promise<void> {
  if (!input.done) {
    const { error } = await db().from("content_captures").delete().eq("activity_id", input.activityId).eq("kind", input.kind);
    if (error) throw error;
    return;
  }
  const { error } = await db()
    .from("content_captures")
    .upsert(
      { club_id: CLUB_ID, activity_id: input.activityId, kind: input.kind, url: input.url?.trim() || null, filmed_by: input.filmedBy?.trim() || DEFAULT_FILMER, note: input.note?.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: "activity_id,kind" }
    );
  if (error) throw error;
}

/* ── Entrevues ─────────────────────────────────────────────────────── */

export interface Interview {
  id: string;
  token: string;
  registration_id: string | null;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  kind: "debut" | "fin";
  with_parent: boolean;
  slot_id: string | null;
  status: InterviewStatus;
  invited_at: string | null;
  confirmed_at: string | null;
  filmed_at: string | null;
  video_url: string | null;
  note: string | null;
}

const I_COLS = "id, token, registration_id, player_name, parent_name, parent_email, kind, with_parent, slot_id, status, invited_at, confirmed_at, filmed_at, video_url, note";

export async function listSlots(): Promise<InterviewSlot[]> {
  const { data, error } = await db().from("content_interview_slots").select("id, day, start_time, end_time, place, capacity, note").eq("club_id", CLUB_ID).order("day").order("start_time");
  if (error) throw error;
  return ((data ?? []) as any[]).map((s) => ({ ...s, day: String(s.day).slice(0, 10) }));
}

export async function listInterviews(): Promise<Interview[]> {
  const { data, error } = await db().from("content_interviews").select(I_COLS).eq("club_id", CLUB_ID).order("created_at");
  if (error) throw error;
  return (data ?? []) as Interview[];
}

export async function addSlot(input: { day: string; startTime: string; endTime: string; place: string; capacity: number; note?: string | null }): Promise<void> {
  const { error } = await db().from("content_interview_slots").insert({ club_id: CLUB_ID, day: input.day, start_time: input.startTime, end_time: input.endTime, place: input.place.trim(), capacity: input.capacity, note: input.note?.trim() || null });
  if (error) throw error;
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await db().from("content_interview_slots").delete().eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
}

/** Joueuses inscrites (saison active, payées) : candidates aux entrevues, une ligne par fille. */
export async function interviewCandidates(): Promise<{ registrationId: string; player: string; parentName: string | null; parentEmail: string | null; group: string }[]> {
  const { data, error } = await db()
    .from("registrations")
    .select("id, player_first_name, player_last_name, parent_name, parent_email, category_id, program_id, is_trial, time_slot_template:time_slot_templates(day, start_time)")
    .eq("season_id", SEASON_DB_ID)
    .eq("status", "paid")
    .eq("is_trial", false);
  if (error) throw error;
  const seen = new Set<string>();
  const out = [];
  for (const r of (data ?? []) as any[]) {
    const player = `${String(r.player_first_name).trim()} ${String(r.player_last_name).trim()}`.replace(/\s+/g, " ");
    const key = player.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const slot = r.time_slot_template;
    out.push({ registrationId: r.id, player, parentName: r.parent_name ?? null, parentEmail: r.parent_email?.trim().toLowerCase() || null, group: `${r.category_id ?? ""}${slot?.day ? ` · ${slot.day} ${String(slot.start_time).slice(0, 5)}` : ""}` });
  }
  return out.sort((a, b) => a.group.localeCompare(b.group, "fr") || a.player.localeCompare(b.player, "fr"));
}

export async function addInterviews(registrationIds: string[], kind: "debut" | "fin", withParent: boolean): Promise<number> {
  if (!registrationIds.length) return 0;
  const [cands, existing] = await Promise.all([interviewCandidates(), listInterviews()]);
  const rows = cands
    .filter((c) => registrationIds.includes(c.registrationId))
    .filter((c) => !existing.some((e) => e.registration_id === c.registrationId && e.kind === kind))
    .map((c) => ({ club_id: CLUB_ID, token: randomBytes(12).toString("base64url"), registration_id: c.registrationId, player_name: c.player, parent_name: c.parentName, parent_email: c.parentEmail, kind, with_parent: withParent, status: "a_inviter" }));
  if (!rows.length) return 0;
  const { error } = await db().from("content_interviews").insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function updateInterview(id: string, patch: { status?: InterviewStatus; slotId?: string | null; videoUrl?: string | null; note?: string | null }): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    row.status = patch.status;
    if (FILMED_STATUSES.includes(patch.status)) row.filmed_at = new Date().toISOString();
  }
  if (patch.slotId !== undefined) {
    row.slot_id = patch.slotId;
    if (patch.slotId && !patch.status) row.status = "confirmee";
  }
  if (patch.videoUrl !== undefined) row.video_url = patch.videoUrl?.trim() || null;
  if (patch.note !== undefined) row.note = patch.note?.trim() || null;
  const { error } = await db().from("content_interviews").update(row).eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
}

export async function deleteInterview(id: string): Promise<void> {
  const { error } = await db().from("content_interviews").delete().eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
}

const CHRISTINE = "Christinedurand.2@hotmail.com";
const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">${inner}</div>`;
const btn = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">${label}</a></p><p style="font-size:13px;color:#666;margin-top:-6px">Ou copiez ce lien : <a href="${href}">${href}</a></p>`;

/** Invitation aux familles : un courriel par famille (sœurs regroupées), lien personnel pour choisir son heure.
 *  Christine reçoit sa propre copie de l'annonce. */
export async function inviteInterviews(ids: string[]): Promise<{ sent: number; failed: string[] }> {
  const all = await listInterviews();
  const targets = all.filter((i) => ids.includes(i.id) && i.parent_email && (i.status === "a_inviter" || i.status === "invitee"));
  const byEmail = new Map<string, Interview[]>();
  for (const i of targets) byEmail.set(i.parent_email!, [...(byEmail.get(i.parent_email!) ?? []), i]);
  const { getResendClient } = await import("@/lib/resend");
  const client = getResendClient();
  const failed: string[] = [];
  let sent = 0;
  let sample = "";
  for (const [email, list] of byEmail) {
    const first = (list[0].parent_name ?? "").trim().split(/\s+/)[0];
    const names = list.map((i) => i.player_name.split(" ")[0]).join(" et ");
    const link = `${env.publicSiteUrl}/entrevue/${list[0].token}`;
    const html = wrap(`<p>Bonjour${first ? ` ${first}` : ""},</p>
<p>Cette saison, nous filmons une courte entrevue avec les joueuses de l'académie : ce qu'elles aiment, ce qu'elles veulent apprendre et, en fin de saison, le chemin parcouru. ${names} fait partie des filles choisies et nous aimerions beaucoup l'entendre.</p>
<p>L'entrevue dure environ 5 minutes${list[0].with_parent ? ", et si vous le voulez bien, nous aimerions aussi vous poser 2 ou 3 questions sur votre expérience comme parent" : ""}. Choisissez simplement le moment qui vous convient :</p>
${btn(link, "Choisir mon heure")}
<p>Au plaisir de vous voir !</p>
<p>L'équipe New Valkyria</p>`);
    const text = html.replace(/<\/(p|li)>/g, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n");
    sample ||= html;
    const res = await client.emails.send({ to: email, subject: `${names} : une entrevue filmée avec New Valkyria`, html, text } as never);
    const err = (res as { error: { message: string } | null }).error;
    if (err) {
      failed.push(email);
      continue;
    }
    sent++;
    // Le même lien sert aux sœurs : on le recopie sur chaque fiche de la famille.
    await db()
      .from("content_interviews")
      .update({ status: "invitee", invited_at: new Date().toISOString(), token: list[0].token, updated_at: new Date().toISOString() })
      .in("id", list.map((i) => i.id));
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (sent && sample) await client.emails.send({ to: CHRISTINE, subject: `[Copie] Invitation aux entrevues filmées (${sent} familles)`, html: sample } as never).catch(() => null);
  return { sent, failed };
}

/** Page famille : l'entrevue (et ses sœurs) par le lien, avec les journées où il reste de la place. */
export async function getInterviewByToken(token: string): Promise<{ interviews: Interview[]; slots: (InterviewSlot & { remaining: number })[] } | null> {
  const { data, error } = await db().from("content_interviews").select(I_COLS).eq("token", token);
  if (error) throw error;
  if (!data?.length) return null;
  const [slots, all] = await Promise.all([listSlots(), listInterviews()]);
  const today = todayIso();
  return {
    interviews: data as Interview[],
    slots: slots.filter((s) => s.day >= today).map((s) => ({ ...s, remaining: slotRemaining(s, all) }))
  };
}

export async function chooseInterviewSlot(token: string, slotId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await getInterviewByToken(token);
  if (!found) return { ok: false, error: "Lien introuvable." };
  const ids = found.interviews.map((i) => i.id);
  if (slotId === null) {
    await db().from("content_interviews").update({ status: "decline", slot_id: null, updated_at: new Date().toISOString() }).in("id", ids);
    return { ok: true };
  }
  const slot = found.slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, error: "Ce moment n'est plus offert." };
  const mine = found.interviews.filter((i) => i.slot_id === slotId).length;
  if (slot.remaining + mine < ids.length) return { ok: false, error: "Ce moment est complet, choisissez-en un autre." };
  const { error } = await db().from("content_interviews").update({ slot_id: slotId, status: "confirmee", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
  return { ok: true };
}

/* ── Calendrier de publication ─────────────────────────────────────── */

export async function getCalendarItems(from: string, to: string): Promise<CalendarItem[]> {
  const [{ data: shoots, error }, posts] = await Promise.all([
    db().from("jp_video_shoots").select("title, status, publish_on, post_kind, angle, networks").eq("club_id", CLUB_ID).gte("publish_on", from).lte("publish_on", to),
    listPosts()
  ]);
  if (error) throw error;
  const planned: CalendarItem[] = ((shoots ?? []) as any[])
    .filter((s) => s.status !== "publie")
    .map((s) => ({ date: String(s.publish_on).slice(0, 10), kind: "prevu", title: s.title, postKind: s.post_kind ?? "organique", angle: s.angle, networks: s.networks ?? [], status: s.status }));
  const seen = new Set<string>();
  const done: CalendarItem[] = [];
  for (const p of posts.filter((p) => p.posted_on >= from && p.posted_on <= to)) {
    const g = done.find((d) => seen.has(p.group_id) && d.date === p.posted_on && d.title === (p.title ?? p.theme ?? ""));
    if (g) {
      g.networks.push(networkLabel(p.network));
      g.views = (g.views ?? 0) + (p.views ?? 0);
      continue;
    }
    seen.add(p.group_id);
    done.push({ date: p.posted_on, kind: "publie", title: p.title ?? p.theme ?? "Publication", postKind: p.paid ? "pub" : "organique", angle: p.theme, networks: [networkLabel(p.network)], views: p.views });
  }
  return [...planned, ...done];
}

/* ── Tableau de bord de la semaine ─────────────────────────────────── */

export interface ContentDashboard {
  week: { from: string; to: string };
  quotas: WeekQuota[];
  practices: PracticeCapture[];
  interviews: { filmed: number; confirmed: number; invited: number; goal: number; perWeek: number };
  nextSlots: (InterviewSlot & { remaining: number; booked: string[] })[];
  calendar: CalendarItem[];
  reach: { views30: number; posts30: number; followers: { network: string; followers: number | null; gained30: number | null }[] };
  tasks: LiveTask[];
}

export async function getContentDashboard(today = todayIso()): Promise<ContentDashboard> {
  const from = weekStart(today);
  const to = addDaysIso(from, 6);
  const [practices, interviews, slots, posts, stats, calendar, tasks] = await Promise.all([
    getWeekPractices(from),
    listInterviews(),
    listSlots(),
    listPosts(),
    listChannelStats(),
    getCalendarItems(today, addDaysIso(today, 13)),
    getLiveTasks(today).catch(() => [] as LiveTask[])
  ]);
  const filmed = interviews.filter((i) => FILMED_STATUSES.includes(i.status)).length;
  const filmedThisWeek = interviews.filter((i) => i.filmed_at && i.filmed_at.slice(0, 10) >= from && i.filmed_at.slice(0, 10) <= to).length;
  const weekPosts = new Set(posts.filter((p: MarketingPost) => p.posted_on >= from && p.posted_on <= to).map((p) => p.group_id)).size;
  const gym = practices.filter((p) => p.gym);
  const matches = practices.filter((p) => p.type === "Match");
  const perWeek = interviewsPerWeek(filmed, today);
  const since30 = addDaysIso(today, -30);
  const recent = posts.filter((p) => p.posted_on >= since30);
  return {
    week: { from, to },
    quotas: weekQuotas({ published: weekPosts, practices: gym.length, captured360: gym.filter((p) => p.captured).length, matches: matches.length, matchPhotos: matches.filter((p) => p.captured).length, veoPractices: practices.filter((p) => p.veo && p.type === "Pratique").length, interviewsFilmed: filmedThisWeek, interviewsPerWeek: perWeek }),
    practices,
    interviews: { filmed, confirmed: interviews.filter((i) => i.status === "confirmee").length, invited: interviews.filter((i) => i.status === "invitee").length, goal: 30, perWeek },
    nextSlots: slots
      .filter((s) => s.day >= today)
      .slice(0, 4)
      .map((s) => ({ ...s, remaining: slotRemaining(s, interviews), booked: interviews.filter((i) => i.slot_id === s.id && i.status !== "decline").map((i) => i.player_name) })),
    calendar,
    reach: {
      views30: recent.reduce((s, p) => s + (p.views ?? 0), 0),
      posts30: new Set(recent.map((p) => p.group_id)).size,
      followers: FOLLOWER_NETWORKS.map((n) => {
        const series = followerSeries(stats, n);
        const last = series[series.length - 1];
        const old = [...series].reverse().find((x) => x.date <= since30);
        return { network: networkLabel(n), followers: last?.followers ?? null, gained30: last && old ? last.followers - old.followers : null };
      })
    },
    tasks: tasks.filter((t) => CONTENT_TASK_CODES.includes(t.code) && isOpen(t)).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
  };
}
