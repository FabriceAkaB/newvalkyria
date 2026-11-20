import { getActivityAttendance, getActivityRoster, loadRosterSources, rosterForActivity, toRosterPlayer, type PlayerAttendance, type RosterPlayer } from "@/lib/coach-portal-repo";
import { getActivity, type CoachActivity } from "@/lib/coaches-repo";
import { coachHelpRates, summarizeSurvey, weeklySeries, type CoachHelpRate, type SurveyAnswer, type SurveyRow, type SurveySummary, type SurveyWeek } from "@/lib/practice-survey";
import { createActivityFor, listPractices, todayIso, type Practice } from "@/lib/practices-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Sondage de fin de pratique côté espace Coaching (JP ou la gérante au bord du terrain). */

function db() {
  return getSupabaseAdminClient() as any;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const HERE = ["present", "late", "left_early"];

export interface SurveyPractice extends Practice {
  /** Joueuses attendues (inscrites des plages à cette heure et à cet endroit, et essais du jour). */
  expected: number;
  present: number;
  answered: number;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
/** Même pratique sur le terrain : même jour, même endroit, début à 15 minutes près (ex. lundi 19 h 30, 2015 et 2014-2013). */
export const together = (a: Practice, b: Practice) => a.date === b.date && a.location === b.location && Math.abs(toMin(a.start) - toMin(b.start)) <= 15;
export const groupName = (g: string) => g.replace(/^Filles\s+/i, "");

export async function academyPractices(from: string, to: string): Promise<Practice[]> {
  return (await listPractices({ from, to })).filter((p) => !p.organization && p.source !== "programme" && p.activityType !== "Match");
}

/** Les pratiques de l'Académie d'aujourd'hui et des 7 derniers jours, avec où en est leur sondage. Les groupes qui
 *  s'entraînent au même endroit à la même heure ne font qu'un sondage, avec toutes leurs filles ; une plage sans
 *  aucune inscrite (ex. lundi 19 h 30 en 2014-2013 : toutes sont le jeudi) n'apparaît pas seule. */
export async function getRecentPracticesForSurvey(): Promise<SurveyPractice[]> {
  const today = todayIso();
  const [practices, { slots, regs }] = await Promise.all([academyPractices(addDays(today, -7), today), loadRosterSources()]);
  const ids = practices.map((p) => p.activityId).filter((x): x is string => Boolean(x));
  const { data } = ids.length ? await db().from("activity_player_attendance").select("activity_id, status, practice_rating, fatigue").in("activity_id", ids) : { data: [] };
  const rows = (data ?? []) as any[];
  const rosterOf = (p: Practice) => rosterForActivity({ activity_date: p.date, start_time: p.start, category: p.group }, slots, regs);

  const used = new Set<string>();
  const out: SurveyPractice[] = [];
  for (const p of practices) {
    if (used.has(p.key)) continue;
    const mates = practices.filter((q) => !used.has(q.key) && together(p, q));
    mates.forEach((q) => used.add(q.key));
    const withRoster = mates.map((q) => ({ q, roster: rosterOf(q), answers: rows.filter((r) => r.activity_id === q.activityId && HERE.includes(r.status)) }));
    const expected = new Set(withRoster.flatMap((x) => x.roster.map((r) => r.registrationId))).size;
    // Le sondage vit sur une seule activité : celle qui a déjà des réponses, sinon le groupe le plus nombreux.
    const main = [...withRoster].sort((a, b) => b.answers.length - a.answers.length || b.roster.length - a.roster.length)[0];
    const answers = withRoster.flatMap((x) => x.answers);
    const shown = withRoster.filter((x) => x.roster.length > 0 || x.answers.length > 0).map((x) => groupName(x.q.group));
    out.push({
      ...main.q,
      group: `Filles ${(shown.length ? shown : [groupName(main.q.group)]).join(" et ")}`,
      expected,
      present: answers.length,
      answered: answers.filter((r) => r.practice_rating != null && r.fatigue != null).length
    });
  }
  return out.filter((p) => p.expected > 0 || p.present > 0).sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
}

/** Ouvre le sondage d'une pratique de l'horaire : crée son activité si elle n'existe pas encore. */
export async function openSurveyActivity(key: string): Promise<string | null> {
  const today = todayIso();
  // Jusqu'à demain : la borne ouvre aussi la pratique de ce soir ou de demain matin, avant qu'elle commence.
  const practice = (await academyPractices(addDays(today, -7), addDays(today, 1))).find((p) => p.key === key);
  if (!practice) return null;
  if (practice.activityId) return practice.activityId;
  return createActivityFor({ date: practice.date, start: practice.start, end: practice.end, location: practice.location, group: practice.group });
}

export interface SurveyData {
  activity: CoachActivity;
  roster: RosterPlayer[];
  attendance: PlayerAttendance[];
  /** Les groupes sur le terrain à ce moment-là (ex. « Filles 2015 et 2014-2013 »). */
  label: string;
  /** Les coachs de cette pratique (et des groupes à la même heure), absentes et annulées exclues : la borne les
   *  propose à « Ta coach t'a-t-elle aidée ou encouragée ? ». */
  coaches: { id: string; first: string }[];
}

/** Les coachs assignés à ces activités, sans les absents ni les annulés, une fois chacun. */
export async function coachesOfActivities(activityIds: string[]): Promise<{ id: string; first: string }[]> {
  if (!activityIds.length) return [];
  const { data } = await db().from("coach_assignments").select("coach_id, status, coach:coaches(first_name)").in("activity_id", activityIds);
  const out = new Map<string, string>();
  for (const a of (data ?? []) as any[]) {
    if (["absent", "cancelled"].includes(a.status) || out.has(a.coach_id)) continue;
    const first = String(a.coach?.first_name ?? "").trim();
    if (first) out.set(a.coach_id, first.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()));
  }
  return [...out.entries()].map(([id, first]) => ({ id, first })).sort((a, b) => a.first.localeCompare(b.first, "fr"));
}

/** L'activité du sondage et toutes les filles attendues sur le terrain à ce moment-là (les groupes à la même heure
 *  et au même endroit compris). */
export async function getSurveyData(activityId: string): Promise<SurveyData | null> {
  const activity = await getActivity(activityId);
  if (!activity) return null;
  const date = String(activity.activity_date).slice(0, 10);
  const [own, attendance, sameDay, { slots, regs }] = await Promise.all([
    getActivityRoster(activity),
    getActivityAttendance(activityId),
    academyPractices(date, date),
    loadRosterSources()
  ]);
  const me = sameDay.find((p) => p.activityId === activityId);
  const mates = me ? sameDay.filter((q) => together(me, q)) : [];
  const byId = new Map(own.map((r) => [r.registrationId, r] as const));
  const groups: string[] = own.length ? [groupName(activity.title || activity.category || "")] : [];
  for (const q of mates) {
    const r = rosterForActivity({ activity_date: q.date, start_time: q.start, category: q.group }, slots, regs);
    if (r.length && !groups.includes(groupName(q.group))) groups.push(groupName(q.group));
    for (const x of r) if (!byId.has(x.registrationId)) byId.set(x.registrationId, x);
  }
  // Joueuses ajoutées pour cette pratique (présentes dans MonClubSportif ou notées par l'éducateur) sans être de la plage :
  // elles répondent aussi au sondage (JP, 18 nov. 2026).
  for (const at of attendance as any[]) {
    if (byId.has(at.registration_id) || !["present", "late", "left_early"].includes(at.status)) continue;
    const reg = regs.find((r: any) => r.id === at.registration_id);
    if (reg) byId.set(at.registration_id, toRosterPlayer(reg));
  }
  const roster = [...byId.values()].sort((a, b) => Number(a.isTrial) - Number(b.isTrial) || a.firstName.localeCompare(b.firstName, "fr"));
  const label = groups.filter(Boolean).length ? `Filles ${groups.filter(Boolean).join(" et ")}` : activity.title || activity.category || activity.activity_type;
  const coaches = await coachesOfActivities([...new Set([activityId, ...mates.map((q) => q.activityId).filter((x): x is string => Boolean(x))])]).catch(() => []);
  return { activity, roster, attendance, label, coaches };
}

export const answerOf = (a: PlayerAttendance): SurveyAnswer => ({
  practiceRating: a.practice_rating ?? null,
  fatigue: a.fatigue ?? null,
  wantsMore: a.wants_more ?? [],
  wantsMoreNote: a.wants_more_note ?? null,
  learning: a.learning ?? null,
  understanding: a.understanding ?? null,
  confidence: a.confidence ?? null,
  coachHelped: (a as any).coach_helped ?? null,
  coachHelpers: (a as any).coach_helpers ?? [],
  peerHelped: (a as any).peer_helped ?? null,
  peerHelpers: (a as any).peer_helpers ?? []
});

/** Ce que les filles ont dit sur les 4 dernières semaines (plaisir, fatigue, ce qu'elles veulent plus). */
export async function getSurveyTrend(days = 28): Promise<SurveySummary & { practices: number; coachNames: { name: string; count: number }[]; peerNames: { name: string; count: number }[] }> {
  const from = addDays(todayIso(), -days);
  const { data } = await db()
    .from("activity_player_attendance")
    .select("activity_id, practice_rating, fatigue, learning, understanding, confidence, coach_helped, coach_helpers, peer_helped, peer_helpers, wants_more, wants_more_note, activity:coach_activities!inner(activity_date)")
    .gte("activity.activity_date", from)
    .not("feedback_at", "is", null);
  const rows = (data ?? []) as any[];
  const summary = summarizeSurvey(rows);
  // Les noms : prénom des coachs ; prénom + initiale des filles (admin seulement).
  const coachIds = Object.keys(summary.coachMentions);
  const peerIds = Object.keys(summary.peerMentions);
  const [{ data: coaches }, { data: regs }] = await Promise.all([
    coachIds.length ? db().from("coaches").select("id, first_name").in("id", coachIds) : Promise.resolve({ data: [] }),
    peerIds.length ? db().from("registrations").select("id, player_first_name, player_last_name").in("id", peerIds) : Promise.resolve({ data: [] })
  ]);
  const cap = (x: string) => x.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  const coachName = new Map(((coaches ?? []) as any[]).map((c) => [c.id, cap(String(c.first_name ?? ""))] as const));
  const peerName = new Map(((regs ?? []) as any[]).map((r) => [r.id, `${cap(String(r.player_first_name ?? ""))} ${String(r.player_last_name ?? "").trim().charAt(0).toUpperCase()}.`] as const));
  const named = (m: Record<string, number>, names: Map<string, string>) =>
    Object.entries(m).map(([id, count]) => ({ name: names.get(id) ?? "?", count })).filter((x) => x.name !== "?").sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
  return { ...summary, practices: new Set(rows.map((r) => r.activity_id)).size, coachNames: named(summary.coachMentions, coachName), peerNames: named(summary.peerMentions, peerName) };
}

export interface SurveyDashboard {
  weeks: SurveyWeek[];
  coaches: (CoachHelpRate & { name: string })[];
}

/** Les courbes (plaisir et fatigue par semaine) et l'aide de chaque coach chiffrée, sur les 10 dernières semaines. */
export async function getSurveyDashboard(weeks = 10): Promise<SurveyDashboard> {
  const from = addDays(todayIso(), -7 * weeks);
  const { data } = await db()
    .from("activity_player_attendance")
    .select("activity_id, practice_rating, fatigue, coach_helped, coach_helpers, peer_helped, activity:coach_activities!inner(activity_date)")
    .gte("activity.activity_date", from)
    .not("feedback_at", "is", null);
  const rows: SurveyRow[] = ((data ?? []) as any[]).map((r) => ({ ...r, date: String(r.activity?.activity_date ?? "").slice(0, 10) }));
  // Les coachs sur le terrain de chaque pratique sondée (assignées, pas absentes), plus celles que les filles ont nommées
  // (groupes fusionnés : la coach d'un groupe voisin à la même heure).
  const asked = rows.filter((r) => r.coach_helped === true || r.coach_helped === false);
  const ids = [...new Set(asked.map((r) => r.activity_id))];
  const byActivity = new Map<string, Set<string>>();
  if (ids.length) {
    const { data: assigns } = await db().from("coach_assignments").select("activity_id, coach_id, status").in("activity_id", ids);
    for (const a of (assigns ?? []) as any[]) {
      if (["absent", "cancelled"].includes(a.status)) continue;
      byActivity.set(a.activity_id, (byActivity.get(a.activity_id) ?? new Set()).add(a.coach_id));
    }
  }
  for (const r of asked) for (const c of r.coach_helpers ?? []) byActivity.set(r.activity_id, (byActivity.get(r.activity_id) ?? new Set()).add(c));
  const rates = coachHelpRates(rows, new Map([...byActivity].map(([k, v]) => [k, [...v]])));
  const { data: coaches } = rates.length ? await db().from("coaches").select("id, first_name").in("id", rates.map((r) => r.coachId)) : { data: [] };
  const name = new Map(((coaches ?? []) as any[]).map((c) => [c.id, String(c.first_name ?? "").trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (x: string) => x.toUpperCase())] as const));
  return { weeks: weeklySeries(rows), coaches: rates.map((r) => ({ ...r, name: name.get(r.coachId) ?? "Coach" })) };
}
