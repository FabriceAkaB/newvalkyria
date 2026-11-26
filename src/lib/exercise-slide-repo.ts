import { DEFAULT_PLACE, EXERCISE_CATEGORIES, EXERCISE_TYPES, type ExerciseType } from "@/lib/exercise-bank";
import type { SlideDraft } from "@/lib/exercise-slide-core";
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

export async function createExerciseFromSlide(draft: SlideDraft, image: File): Promise<{ id: string; imageUrl: string }> {
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
