import { ballMasteryState, isBallMasteryBlock, withoutSkippedGestures } from "@/lib/ball-mastery-skip";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** « Le ball mastery n'a pas été fait » : lecture et écriture (règles dans ball-mastery-skip.ts). */

function db() {
  return getSupabaseAdminClient() as any;
}

const NOTE = "Ball mastery pas fait cette journée-là";

async function exerciseTypes(ids: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await db().from("exercises").select("id, exercise_type").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as any[]).map((e) => [e.id as string, (e.exercise_type as string | null) ?? null]));
}

export interface BallMasteryStatus {
  planned: boolean;
  skipped: boolean;
  /** Réponse à « Ball mastery fait aujourd'hui ? » : « oui », « non » ou null tant que personne n'a répondu
   *  (gestes demandés comme avant). Un bloc marqué « On ne l'a pas fait » dans la note des exercices compte pour « non ». */
  answer: "oui" | "non" | null;
  /** Qui a répondu et quand. */
  byName: string | null;
  at: string | null;
}

export async function getBallMasteryStatus(activityId: string): Promise<BallMasteryStatus> {
  const { data, error } = await db().from("activity_session_blocks").select("id, block_type, exercise_id, not_done, not_done_by, not_done_at").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  const blocks = (data ?? []) as any[];
  const types = await exerciseTypes(blocks.map((b) => b.exercise_id));
  const state = ballMasteryState(blocks, (id) => types.get(id));
  const bm = blocks.filter((b) => isBallMasteryBlock(b, (id) => types.get(id)));
  // « Oui » se garde comme un bloc « fait » avec qui et quand (not_done_by, not_done_at) ; « Non » comme un bloc pas fait.
  const marked = state.skipped ? bm.find((b) => b.not_done) : bm.find((b) => b.not_done_at);
  const answer: BallMasteryStatus["answer"] = state.skipped ? "non" : marked ? "oui" : null;
  let byName: string | null = null;
  if (marked?.not_done_by) {
    const { data: coach } = await db().from("coaches").select("first_name, last_name").eq("id", marked.not_done_by).maybeSingle();
    byName = coach ? `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() || null : null;
  }
  return { ...state, answer, byName, at: marked?.not_done_at ?? null };
}

/** Réponse à « Ball mastery fait aujourd'hui ? » pour toute la pratique (tous ses blocs de ball mastery) :
 *  `skipped` vrai = « Non », faux = « Oui ». Modifiable après coup. */
export async function setBallMasterySkipped(activityId: string, skipped: boolean, byCoachId: string | null): Promise<BallMasteryStatus> {
  const { data, error } = await db().from("activity_session_blocks").select("id, block_type, exercise_id").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  const blocks = (data ?? []) as any[];
  const types = await exerciseTypes(blocks.map((b) => b.exercise_id));
  const ids = blocks.filter((b) => isBallMasteryBlock(b, (id) => types.get(id))).map((b) => b.id as string);
  if (!ids.length) throw new Error("Il n'y a pas de ball mastery dans le plan de cette pratique.");
  const patch = skipped
    ? { not_done: true, not_done_note: NOTE, not_done_by: byCoachId, not_done_at: new Date().toISOString() }
    : { not_done: false, not_done_note: null, not_done_by: byCoachId, not_done_at: new Date().toISOString() };
  const { error: upError } = await db().from("activity_session_blocks").update(patch).in("id", ids);
  if (upError) throw new Error(upError.message);
  return getBallMasteryStatus(activityId);
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
