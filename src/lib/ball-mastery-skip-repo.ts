import { ballMasteryState, withoutSkippedGestures } from "@/lib/ball-mastery-skip";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** « Le ball mastery n'a pas été fait » : lecture (règles dans ball-mastery-skip.ts). La réponse se donne dans
 *  « Exercices prévus : faits ? » (planned-exercises-repo.ts), à la ligne du bloc ball mastery. */

function db() {
  return getSupabaseAdminClient() as any;
}

async function exerciseTypes(ids: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await db().from("exercises").select("id, exercise_type").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as any[]).map((e) => [e.id as string, (e.exercise_type as string | null) ?? null]));
}

/** Les pratiques où le ball mastery n'a pas été fait (toutes, ou parmi `activityIds`). Peu de blocs sont « pas faits » :
 *  on part de ceux-là, puis on vérifie que tous les blocs de ball mastery de la pratique le sont. */
export async function getSkippedBallMasteryActivities(activityIds?: string[]): Promise<Set<string>> {
  let q = db().from("activity_session_blocks").select("activity_id").eq("not_done", true);
  if (activityIds) {
    const unique = [...new Set(activityIds.filter(Boolean))];
    if (!unique.length) return new Set();
    if (unique.length <= 200) q = q.in("activity_id", unique);
  }
  const { data: flagged, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  const candidates = [...new Set(((flagged ?? []) as any[]).map((b) => b.activity_id as string))].filter((id) => !activityIds || activityIds.includes(id));
  if (!candidates.length) return new Set();
  const { data: blocks, error: bError } = await db().from("activity_session_blocks").select("activity_id, block_type, exercise_id, not_done").in("activity_id", candidates);
  if (bError) throw new Error(bError.message);
  const types = await exerciseTypes(((blocks ?? []) as any[]).map((b) => b.exercise_id));
  const out = new Set<string>();
  for (const id of candidates) {
    const own = ((blocks ?? []) as any[]).filter((b) => b.activity_id === id);
    if (ballMasteryState(own, (x) => types.get(x)).skipped) out.add(id);
  }
  return out;
}

/** Retire les gestes du ball mastery des évaluations des pratiques où il n'a pas été fait (lecture seulement). */
export async function stripSkippedGestures<T extends { activity_id?: string | null; gesture_scores?: Record<string, number> | null; gestures?: string[] | null }>(evaluations: T[]): Promise<T[]> {
  if (!evaluations.some((e) => e.gesture_scores && Object.keys(e.gesture_scores).length)) return evaluations;
  const skipped = await getSkippedBallMasteryActivities(evaluations.map((e) => String(e.activity_id ?? ""))).catch(() => new Set<string>());
  if (!skipped.size) return evaluations;
  return evaluations.map((e) => withoutSkippedGestures(e, skipped.has(String(e.activity_id ?? ""))));
}

export async function isBallMasterySkipped(activityId: string): Promise<boolean> {
  return (await getSkippedBallMasteryActivities([activityId])).has(activityId);
}
