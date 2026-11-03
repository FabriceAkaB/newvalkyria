/** Galerie des exercices (demande de JP, 3 nov. 2026) : chaque exercice est une diapo qu'on balaie, sans ouvrir de
 *  fichier. Règles pures : ce qu'une diapo montre et quels exercices sont dans la galerie (lecture seule de la banque). */

import { placeLabel, typeLabel, venueLabel, type BankStatus } from "@/lib/exercise-bank";
import type { BankEntry, ExerciseDiagram } from "@/lib/exercises-repo";

export interface GallerySlide {
  id: string;
  title: string;
  status: BankStatus;
  top: boolean;
  average: number | null;
  /** La diapo déposée (image) ; sinon le schéma dessiné dans la fiche. */
  imageUrl: string | null;
  diagram: ExerciseDiagram | null;
  videoUrl: string | null;
  tags: string[];
  ages: string[];
  theme: string | null;
  objective: string | null;
  instructions: string | null;
  coachingPoints: string | null;
  setup: { label: string; text: string }[];
  easier: string | null;
  harder: string | null;
  material: string | null;
}

const players = (min: number | null, max: number | null) =>
  min && min === max ? `${min} joueuses` : min || max ? `${min ?? "?"} à ${max ?? "?"} joueuses` : null;

export function toSlide(e: BankEntry): GallerySlide {
  const diagram = e.diagram_data && (e.diagram_data.elements?.length || e.diagram_data.arrows?.length) ? e.diagram_data : null;
  return {
    id: e.id,
    title: e.title,
    status: e.bank.status,
    top: e.bank.top,
    average: e.bank.average,
    imageUrl: e.image_url,
    diagram,
    videoUrl: e.video_url,
    tags: [typeLabel(e.exercise_type), placeLabel(e.session_place), venueLabel(e.venue), players(e.min_players, e.max_players), e.duration_minutes ? `${e.duration_minutes} min` : null].filter((t): t is string => Boolean(t)),
    ages: e.age_groups ?? [],
    theme: e.category,
    objective: e.objective,
    instructions: e.instructions,
    coachingPoints: e.coaching_points,
    setup: [
      { label: "5 à 7 joueuses", text: e.setup_5_7 },
      { label: "8 à 10 joueuses", text: e.setup_8_10 },
      { label: "11 à 16 joueuses", text: e.setup_11_16 }
    ].filter((s): s is { label: string; text: string } => Boolean(s.text?.trim())),
    easier: e.variant_easier,
    harder: e.variant_harder,
    material: e.material
  };
}

/** Les approuvés d'abord (les tops en tête), dans l'ordre de la banque ; « tous » ajoute les autres, jamais les retirés. */
export function gallerySlides(entries: BankEntry[], opts: { all?: boolean } = {}): GallerySlide[] {
  return entries.filter((e) => e.bank.status !== "retire" && (opts.all || e.bank.status === "approuve")).map(toSlide);
}

export function matchesSlide(s: Pick<GallerySlide, "ages" | "theme">, f: { age: string; theme: string }): boolean {
  return (!f.age || s.ages.includes(f.age)) && (!f.theme || (s.theme ?? "").toLowerCase() === f.theme.toLowerCase());
}
