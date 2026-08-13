import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const SESSION_BLOCK_TYPES = [
  "Échauffement", "Ball mastery", "Exercice technique", "Exercice tactique", "Jeu réduit", "Match", "Retour au calme", "Autre"
] as const;

export interface SessionBlock {
  id: string;
  activity_id: string;
  block_order: number;
  block_type: string;
  exercise_id: string | null;
  custom_title: string | null;
  duration_minutes: number;
  notes: string | null;
}

export async function getBlocksForActivity(activityId: string): Promise<SessionBlock[]> {
  const { data, error } = await db().from("activity_session_blocks").select("*").eq("activity_id", activityId).order("block_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionBlock[];
}

export async function addBlock(activityId: string, input: {
  blockType: string;
  exerciseId: string | null;
  customTitle: string | null;
  durationMinutes: number;
  notes: string | null;
}): Promise<string> {
  const supabase = db();
  const { data: existing, error: countErr } = await supabase
    .from("activity_session_blocks")
    .select("block_order")
    .eq("activity_id", activityId)
    .order("block_order", { ascending: false })
    .limit(1);
  if (countErr) throw new Error(countErr.message);
  const nextOrder = existing && existing.length > 0 ? existing[0].block_order + 1 : 0;

  const { data, error } = await supabase
    .from("activity_session_blocks")
    .insert({
      activity_id: activityId,
      block_order: nextOrder,
      block_type: input.blockType,
      exercise_id: input.exerciseId,
      custom_title: input.customTitle,
      duration_minutes: input.durationMinutes,
      notes: input.notes
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateBlock(id: string, patch: Partial<{ blockType: string; exerciseId: string | null; customTitle: string | null; durationMinutes: number; notes: string | null; blockOrder: number }>): Promise<void> {
  const columnPatch: Record<string, unknown> = {};
  if (patch.blockType !== undefined) columnPatch.block_type = patch.blockType;
  if (patch.exerciseId !== undefined) columnPatch.exercise_id = patch.exerciseId;
  if (patch.customTitle !== undefined) columnPatch.custom_title = patch.customTitle;
  if (patch.durationMinutes !== undefined) columnPatch.duration_minutes = patch.durationMinutes;
  if (patch.notes !== undefined) columnPatch.notes = patch.notes;
  if (patch.blockOrder !== undefined) columnPatch.block_order = patch.blockOrder;

  const { error } = await db().from("activity_session_blocks").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBlock(id: string): Promise<void> {
  const { error } = await db().from("activity_session_blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Échange l'ordre entre deux blocs adjacents — pas de drag-and-drop,
 *  juste monter/descendre, suffisant pour une poignée de blocs par séance. */
export async function swapBlockOrder(activityId: string, blockId: string, direction: "up" | "down"): Promise<void> {
  const blocks = await getBlocksForActivity(activityId);
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= blocks.length) return;

  const a = blocks[index];
  const b = blocks[swapIndex];
  await Promise.all([updateBlock(a.id, { blockOrder: b.block_order }), updateBlock(b.id, { blockOrder: a.block_order })]);
}
