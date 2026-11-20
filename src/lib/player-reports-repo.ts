import { mergeEvaluations, type CoachEvaluation, type MergedEvaluation } from "@/lib/player-reports";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Rapports des éducateurs sur les joueuses, pour l'admin (Coaching › Pratiques › Rapports des joueuses). */

function db() {
  return getSupabaseAdminClient() as any;
}

const cap = (x: string) => x.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

export interface PlayerReport {
  registrationId: string;
  name: string;
  activityId: string;
  date: string;
  start: string;
  group: string;
  evaluations: CoachEvaluation[];
  merged: MergedEvaluation;
}

/** Une ligne par fille et par pratique, avec la réponse de chaque éducateur et leur moyenne. */
async function load(filter: { since?: string; activityId?: string; registrationId?: string }): Promise<PlayerReport[]> {
  let q = db()
    .from("player_evaluations")
    .select("activity_id, registration_id, coach_id, ratings, comment, gestures, gesture_scores, coach:coaches(first_name), registration:registrations(player_first_name, player_last_name), activity:coach_activities!inner(activity_date, start_time, title, category)")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (filter.since) q = q.gte("activity.activity_date", filter.since);
  if (filter.activityId) q = q.eq("activity_id", filter.activityId);
  if (filter.registrationId) q = q.eq("registration_id", filter.registrationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const groups = new Map<string, PlayerReport>();
  for (const r of (data ?? []) as any[]) {
    const key = `${r.activity_id}|${r.registration_id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        registrationId: r.registration_id,
        name: `${cap(String(r.registration?.player_first_name ?? ""))} ${cap(String(r.registration?.player_last_name ?? ""))}`.trim(),
        activityId: r.activity_id,
        date: String(r.activity?.activity_date ?? "").slice(0, 10),
        start: String(r.activity?.start_time ?? "").slice(0, 5),
        group: String(r.activity?.title || r.activity?.category || "Pratique"),
        evaluations: [],
        merged: mergeEvaluations([])
      };
      groups.set(key, g);
    }
    g.evaluations.push({
      coachId: r.coach_id,
      coachName: cap(String(r.coach?.first_name ?? "Éducateur")),
      ratings: r.ratings ?? {},
      gestureScores: r.gesture_scores ?? {},
      difficult: r.gestures ?? [],
      comment: r.comment ? String(r.comment).trim() : null
    });
  }
  for (const g of groups.values()) g.merged = mergeEvaluations(g.evaluations);
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start) || a.name.localeCompare(b.name, "fr"));
}

export interface ReportPractice {
  activityId: string;
  date: string;
  start: string;
  group: string;
  players: number;
  coaches: string[];
  /** Filles évaluées par deux éducateurs ou plus. */
  doubled: number;
}

/** Les pratiques évaluées des N derniers jours, la plus récente d'abord. */
export async function listReportPractices(days = 28): Promise<{ practices: ReportPractice[]; reports: PlayerReport[] }> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const reports = await load({ since });
  const by = new Map<string, ReportPractice>();
  for (const r of reports) {
    const p = by.get(r.activityId) ?? { activityId: r.activityId, date: r.date, start: r.start, group: r.group, players: 0, coaches: [], doubled: 0 };
    p.players += 1;
    if (r.evaluations.length > 1) p.doubled += 1;
    for (const e of r.evaluations) if (!p.coaches.includes(e.coachName)) p.coaches.push(e.coachName);
    by.set(r.activityId, p);
  }
  return { practices: [...by.values()].sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start)), reports };
}

export const getPracticeReports = (activityId: string) => load({ activityId });
export const getPlayerReports = (registrationId: string) => load({ registrationId });
