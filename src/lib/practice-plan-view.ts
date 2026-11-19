import { BLOCK_GUIDE_FIELDS, type BlockGuideKey, type SessionBlock } from "@/lib/session-plan-repo";

/** Le plan d'une pratique en lecture seule (pur) : portail des éducateurs et borne du bord du terrain (180180). */

/** Ce que la fiche de l'exercice dit déjà pour chaque champ (affiché en indice : rien à recopier). */
export function exerciseGuideFallback(exercise: Record<string, unknown> | null | undefined): Partial<Record<BlockGuideKey, string>> {
  if (!exercise) return {};
  const txt = (...keys: string[]) =>
    keys
      .map((k) => exercise[k])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join("\n") || undefined;
  const variants = [
    exercise.variant_easier ? `Plus facile : ${exercise.variant_easier}` : null,
    exercise.variant_harder ? `Plus difficile : ${exercise.variant_harder}` : null,
    exercise.variant_cognitive ? `Cognitive : ${exercise.variant_cognitive}` : null
  ].filter(Boolean);
  return {
    setup: txt("dimensions", "setup_8_10"),
    material: txt("material"),
    key_points: txt("coaching_points"),
    variants: variants.length ? variants.join("\n") : txt("variants"),
    progressions: txt("progression", "progressions")
  };
}

/** Montage prévu dans la fiche selon le nombre de joueuses attendues (banque Valkyria : 5 à 7, 8 à 10, 11 à 16). */
export function setupForGroup(exercise: Record<string, unknown> | undefined | null, players: number): string | null {
  if (!exercise) return null;
  const key = players <= 7 ? "setup_5_7" : players <= 10 ? "setup_8_10" : "setup_11_16";
  const v = exercise[key];
  return typeof v === "string" && v.trim() ? v : null;
}

export interface PlanBlockView {
  id: string;
  type: string;
  title: string;
  /** Minutes depuis minuit. */
  from: number;
  minutes: number;
  rows: { label: string; value: string }[];
  diagram: unknown;
  imageUrl: string | null;
  videoUrl: string | null;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Chaque bloc avec son heure, ses consignes et ce que dit la fiche de l'exercice (montage selon la taille du groupe). */
export function planBlocks(blocks: SessionBlock[], exercises: Record<string, unknown>[], start: string, players: number): PlanBlockView[] {
  let at = toMin(start.slice(0, 5));
  return blocks.map((b) => {
    const exercise = exercises.find((e) => e.id === b.exercise_id);
    const fallback = exerciseGuideFallback(exercise);
    const groupSetup = setupForGroup(exercise, players);
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const rows = [
      { label: "Objectif", value: str(exercise?.objective) },
      ...BLOCK_GUIDE_FIELDS.map((f) => ({
        label: f.key === "setup" && groupSetup && !b.setup ? `${f.label} (${players} joueuses)` : f.label,
        value: (b[f.key] as string | null | undefined) || (f.key === "setup" ? groupSetup ?? fallback.setup : fallback[f.key]) || null
      })),
      { label: "Consignes", value: str(exercise?.instructions) },
      { label: "Erreurs fréquentes", value: str(exercise?.common_mistakes) },
      { label: "Notes de JP", value: b.notes }
    ].filter((r): r is { label: string; value: string } => Boolean(r.value && String(r.value).trim()));
    const view: PlanBlockView = {
      id: b.id,
      type: b.block_type,
      title: b.custom_title || str(exercise?.title) || b.block_type,
      from: at,
      minutes: b.duration_minutes,
      rows,
      diagram: exercise?.diagram_data ?? null,
      imageUrl: str(exercise?.image_url),
      videoUrl: str(exercise?.video_url)
    };
    at += b.duration_minutes;
    return view;
  });
}
