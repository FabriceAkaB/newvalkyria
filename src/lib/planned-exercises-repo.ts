import { isBallMasteryBlock } from "@/lib/ball-mastery-skip";
import { answerPatch, blockAnswer, blockTitle, plannedSummary, type BlockAnswer, type PlannedSummary } from "@/lib/planned-exercises";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** « Exercices prévus : faits ? » : lecture et écriture de l'état partagé (règles dans planned-exercises.ts). */

function db() {
  return getSupabaseAdminClient() as any;
}

const BM_NOTE = "Ball mastery pas fait cette journée-là";

export interface PlannedBlock {
  id: string;
  order: number;
  title: string;
  blockType: string;
  minutes: number | null;
  ballMastery: boolean;
  answer: BlockAnswer;
  byName: string | null;
  at: string | null;
}

export interface PlannedView {
  blocks: PlannedBlock[];
  summary: PlannedSummary;
  /** Tous les blocs de ball mastery sont « Non » : les gestes ne sont pas demandés (ball-mastery-skip.ts). */
  ballMasterySkipped: boolean;
}

async function exercisesById(ids: string[]): Promise<Map<string, { title: string | null; type: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await db().from("exercises").select("id, title, exercise_type").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as any[]).map((e) => [e.id as string, { title: (e.title as string | null) ?? null, type: (e.exercise_type as string | null) ?? null }]));
}

