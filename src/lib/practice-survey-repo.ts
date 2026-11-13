import { getActivityAttendance, getActivityRoster, loadRosterSources, rosterForActivity, type PlayerAttendance, type RosterPlayer } from "@/lib/coach-portal-repo";
import { getActivity, type CoachActivity } from "@/lib/coaches-repo";
import { summarizeSurvey, type SurveyAnswer, type SurveySummary } from "@/lib/practice-survey";
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

async function academyPractices(from: string, to: string): Promise<Practice[]> {
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
  const practice = (await academyPractices(addDays(today, -7), today)).find((p) => p.key === key);
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
  const roster = [...byId.values()].sort((a, b) => Number(a.isTrial) - Number(b.isTrial) || a.firstName.localeCompare(b.firstName, "fr"));
  const label = groups.filter(Boolean).length ? `Filles ${groups.filter(Boolean).join(" et ")}` : activity.title || activity.category || activity.activity_type;
  return { activity, roster, attendance, label };
}

export const answerOf = (a: PlayerAttendance): SurveyAnswer => ({
  practiceRating: a.practice_rating ?? null,
  fatigue: a.fatigue ?? null,
  wantsMore: a.wants_more ?? [],
  wantsMoreNote: a.wants_more_note ?? null,
  learning: a.learning ?? null,
  understanding: a.understanding ?? null,
  confidence: a.confidence ?? null
});

/** Ce que les filles ont dit sur les 4 dernières semaines (plaisir, fatigue, ce qu'elles veulent plus). */
export async function getSurveyTrend(days = 28): Promise<SurveySummary & { practices: number }> {
  const from = addDays(todayIso(), -days);
  const { data } = await db()
    .from("activity_player_attendance")
    .select("activity_id, practice_rating, fatigue, learning, understanding, confidence, wants_more, wants_more_note, activity:coach_activities!inner(activity_date)")
    .gte("activity.activity_date", from)
    .not("feedback_at", "is", null);
  const rows = (data ?? []) as any[];
  return { ...summarizeSurvey(rows), practices: new Set(rows.map((r) => r.activity_id)).size };
}
