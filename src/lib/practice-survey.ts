/** Sondage de fin de pratique (demande de JP, 3 nov. 2026 ; Mandalart P1.5.06, indicateur appreciation_joueuses).
 *  Chaque fille présente dit, en 3 touches : son plaisir, sa fatigue et ce qu'elle aimerait avoir plus.
 *  Règles pures, partagées par le portail des éducateurs et l'espace Coaching.
 *
 *  Le plaisir et la fatigue restent enregistrés sur 10 (practice_rating, fatigue) pour l'indicateur ;
 *  à l'écran, 5 choix faciles pour des filles de 8 à 12 ans, qui valent 2, 4, 6, 8 et 10. */

export interface ScaleLevel {
  value: number;
  emoji: string;
  label: string;
}

export const PLEASURE_SCALE: ScaleLevel[] = [
  { value: 2, emoji: "😞", label: "Pas aimé" },
  { value: 4, emoji: "🙁", label: "Bof" },
  { value: 6, emoji: "😐", label: "Correct" },
  { value: 8, emoji: "🙂", label: "Aimé" },
  { value: 10, emoji: "😍", label: "Adoré" }
];

/** 2 = pleine d'énergie, 10 = épuisée. */
export const FATIGUE_SCALE: ScaleLevel[] = [
  { value: 2, emoji: "⚡", label: "Pleine d'énergie" },
  { value: 4, emoji: "🙂", label: "En forme" },
  { value: 6, emoji: "😮‍💨", label: "Un peu fatiguée" },
  { value: 8, emoji: "😓", label: "Fatiguée" },
  { value: 10, emoji: "🥵", label: "Épuisée" }
];

export const WANTS_MORE = [
  { key: "matchs", label: "Matchs" },
  { key: "jeux", label: "Jeux" },
  { key: "dribbles", label: "Dribbles et 1 contre 1" },
  { key: "tirs", label: "Tirs au but" },
  { key: "passes", label: "Passes" },
  { key: "ball-mastery", label: "Ball mastery et jongles" },
  { key: "defis", label: "Défis et compétitions" },
  { key: "gardienne", label: "Gardienne de but" },
  { key: "defense", label: "Défense" }
] as const;
export type WantsMoreKey = (typeof WANTS_MORE)[number]["key"];

export const wantsLabel = (k: string) => WANTS_MORE.find((w) => w.key === k)?.label ?? k;
export const NOTE_MAX = 80;

/** Le niveau affiché pour une note sur 10 déjà enregistrée (ancienne saisie de 0 à 10 comprise). */
export function levelOf(scale: ScaleLevel[], value: number | null | undefined): ScaleLevel | null {
  if (value === null || value === undefined) return null;
  return scale.reduce((best, l) => (Math.abs(l.value - value) < Math.abs(best.value - value) ? l : best), scale[0]);
}

export interface SurveyAnswer {
  practiceRating: number | null;
  fatigue: number | null;
  wantsMore: string[];
  wantsMoreNote: string | null;
}

/** Une réponse est complète quand le plaisir et la fatigue sont donnés (« plus de… » est facultatif). */
export const isAnswered = (a: Pick<SurveyAnswer, "practiceRating" | "fatigue"> | null | undefined) => a?.practiceRating != null && a?.fatigue != null;

/** Nettoie une réponse envoyée par le formulaire ; retourne un message d'erreur si elle est invalide. */
export function parseSurveyAnswer(body: Record<string, unknown>): SurveyAnswer | string {
  const score = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10 ? Number(v) : undefined);
  const practiceRating = score(body.practiceRating);
  const fatigue = score(body.fatigue);
  if (practiceRating === undefined || fatigue === undefined) return "Le plaisir et la fatigue vont de 0 à 10.";
  const keys = new Set<string>(WANTS_MORE.map((w) => w.key));
  const raw = Array.isArray(body.wantsMore) ? body.wantsMore : [];
  if (raw.some((k) => !keys.has(String(k)))) return "Choix « plus de… » inconnu.";
  const note = String(body.wantsMoreNote ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  return { practiceRating, fatigue, wantsMore: [...new Set(raw.map(String))], wantsMoreNote: note || null };
}

export interface SurveySummary {
  answered: number;
  pleasure: number | null;
  fatigue: number | null;
  /** Les demandes les plus fréquentes d'abord. */
  wants: { key: string; label: string; count: number }[];
  notes: string[];
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

export function summarizeSurvey(rows: { practice_rating: number | null; fatigue: number | null; wants_more?: string[] | null; wants_more_note?: string | null }[]): SurveySummary {
  const answered = rows.filter((r) => r.practice_rating != null || r.fatigue != null || (r.wants_more ?? []).length > 0);
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of r.wants_more ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
  return {
    answered: answered.length,
    pleasure: avg(rows.map((r) => r.practice_rating).filter((v): v is number => v != null)),
    fatigue: avg(rows.map((r) => r.fatigue).filter((v): v is number => v != null)),
    wants: [...counts.entries()].map(([key, count]) => ({ key, label: wantsLabel(key), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr")),
    notes: rows.map((r) => r.wants_more_note?.trim()).filter((n): n is string => Boolean(n))
  };
}
