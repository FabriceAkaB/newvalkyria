import { seasonDates } from "@/lib/bulletin-report";
import { getPlayerAttendanceHistory, getPlayerEvaluations } from "@/lib/coach-portal-repo";
import { summarizeSeason, type SeasonSummary, type SummaryAttendance, type SummaryEval } from "@/lib/season-summary";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Lecture du résumé de saison d'une joueuse (P1.2.10). Règles : season-summary.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

const day = (v: unknown) => String(v ?? "").slice(0, 10);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** Les lignes déjà chargées (getPlayerEvaluations, getPlayerAttendanceHistory) au format du résumé : le bulletin
 *  s'en sert sans relire la base. */
export function toSummaryEvals(evaluations: any[]): SummaryEval[] {
  return evaluations.map((e) => ({
    date: day(e.activity?.activity_date),
    coachId: e.coach_id ?? null,
    ratings: e.ratings ?? null,
    gestureScores: e.gesture_scores ?? null,
    gestures: Array.isArray(e.gestures) ? e.gestures : null,
    comment: e.comment ?? null
  }));
}
export function toSummaryAttendance(attendance: any[]): SummaryAttendance[] {
  return attendance.map((a) => ({ date: day(a.activity?.activity_date), status: String(a.status) }));
}

/** Le résumé de la saison de l'inscription, du début de la saison à aujourd'hui (ou entre deux dates). */
export async function getSeasonSummary(registrationId: string, opts: { audience: "equipe" | "parent"; from?: string; to?: string }): Promise<SeasonSummary | null> {
  const { data: reg } = await db().from("registrations").select("id, season_id").eq("id", registrationId).maybeSingle();
  if (!reg) return null;
  const [evaluations, attendance, { data: objectives }] = await Promise.all([
    getPlayerEvaluations(registrationId),
    getPlayerAttendanceHistory(registrationId),
    db().from("player_objectives").select("objective, active").eq("registration_id", registrationId).order("created_at")
  ]);
  return summarizeSeason({
    evaluations: toSummaryEvals(evaluations),
    attendance: toSummaryAttendance(attendance),
    objectives: ((objectives ?? []) as any[]).map((o) => ({ text: String(o.objective), active: Boolean(o.active) })),
    from: opts.from ?? seasonDates(reg.season_id).start,
    to: opts.to ?? today(),
    observations: opts.audience !== "parent"
  });
}
