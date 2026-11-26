import { createHash } from "node:crypto";

import { DEFAULT_PLACE, EXERCISE_CATEGORIES, EXERCISE_TYPES, type ExerciseType } from "@/lib/exercise-bank";
import { findDuplicateExercise, type SlideDraft } from "@/lib/exercise-slide-core";
import { createExercise, setExerciseImage, type ExerciseInput } from "@/lib/exercises-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Ajout d'un exercice par sa diapo : la fiche est créée avec ce que la lecture a trouvé, la diapo devient son image. */

export function draftToInput(d: SlideDraft): ExerciseInput {
  return {
    title: d.title,
    objective: d.objective,
    category: d.category,
    level: d.level,
    durationMinutes: d.durationMinutes,
    material: d.material,
    minPlayers: d.minPlayers,
    maxPlayers: d.maxPlayers,
    dimensions: d.dimensions,
    instructions: d.instructions,
    variants: d.variants,
    coachingPoints: d.coachingPoints,
    commonMistakes: null,
    videoUrl: null,
    exerciseType: d.exerciseType,
    sessionPlace: d.sessionPlace,
    ageGroups: d.ageGroups,
    variantEasier: d.variantEasier,
    variantHarder: d.variantHarder,
    progression: d.progression,
    author: "JP (diapo)"
  };
}

/** La diapo (ou le titre) est déjà dans la banque : rien n'est créé. */
export class DuplicateExerciseError extends Error {
  constructor(public readonly existing: { id: string; title: string }) {
    super(`Déjà dans la banque : « ${existing.title} ». Rien n'a été ajouté.`);
  }
}

export async function createExerciseFromSlide(draft: SlideDraft, image: File, opts: { force?: boolean } = {}): Promise<{ id: string; imageUrl: string }> {
  if (!opts.force) {
    const imageHash = createHash("sha256").update(Buffer.from(await image.arrayBuffer())).digest("hex");
    const { data, error } = await (getSupabaseAdminClient() as any).from("exercises").select("id, title, image_hash");
    if (error) throw new Error(error.message);
    const dup = findDuplicateExercise({ title: draft.title, imageHash }, (data ?? []) as { id: string; title: string; image_hash: string | null }[]);
    if (dup) throw new DuplicateExerciseError({ id: dup.id, title: dup.title });
  }
  const id = await createExercise(draftToInput(draft));
  const imageUrl = await setExerciseImage(id, image);
  return { id, imageUrl };
}

/** Correction rapide de JP après la lecture : titre, chapitre (thème) et catégorie (type). La place dans la séance suit le type. */
export async function setExerciseClassification(id: string, patch: { title?: string; category?: string; exerciseType?: string | null }): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString(), content_updated_at: new Date().toISOString() };
  if (typeof patch.title === "string" && patch.title.trim()) row.title = patch.title.trim().slice(0, 120);
  if (typeof patch.category === "string" && (EXERCISE_CATEGORIES as readonly string[]).includes(patch.category)) row.category = patch.category;
  if (patch.exerciseType === null || (typeof patch.exerciseType === "string" && EXERCISE_TYPES.some((t) => t.key === patch.exerciseType))) {
    row.exercise_type = patch.exerciseType;
    row.session_place = patch.exerciseType ? (DEFAULT_PLACE[patch.exerciseType as ExerciseType] ?? null) : null;
  }
  const { error } = await (getSupabaseAdminClient() as any).from("exercises").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}
