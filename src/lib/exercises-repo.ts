import { createHash } from "node:crypto";

import { checklistSummary, compareBank, computeBankStatus, planningAvailability, type BankSummary, type RatingLite, type RatingScores } from "@/lib/exercise-bank";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export { EXERCISE_CATEGORIES, EXERCISE_LEVELS } from "@/lib/exercise-bank";

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
  /** Dernier changement du contenu (pas des notes ni de la validation). */
  content_updated_at?: string | null;
  /** Calculé à partir des notes des éducateurs (pas une colonne), voir exercise-bank.ts. */
  bank?: BankSummary;
  /** Calculé pour une séance donnée : peut-on le mettre dans le plan ? */
  planning?: { ok: boolean; reason?: string };
}

/** Fiche complète de la banque Valkyria (colonnes ajoutées le 2 nov. 2026, P1.3.12 à P1.3.17). */
export interface ExerciseFiche extends Exercise {
  exercise_type: string | null;
  session_place: string | null;
  age_groups: string[];
  venue: string | null;
  setup_5_7: string | null;
  setup_8_10: string | null;
  setup_11_16: string | null;
  variant_easier: string | null;
  variant_harder: string | null;
  variant_cognitive: string | null;
  progression: string | null;
  physical_metrics: string | null;
  author: string | null;
  created_by_coach_id: string | null;
  version: number;
  version_history: { version: number; at: string; note: string | null }[];
  validated_version: number | null;
  validated_at: string | null;
  retired_at: string | null;
  retired_reason: string | null;
  /** Exercice phare de JP (« JP référence », 26 nov. 2026) : posé par JP seulement, distinct de la validation. */
  jp_reference_at?: string | null;
  jp_reference_note?: string | null;
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
  exerciseType?: string | null;
  sessionPlace?: string | null;
  ageGroups?: string[];
  venue?: string | null;
  setup57?: string | null;
  setup810?: string | null;
  setup1116?: string | null;
  variantEasier?: string | null;
  variantHarder?: string | null;
  variantCognitive?: string | null;
  progression?: string | null;
  physicalMetrics?: string | null;
  author?: string | null;
}

/** Lit le corps JSON envoyé par la fiche (admin) ou le formulaire rapide (portail entraîneur). */
export function parseExerciseBody(body: Record<string, unknown>): ExerciseInput {
  const text = (k: string) => (typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : null);
  const int = (k: string) => (typeof body[k] === "number" && Number.isFinite(body[k]) ? Math.round(body[k] as number) : null);
  const input: ExerciseInput = {
    title: String(body.title ?? "").trim(),
    objective: text("objective"),
    category: text("category"),
    level: text("level"),
    durationMinutes: int("durationMinutes"),
    material: text("material"),
    minPlayers: int("minPlayers"),
    maxPlayers: int("maxPlayers"),
    dimensions: text("dimensions"),
    instructions: text("instructions"),
    variants: text("variants"),
    coachingPoints: text("coachingPoints"),
    commonMistakes: text("commonMistakes"),
    videoUrl: text("videoUrl")
  };
  const optional: [keyof ExerciseInput, string][] = [
    ["exerciseType", "exerciseType"], ["sessionPlace", "sessionPlace"], ["venue", "venue"], ["setup57", "setup57"], ["setup810", "setup810"], ["setup1116", "setup1116"],
    ["variantEasier", "variantEasier"], ["variantHarder", "variantHarder"], ["variantCognitive", "variantCognitive"], ["progression", "progression"],
    ["physicalMetrics", "physicalMetrics"], ["author", "author"]
  ];
  for (const [key, field] of optional) if (field in body) (input as unknown as Record<string, unknown>)[key] = text(field);
  if (Array.isArray(body.ageGroups)) input.ageGroups = body.ageGroups.filter((a): a is string => typeof a === "string");
  return input;
}

export async function getExercises(): Promise<ExerciseFiche[]> {
  const { data, error } = await db().from("exercises").select("*").order("title");
  if (error) throw new Error(error.message);
  return (data ?? []) as ExerciseFiche[];
}

export async function getExercise(id: string): Promise<ExerciseFiche | null> {
  const { data, error } = await db().from("exercises").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ExerciseFiche | null;
}

