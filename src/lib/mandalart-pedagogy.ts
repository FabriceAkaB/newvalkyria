import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Saison pédagogique (pilier 1) : ce qui a été fait sur le terrain pendant un mois, à partir des
 *  activités entrées dans Équipe → Entraînements (coach_activities), des matchs (match_details),
 *  des thèmes de la semaine (season_themes), des présences des éducateurs (coach_assignments)
 *  et des évaluations de joueuses (player_evaluations). Aucune nouvelle table. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PedagogyActivity {
  id: string;
  date: string;
  start: string | null;
  end: string | null;
  type: string;
  title: string;
  category: string | null;
  location: string | null;
  opponent: string | null;
  homeAway: string | null;
  score: string | null;
  blocks: number;
  evaluations: number;
  coaches: number;
  coachesConfirmed: number;
}

export interface PedagogyMonth {
  month: string;
  activities: PedagogyActivity[];
  themes: { week: string; theme: string; notes: string | null }[];
  byType: { type: string; count: number }[];
  hours: number;
  withPlan: number;
  withEvaluations: number;
  unconfirmedCoaches: number;
}

export async function getPedagogyMonth(month: string): Promise<PedagogyMonth> {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const { data: acts } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, end_time, location, category, activity_type, title")
    .gte("activity_date", start)
    .lte("activity_date", end)
    .order("activity_date")
    .order("start_time");
  const ids = (acts ?? []).map((a: any) => a.id);
  const pick = async (table: string, cols: string) => (ids.length ? ((await db().from(table).select(cols).in("activity_id", ids)).data ?? []) : []);
  const [matches, blocks, evals, assigns, themesRes] = await Promise.all([
    pick("match_details", "activity_id, opponent_name, home_away, final_score_us, final_score_them"),
    pick("activity_session_blocks", "activity_id"),
    pick("player_evaluations", "activity_id"),
    pick("coach_assignments", "activity_id, confirmed, status"),
    db().from("season_themes").select("week_start_date, theme, notes").gte("week_start_date", start).lte("week_start_date", end).order("week_start_date")
  ]);
  const activities: PedagogyActivity[] = (acts ?? []).map((a: any) => {
    const md = matches.find((x: any) => x.activity_id === a.id);
    const as = assigns.filter((x: any) => x.activity_id === a.id && x.status !== "cancelled");
    return {
      id: a.id,
      date: String(a.activity_date).slice(0, 10),
      start: a.start_time ? String(a.start_time).slice(0, 5) : null,
      end: a.end_time ? String(a.end_time).slice(0, 5) : null,
      type: a.activity_type,
      title: a.title || a.activity_type,
      category: a.category,
      location: a.location,
      opponent: md?.opponent_name ?? null,
      homeAway: md?.home_away ?? null,
      score: md && md.final_score_us !== null && md.final_score_them !== null ? `${md.final_score_us}-${md.final_score_them}` : null,
      blocks: blocks.filter((x: any) => x.activity_id === a.id).length,
      evaluations: evals.filter((x: any) => x.activity_id === a.id).length,
      coaches: as.length,
      coachesConfirmed: as.filter((x: any) => x.confirmed).length
    };
  });
  const types = new Map<string, number>();
  for (const a of activities) types.set(a.type, (types.get(a.type) ?? 0) + 1);
  const minutes = activities.reduce((s, a) => {
    if (!a.start || !a.end) return s;
    const [h1, m1] = a.start.split(":").map(Number);
    const [h2, m2] = a.end.split(":").map(Number);
    return s + Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
  }, 0);
  return {
    month,
    activities,
    themes: (themesRes.data ?? []).map((t: any) => ({ week: String(t.week_start_date).slice(0, 10), theme: t.theme, notes: t.notes })),
    byType: [...types.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    hours: Math.round((minutes / 60) * 10) / 10,
    withPlan: activities.filter((a) => a.blocks > 0).length,
    withEvaluations: activities.filter((a) => a.evaluations > 0).length,
    unconfirmedCoaches: activities.reduce((s, a) => s + (a.coaches - a.coachesConfirmed), 0)
  };
}