async function coachNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await db().from("coaches").select("id, first_name, last_name").in("id", unique);
  return new Map(((data ?? []) as any[]).map((c) => [c.id as string, `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()]));
}

function toView(rows: any[], ex: Map<string, { title: string | null; type: string | null }>, names: Map<string, string>): PlannedView {
  const typeOf = (id: string) => ex.get(id)?.type;
  const blocks: PlannedBlock[] = rows.map((b) => {
    const answer = blockAnswer(b);
    return {
      id: b.id,
      order: Number(b.block_order ?? 0),
      title: blockTitle(b, (id) => ex.get(id)?.title),
      blockType: b.block_type ?? "",
      minutes: b.duration_minutes ?? null,
      ballMastery: isBallMasteryBlock(b, typeOf),
      answer,
      byName: answer && b.not_done_by ? names.get(b.not_done_by) || null : null,
      at: answer ? (b.not_done_at ?? null) : null
    };
  });
  const bm = blocks.filter((b) => b.ballMastery);
  return { blocks, summary: plannedSummary(rows), ballMasterySkipped: bm.length > 0 && bm.every((b) => b.answer === "non") };
}

const COLUMNS = "id, activity_id, block_order, block_type, exercise_id, custom_title, duration_minutes, not_done, not_done_by, not_done_at";

export async function getPlannedExercises(activityId: string): Promise<PlannedView> {
  const { data, error } = await db().from("activity_session_blocks").select(COLUMNS).eq("activity_id", activityId).order("block_order");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const [ex, names] = await Promise.all([exercisesById(rows.map((b) => b.exercise_id)), coachNames(rows.map((b) => b.not_done_by))]);
  return toView(rows, ex, names);
}

/** Répond Oui (fait) ou Non (pas fait) pour des blocs de cette pratique ; vaut pour tous ses éducateurs, modifiable. */
export async function setPlannedBlocksDone(activityId: string, blockIds: string[], done: boolean, byCoachId: string | null, note: string | null = null): Promise<PlannedView> {
  const { data, error } = await db().from("activity_session_blocks").select("id, block_type, exercise_id").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const ids = blockIds.filter((id) => rows.some((b) => b.id === id));
  if (!ids.length) throw new Error("Ce bloc n'est pas dans le plan de cette pratique.");
  // Ball mastery pas fait : la note par défaut, comme avant.
  const ex = await exercisesById(rows.map((b) => b.exercise_id));
  const bmIds = new Set(rows.filter((b) => isBallMasteryBlock(b, (x) => ex.get(x)?.type)).map((b) => b.id as string));
  const now = new Date();
  const groups = [ids.filter((id) => bmIds.has(id)), ids.filter((id) => !bmIds.has(id))];
  for (const [i, group] of groups.entries()) {
    if (!group.length) continue;
    const patch = answerPatch(done, byCoachId, note ?? (i === 0 ? BM_NOTE : null), now);
    const { error: upError } = await db().from("activity_session_blocks").update(patch).in("id", group);
    if (upError) throw new Error(upError.message);
  }
  return getPlannedExercises(activityId);
}

/** « On ne l'a pas fait » de la note des exercices : tous les blocs de cet exercice dans la pratique. */
export async function setExerciseDoneInActivity(activityId: string, exerciseId: string, done: boolean, byCoachId: string | null, note: string | null = null): Promise<PlannedView> {
  const { data, error } = await db().from("activity_session_blocks").select("id").eq("activity_id", activityId).eq("exercise_id", exerciseId);
  if (error) throw new Error(error.message);
  return setPlannedBlocksDone(activityId, ((data ?? []) as any[]).map((b) => b.id as string), done, byCoachId, note);
}

/** Réponses partagées des blocs (id du bloc → Oui / Non / rien), pour le rapport journalier. */
export async function getBlockAnswers(activityId: string): Promise<Record<string, BlockAnswer>> {
  const { data, error } = await db().from("activity_session_blocks").select("id, not_done, not_done_at").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as any[]).map((b) => [b.id as string, blockAnswer(b)]));
}

/** Résumé par pratique (rapports en lot : paie, courriel « rapports du jour complets »). */
export async function getPlannedSummaries(activityIds: string[]): Promise<Map<string, PlannedSummary>> {
  const unique = [...new Set(activityIds.filter(Boolean))];
  const out = new Map<string, PlannedSummary>();
  if (!unique.length) return out;
  const rows: any[] = [];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await db().from("activity_session_blocks").select("activity_id, not_done, not_done_at").in("activity_id", unique.slice(i, i + 200));
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as any[]));
  }
  for (const id of unique) out.set(id, plannedSummary(rows.filter((r) => r.activity_id === id)));
  return out;
}

export interface PlannedPractice {
  activityId: string;
  date: string;
  start: string;
  group: string;
  view: PlannedView;
}

/** Suivi de JP : pour chaque pratique de filles de la période, quels exercices prévus ont été faits ou non. */
export async function listPlannedPractices(opts: { from: string; to: string }): Promise<PlannedPractice[]> {
  const { data: acts, error } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, title, category, activity_type, organization")
    .gte("activity_date", opts.from)
    .lte("activity_date", opts.to)
    .in("activity_type", ["Pratique", "Camp"])
    .is("organization", null);
  if (error) throw new Error(error.message);
  const list = ((acts ?? []) as any[]).filter((a) => !/gar[cç]on/i.test(`${a.title ?? ""} ${a.category ?? ""}`));
  if (!list.length) return [];
  const rows: any[] = [];
  const ids = list.map((a) => a.id as string);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: bError } = await db().from("activity_session_blocks").select(COLUMNS).in("activity_id", ids.slice(i, i + 200)).order("block_order");
    if (bError) throw new Error(bError.message);
    rows.push(...((data ?? []) as any[]));
  }
  const [ex, names] = await Promise.all([exercisesById(rows.map((b) => b.exercise_id)), coachNames(rows.map((b) => b.not_done_by))]);
  return list
    .map((a) => ({
      activityId: a.id as string,
      date: String(a.activity_date).slice(0, 10),
      start: String(a.start_time ?? "").slice(0, 5),
      group: (a.title || a.category || "Pratique") as string,
      view: toView(rows.filter((b) => b.activity_id === a.id), ex, names)
    }))
    .filter((p) => p.view.blocks.length > 0)
    .sort((x, y) => `${y.date} ${y.start}`.localeCompare(`${x.date} ${x.start}`));
}
