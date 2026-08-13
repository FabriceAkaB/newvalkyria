import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const EXERCISE_CATEGORIES = [
  "Contrôle", "Passe", "Conduite", "1v1", "Finition", "Transition", "Jeu entre les lignes", "Prise d'information", "Autre"
] as const;

export const EXERCISE_LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Tous niveaux"] as const;

export interface Exercise {
  id: string;
  title: string;
  objective: string | null;
  category: string | null;
  level: string | null;
  duration_minutes: number | null;
  material: string | null;
  min_players: number | null;
  max_players: number | null;
  dimensions: string | null;
  instructions: string | null;
  variants: string | null;
  coaching_points: string | null;
  common_mistakes: string | null;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseInput {
  title: string;
  objective: string | null;
  category: string | null;
  level: string | null;
  durationMinutes: number | null;
  material: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  dimensions: string | null;
  instructions: string | null;
  variants: string | null;
  coachingPoints: string | null;
  commonMistakes: string | null;
  videoUrl: string | null;
}

export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await db().from("exercises").select("*").order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as Exercise[];
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const { data, error } = await db().from("exercises").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Exercise | null;
}

function toColumns(input: ExerciseInput) {
  return {
    title: input.title,
    objective: input.objective,
    category: input.category,
    level: input.level,
    duration_minutes: input.durationMinutes,
    material: input.material,
    min_players: input.minPlayers,
    max_players: input.maxPlayers,
    dimensions: input.dimensions,
    instructions: input.instructions,
    variants: input.variants,
    coaching_points: input.coachingPoints,
    common_mistakes: input.commonMistakes,
    video_url: input.videoUrl
  };
}

export async function createExercise(input: ExerciseInput): Promise<string> {
  const { data, error } = await db().from("exercises").insert(toColumns(input)).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  const { error } = await db().from("exercises").update({ ...toColumns(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await db().from("exercises").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

const IMAGE_BUCKET = "exercise-images";

export async function setExerciseImage(id: string, file: File): Promise<string> {
  const supabase = db();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl as string;

  const { error } = await supabase.from("exercises").update({ image_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return publicUrl;
}
