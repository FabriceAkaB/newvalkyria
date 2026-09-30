import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const EXERCISE_CATEGORIES = [
  "Contrôle", "Passe", "Conduite", "1v1", "Finition", "Transition", "Jeu entre les lignes", "Prise d'information", "Autre"
] as const;

export const EXERCISE_LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Tous niveaux"] as const;

export const DIAGRAM_ELEMENT_TYPES = ["player", "player-alt", "cone", "ball"] as const;
export type DiagramElementType = (typeof DIAGRAM_ELEMENT_TYPES)[number];

export const DIAGRAM_ARROW_TYPES = ["movement", "pass", "dribble"] as const;
export type DiagramArrowType = (typeof DIAGRAM_ARROW_TYPES)[number];

export interface DiagramElement {
  id: string;
  type: DiagramElementType;
  /** Pourcentage (0-100) de la largeur/hauteur du terrain affiché. */
  x: number;
  y: number;
  label?: string;
}

export interface DiagramArrow {
  id: string;
  type: DiagramArrowType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ExerciseDiagram {
  elements: DiagramElement[];
  arrows: DiagramArrow[];
}

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
  diagram_data: ExerciseDiagram | null;
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

/** Schéma visuel (constructeur glisser-déposer) — séparé de updateExercise
 *  pour permettre à un entraîneur d'illustrer un exercice existant sans lui
 *  donner le droit de modifier son texte (titre, consignes...). */
export async function setExerciseDiagram(id: string, diagram: ExerciseDiagram | null): Promise<void> {
  const { error } = await db().from("exercises").update({ diagram_data: diagram, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Valide la forme d'un schéma envoyé par le client (constructeur visuel) —
 *  retourne null pour "aucun schéma" (effacement), undefined si invalide. */
export function parseExerciseDiagram(body: unknown): ExerciseDiagram | null | undefined {
  if (body === null) return null;
  if (typeof body !== "object") return undefined;
  const { elements, arrows } = body as Record<string, unknown>;
  if (!Array.isArray(elements) || !Array.isArray(arrows)) return undefined;

  const validElements: DiagramElement[] = [];
  for (const el of elements) {
    if (!el || typeof el !== "object") return undefined;
    const { id, type, x, y, label } = el as Record<string, unknown>;
    if (typeof id !== "string" || typeof x !== "number" || typeof y !== "number") return undefined;
    if (!(DIAGRAM_ELEMENT_TYPES as readonly string[]).includes(type as string)) return undefined;
    validElements.push({ id, type: type as DiagramElementType, x, y, ...(typeof label === "string" ? { label } : {}) });
  }

  const validArrows: DiagramArrow[] = [];
  for (const ar of arrows) {
    if (!ar || typeof ar !== "object") return undefined;
    const { id, type, x1, y1, x2, y2 } = ar as Record<string, unknown>;
    if (typeof id !== "string" || typeof x1 !== "number" || typeof y1 !== "number" || typeof x2 !== "number" || typeof y2 !== "number") return undefined;
    if (!(DIAGRAM_ARROW_TYPES as readonly string[]).includes(type as string)) return undefined;
    validArrows.push({ id, type: type as DiagramArrowType, x1, y1, x2, y2 });
  }

  return { elements: validElements, arrows: validArrows };
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