function toColumns(input: ExerciseInput) {
  const extra: Record<string, unknown> = {};
  const map: [keyof ExerciseInput, string][] = [
    ["exerciseType", "exercise_type"], ["sessionPlace", "session_place"], ["ageGroups", "age_groups"], ["venue", "venue"], ["setup57", "setup_5_7"], ["setup810", "setup_8_10"],
    ["setup1116", "setup_11_16"], ["variantEasier", "variant_easier"], ["variantHarder", "variant_harder"], ["variantCognitive", "variant_cognitive"],
    ["progression", "progression"], ["physicalMetrics", "physical_metrics"], ["author", "author"]
  ];
  for (const [key, column] of map) if (input[key] !== undefined) extra[column] = input[key];
  return {
    ...extra,
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

export async function createExercise(input: ExerciseInput, opts: { coachId?: string | null } = {}): Promise<string> {
  const { data, error } = await db()
    .from("exercises")
    .insert({ ...toColumns(input), created_by_coach_id: opts.coachId ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** `newVersion` : l'exercice a été changé (après une note sous 8, par exemple) ; la version
 *  augmente et les notes repartent à zéro. Sans `newVersion` : petite correction, mêmes notes. */
export async function updateExercise(id: string, input: ExerciseInput, opts: { newVersion?: boolean; versionNote?: string | null } = {}): Promise<{ version: number }> {
  const columns: Record<string, unknown> = { ...toColumns(input), updated_at: new Date().toISOString(), content_updated_at: new Date().toISOString() };
  const current = await getExercise(id);
  if (!current) throw new Error("Exercice introuvable");
  let version = current.version ?? 1;
  if (opts.newVersion) {
    version += 1;
    columns.version = version;
    columns.version_history = [...(current.version_history ?? []), { version, at: new Date().toISOString(), note: opts.versionNote?.trim() || null }];
    columns.retired_at = null;
    columns.retired_reason = null;
  }
  const { error } = await db().from("exercises").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
  return { version };
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
  // Empreinte de la diapo : la Bible montre une seule fois les exercices qui ont la même (exercise-book-core.ts).
  const imageHash = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");

  const { error } = await supabase.from("exercises").update({ image_url: publicUrl, image_hash: imageHash, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return publicUrl;
}

/* ── Banque Valkyria : notes, statut, validation de JP ─────────────────────────────── */

export interface ExerciseRating extends RatingLite {
  id: string;
  exercise_id: string;
  activity_id: string | null;
  rater_name: string | null;
  scores: RatingScores;
  comment: string | null;
  updated_at: string;
}

export async function getRatings(exerciseIds?: string[]): Promise<ExerciseRating[]> {
  let q = db().from("exercise_ratings").select("*").order("created_at");
  if (exerciseIds) {
    if (!exerciseIds.length) return [];
    q = q.in("exercise_id", exerciseIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExerciseRating[];
}

export interface BankEntry extends ExerciseFiche {
  bank: BankSummary;
  sheet: { done: number; total: number; missing: string[] };
}

function toEntry(e: ExerciseFiche, ratings: ExerciseRating[]): BankEntry {
  const sheet = checklistSummary(e);
  return { ...e, bank: computeBankStatus(e, ratings), sheet: { done: sheet.done, total: sheet.total, missing: sheet.missing.map((m) => m.label) } };
}

/** Toute la banque avec le statut calculé, les « top exercices » d'abord. */
export async function getBank(): Promise<{ entries: BankEntry[]; ratings: ExerciseRating[] }> {
  const [exercises, ratings] = await Promise.all([getExercises(), getRatings()]);
  const byExercise = new Map<string, ExerciseRating[]>();
  for (const r of ratings) byExercise.set(r.exercise_id, [...(byExercise.get(r.exercise_id) ?? []), r]);
  const entries = exercises.map((e) => toEntry(e, byExercise.get(e.id) ?? [])).sort(compareBank);
  return { entries, ratings };
}

export async function getBankEntry(id: string): Promise<{ entry: BankEntry; ratings: ExerciseRating[] } | null> {
  const [exercise, ratings] = await Promise.all([getExercise(id), getRatings([id])]);
  if (!exercise) return null;
  return { entry: toEntry(exercise, ratings), ratings };
}

/** Exercices proposés dans le plan d'une séance, approuvés d'abord. Ceux qui ne peuvent pas y aller
 *  (retirés, « à changer », notés sous 8 la même semaine) sont retirés de la liste, sauf s'ils sont
 *  déjà dans un bloc de cette séance (`keepIds`), pour que le plan garde leur titre. */
export async function getExercisesForPlanning(activityDate: string, keepIds: (string | null)[] = []): Promise<ExerciseFiche[]> {
  const { entries, ratings } = await getBank();
  return entries
    .map((e) => ({ ...e, planning: planningAvailability(e.bank, ratings.filter((r) => r.exercise_id === e.id), activityDate) }))
    .filter((e) => e.planning.ok || keepIds.includes(e.id));
}

/** Refuse un exercice qui ne peut pas aller dans cette séance (retiré, à changer, noté sous 8 la même semaine). */
export async function assertExerciseUsable(exerciseId: string | null | undefined, activityId: string): Promise<void> {
  if (!exerciseId) return;
  const [{ data: activity }, found] = await Promise.all([db().from("coach_activities").select("activity_date").eq("id", activityId).maybeSingle(), getBankEntry(exerciseId)]);
  if (!found || !activity) return;
  const availability = planningAvailability(found.entry.bank, found.ratings, String(activity.activity_date).slice(0, 10));
  if (!availability.ok) throw new Error(availability.reason);
}

/** Note sur 10 d'un éducateur pour un exercice utilisé dans une séance ; une seule par séance
 *  (la modifier garde la version notée au départ). */
export async function saveRating(input: {
  exerciseId: string;
  activityId: string;
  activityDate: string;
  coachId: string;
  raterName: string | null;
  scores: RatingScores;
  total: number;
  comment: string | null;
}): Promise<void> {
  const supabase = db();
  const { data: existing, error: findError } = await supabase
    .from("exercise_ratings")
    .select("id")
    .eq("exercise_id", input.exerciseId)
    .eq("activity_id", input.activityId)
    .eq("coach_id", input.coachId)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase.from("exercise_ratings").update({ scores: input.scores, total: input.total, comment: input.comment, updated_at: now }).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const exercise = await getExercise(input.exerciseId);
  if (!exercise) throw new Error("Exercice introuvable");
  const { error } = await supabase.from("exercise_ratings").insert({
    exercise_id: input.exerciseId,
    exercise_version: exercise.version ?? 1,
    activity_id: input.activityId,
    activity_date: input.activityDate,
    coach_id: input.coachId,
    rater_name: input.raterName,
    scores: input.scores,
    total: input.total,
    comment: input.comment
  });
  if (error) throw new Error(error.message);
}

/** Décision de JP : valider la version en cours, retirer, ou remettre à l'essai (nouvelle version). */
export async function setBankDecision(id: string, action: "valider" | "annuler-validation" | "retirer" | "remettre" | "reference" | "annuler-reference", reason?: string | null): Promise<void> {
  const exercise = await getExercise(id);
  if (!exercise) throw new Error("Exercice introuvable");
  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (action === "valider") patch = { validated_version: exercise.version, validated_at: now };
  else if (action === "annuler-validation") patch = { validated_version: null, validated_at: null };
  else if (action === "retirer") patch = { retired_at: now, retired_reason: reason?.trim() || null };
  // JP référence : la date du premier marquage reste ; seul « le meilleur pour … » change si JP le réécrit.
  else if (action === "reference") patch = { jp_reference_at: exercise.jp_reference_at ?? now, jp_reference_note: reason?.trim().slice(0, 200) || null };
  else if (action === "annuler-reference") patch = { jp_reference_at: null, jp_reference_note: null };
  else {
    const version = (exercise.version ?? 1) + 1;
    patch = {
      retired_at: null,
      retired_reason: null,
      version,
      version_history: [...(exercise.version_history ?? []), { version, at: now, note: reason?.trim() || "Remis à l'essai par JP" }]
    };
  }
  const { error } = await db().from("exercises").update({ ...patch, updated_at: now }).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface ExerciseToRate {
  exerciseId: string;
  title: string;
  objective: string | null;
  version: number;
  blockTypes: string[];
  myRating: { scores: RatingScores; total: number; comment: string | null } | null;
  bank: BankSummary;
  /** Prévu dans le plan mais pas joué (« On ne l'a pas fait ») : ni noté ni compté. */
  notDone: boolean;
}

/** « On ne l'a pas fait » : l'exercice prévu n'a pas été joué pendant cette pratique (ou on annule). */
export async function setExerciseNotDone(activityId: string, exerciseId: string, notDone: boolean, coachId: string, note: string | null): Promise<void> {
  const { error } = await db()
    .from("activity_session_blocks")
    .update({ not_done: notDone, not_done_note: notDone ? note?.slice(0, 500) || null : null, not_done_by: notDone ? coachId : null })
    .eq("activity_id", activityId)
    .eq("exercise_id", exerciseId);
  if (error) throw new Error(error.message);
}

/** Exercices de la banque utilisés dans le plan d'une séance, avec la note déjà donnée par cet éducateur. */
export async function getActivityExercisesToRate(activityId: string, coachId: string): Promise<ExerciseToRate[]> {
  const { data: blocks, error } = await db().from("activity_session_blocks").select("exercise_id, block_type, block_order, not_done").eq("activity_id", activityId).not("exercise_id", "is", null).order("block_order");
  if (error) throw new Error(error.message);
  const ids = [...new Set<string>((blocks ?? []).map((b: any) => b.exercise_id as string))];
  if (!ids.length) return [];
  const [{ data: exercises, error: exError }, ratings] = await Promise.all([db().from("exercises").select("*").in("id", ids), getRatings(ids)]);
  if (exError) throw new Error(exError.message);
  return ids
    .map((id) => (exercises ?? []).find((e: any) => e.id === id) as ExerciseFiche | undefined)
    .filter((e): e is ExerciseFiche => Boolean(e))
    .map((e) => {
      const mine = ratings.find((r) => r.exercise_id === e.id && r.activity_id === activityId && r.coach_id === coachId);
      return {
        exerciseId: e.id,
        title: e.title,
        objective: e.objective,
        version: e.version ?? 1,
        blockTypes: (blocks ?? []).filter((b: any) => b.exercise_id === e.id).map((b: any) => b.block_type as string),
        myRating: mine ? { scores: mine.scores, total: mine.total, comment: mine.comment } : null,
        bank: computeBankStatus(e, ratings.filter((r) => r.exercise_id === e.id)),
        notDone: (blocks ?? []).filter((b: any) => b.exercise_id === e.id).every((b: any) => b.not_done)
      };
    });
}

/* ── Un exercice modifié change partout (JP, 17 nov. 2026) ──────────────────────────────────
   Les pratiques ne copient pas l'exercice : chaque bloc pointe vers la fiche de la banque, donc une fiche modifiée
   change tout de suite dans chaque pratique et dans le portail. Seuls les champs « Pratique du jour » remplis à la main
   dans un bloc (montage, matériel, points clés…) restent propres à ce bloc : `applyGuideEverywhere` et
   `resetBlockOverrides` les ramènent à la fiche pour toutes les pratiques à venir. Les pratiques passées ne bougent pas. */

const GUIDE_TO_EXERCISE = { material: "material", key_points: "coaching_points", variants: "variants", progressions: "progression" } as const;
const GUIDE_KEYS = ["setup", "material", "roles", "key_points", "variants", "progressions"] as const;
type GuideKey = (typeof GUIDE_KEYS)[number];

const todayMontreal = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export interface ExerciseUse {
  blockId: string;
  activityId: string;
  date: string;
  start: string;
  title: string;
  /** Champs « Pratique du jour » remplis à la main dans ce bloc (ils passent avant la fiche). */
  overrides: string[];
}

/** Les pratiques où l'exercice est utilisé : à venir (aujourd'hui compris) et le nombre de passées. */
export async function getExerciseUses(exerciseId: string): Promise<{ upcoming: ExerciseUse[]; pastCount: number }> {
  const { data, error } = await db()
    .from("activity_session_blocks")
    .select(`id, activity_id, ${GUIDE_KEYS.join(", ")}, activity:coach_activities(activity_date, start_time, title, category)`)
    .eq("exercise_id", exerciseId);
  if (error) throw new Error(error.message);
  const today = todayMontreal();
  const all = ((data ?? []) as any[])
    .filter((b) => b.activity)
    .map((b) => ({
      blockId: b.id,
      activityId: b.activity_id,
      date: String(b.activity.activity_date).slice(0, 10),
      start: String(b.activity.start_time ?? "").slice(0, 5),
      title: b.activity.title || b.activity.category || "Pratique",
      overrides: GUIDE_KEYS.filter((k) => typeof b[k] === "string" && b[k].trim())
    }));
  const upcoming = all.filter((u) => u.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return { upcoming, pastCount: all.length - upcoming.length };
}

/** Ce qu'une suppression toucherait (JP, 26 nov. 2026) : pratiques à venir et passées qui l'utilisent, notes, routines. */
export interface ExerciseDeleteImpact {
  upcoming: ExerciseUse[];
  pastCount: number;
  ratings: number;
  routines: number;
}

export async function getExerciseDeleteImpact(exerciseId: string): Promise<ExerciseDeleteImpact> {
  const [{ upcoming, pastCount }, ratings, routines] = await Promise.all([
    getExerciseUses(exerciseId),
    db().from("exercise_ratings").select("id", { count: "exact", head: true }).eq("exercise_id", exerciseId),
    db().from("player_routines").select("id", { count: "exact", head: true }).contains("exercise_ids", [exerciseId])
  ]);
  if (ratings.error) throw new Error(ratings.error.message);
  return { upcoming, pastCount, ratings: ratings.count ?? 0, routines: routines.error ? 0 : (routines.count ?? 0) };
}

/** Suppression définitive sans rien casser : refusée si l'exercice est prévu dans une pratique à venir (le changer
 *  là d'abord, ou le retirer de la banque) ; les pratiques passées gardent son nom dans leur plan ; ses notes
 *  s'effacent avec lui ; il sort des routines des joueuses. La diapo reste dans le stockage (un doublon peut la partager). */
export async function deleteExerciseSafely(id: string): Promise<{ deleted: true } | { deleted: false; upcoming: ExerciseUse[] }> {
  const exercise = await getExercise(id);
  if (!exercise) throw new Error("Exercice introuvable");
  const impact = await getExerciseDeleteImpact(id);
  if (impact.upcoming.length) return { deleted: false, upcoming: impact.upcoming };
  const { error: keepName } = await db().from("activity_session_blocks").update({ custom_title: exercise.title }).eq("exercise_id", id).is("custom_title", null);
  if (keepName) throw new Error(keepName.message);
  if (impact.routines) {
    const { data } = await db().from("player_routines").select("id, exercise_ids").contains("exercise_ids", [id]);
    for (const r of (data ?? []) as { id: string; exercise_ids: string[] }[]) {
      await db().from("player_routines").update({ exercise_ids: r.exercise_ids.filter((x) => x !== id) }).eq("id", r.id);
    }
  }
  await deleteExercise(id);
  return { deleted: true };
}

/** Une modification faite dans « Pratique du jour » d'un bloc devient la règle partout : matériel, points clés,
 *  variantes et progressions vont dans la fiche de la banque (et les blocs à venir reprennent la fiche) ; montage
 *  du terrain et « qui fait quoi » (pas de champ dans la fiche) sont recopiés dans chaque pratique à venir. */
export async function applyGuideEverywhere(exerciseId: string, guide: Partial<Record<GuideKey, string | null>>): Promise<{ blocks: number }> {
  const bank: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(GUIDE_TO_EXERCISE)) {
    const v = guide[k as GuideKey];
    if (typeof v === "string" && v.trim()) bank[col] = v.trim();
  }
  if (Object.keys(bank).length) {
    const now = new Date().toISOString();
    const { error } = await db().from("exercises").update({ ...bank, updated_at: now, content_updated_at: now }).eq("id", exerciseId);
    if (error) throw new Error(error.message);
  }
  const { upcoming } = await getExerciseUses(exerciseId);
  if (!upcoming.length) return { blocks: 0 };
  const patch: Record<string, string | null> = {};
  for (const k of Object.keys(GUIDE_TO_EXERCISE)) if (k in bank || (typeof guide[k as GuideKey] === "string" && guide[k as GuideKey]!.trim())) patch[k] = null;
  for (const k of ["setup", "roles"] as const) if (guide[k] !== undefined) patch[k] = guide[k] ?? null;
  if (Object.keys(patch).length) {
    const { error } = await db().from("activity_session_blocks").update(patch).in("id", upcoming.map((u) => u.blockId));
    if (error) throw new Error(error.message);
  }
  return { blocks: upcoming.length };
}

/** Toutes les pratiques à venir reprennent la fiche de la banque (on efface les ajustements faits bloc par bloc). */
export async function resetBlockOverrides(exerciseId: string): Promise<{ blocks: number }> {
  const { upcoming } = await getExerciseUses(exerciseId);
  const ids = upcoming.filter((u) => u.overrides.length).map((u) => u.blockId);
  if (!ids.length) return { blocks: 0 };
  const { error } = await db().from("activity_session_blocks").update(Object.fromEntries(GUIDE_KEYS.map((k) => [k, null]))).in("id", ids);
  if (error) throw new Error(error.message);
  return { blocks: ids.length };
}
