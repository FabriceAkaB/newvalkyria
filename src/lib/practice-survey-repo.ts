import { getActivityAttendance, getActivityRoster, type PlayerAttendance, type RosterPlayer } from "@/lib/coach-portal-repo";
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
  present: number;
  answered: number;
}

/** Les pratiques de l'Académie d'aujourd'hui et des 7 derniers jours, avec où en est leur sondage. */
export async function getRecentPracticesForSurvey(): Promise<SurveyPractice[]> {
  const today = todayIso();
  const practices = (await listPractices({ from: addDays(today, -7), to: today })).filter((p) => !p.organization && p.source !== "programme" && p.activityType !== "Match");
  const ids = practices.map((p) => p.activityId).filter((x): x is string => Boolean(x));
  const { data } = ids.length ? await db().from("activity_player_attendance").select("activity_id, status, practice_rating, fatigue").in("activity_id", ids) : { data: [] };
  const rows = (data ?? []) as any[];
  return practices
    .map((p) => {
      const mine = rows.filter((r) => r.activity_id === p.activityId && HERE.includes(r.status));
      return { ...p, present: mine.length, answered: mine.filter((r) => r.practice_rating != null && r.fatigue != null).length };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
}

/** Ouvre le sondage d'une pratique de l'horaire : crée son activité si elle n'existe pas encore. */
export async function openSurveyActivity(key: string): Promise<string | null> {
  const today = todayIso();
  const practice = (await listPractices({ from: addDays(today, -7), to: today })).find((p) => p.key === key);
  if (!practice) return null;
  if (practice.activityId) return practice.activityId;
  return createActivityFor({ date: practice.date, start: practice.start, end: practice.end, location: practice.location, group: practice.group });
}

export interface SurveyData {
  activity: CoachActivity;
  roster: RosterPlayer[];
  attendance: PlayerAttendance[];
}

export async function getSurveyData(activityId: string): Promise<SurveyData | null> {
  const activity = await getActivity(activityId);
  if (!activity) return null;
  const [roster, attendance] = await Promise.all([getActivityRoster(activity), getActivityAttendance(activityId)]);
  return { activity, roster, attendance };
}

export const answerOf = (a: PlayerAttendance): SurveyAnswer => ({
  practiceRating: a.practice_rating ?? null,
  fatigue: a.fatigue ?? null,
  wantsMore: a.wants_more ?? [],
  wantsMoreNote: a.wants_more_note ?? null
});

/** Ce que les filles ont dit sur les 4 dernières semaines (plaisir, fatigue, ce qu'elles veulent plus). */
export async function getSurveyTrend(days = 28): Promise<SurveySummary & { practices: number }> {
  const from = addDays(todayIso(), -days);
  const { data } = await db()
    .from("activity_player_attendance")
    .select("activity_id, practice_rating, fatigue, wants_more, wants_more_note, activity:coach_activities!inner(activity_date)")
    .gte("activity.activity_date", from)
    .not("feedback_at", "is", null);
  const rows = (data ?? []) as any[];
  return { ...summarizeSurvey(rows), practices: new Set(rows.map((r) => r.activity_id)).size };
}
