/** Sondage de fin de pratique (demande de JP, 3 nov. 2026 ; Mandalart P1.5.06, indicateur appreciation_joueuses).
 *  Chaque fille présente dit, en 3 touches : son plaisir, sa fatigue et ce qu'elle aimerait avoir plus.
 *  Règles pures, partagées par le portail des éducateurs et l'espace Coaching.
 *
 *  Le plaisir et la fatigue sont notés sur 10 (practice_rating, fatigue) : le plaisir alimente l'indicateur. */

/** Plaisir et fatigue notés de 1 à 10 (demande de JP, 3 nov. 2026). Les mots aux deux bouts aident les plus jeunes. */
export interface Scale {
  key: "plaisir" | "fatigue" | "apprentissage" | "comprehension" | "confiance";
  label: string;
  low: string;
  high: string;
}

export const SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const PLEASURE: Scale = { key: "plaisir", label: "Plaisir", low: "😞 Pas aimé", high: "Adoré 😍" };
/** 1 = pleine d'énergie, 10 = épuisée. */
export const FATIGUE: Scale = { key: "fatigue", label: "Fatigue", low: "⚡ Pleine d'énergie", high: "Épuisée 🥵" };

export const LEARNING: Scale = { key: "apprentissage", label: "Apprentissage", low: "🤷 Rien de nouveau", high: "Plein de choses 🧠" };
export const UNDERSTANDING: Scale = { key: "comprehension", label: "Compréhension", low: "😕 Pas compris", high: "Tout compris 💡" };
export const CONFIDENCE: Scale = { key: "confiance", label: "Confiance", low: "😬 Pas confiante", high: "Super confiante 💪" };

/** La borne (iPad au bord du terrain, demande de JP du 13 nov. 2026) : la joueuse touche sa photo et répond seule,
 *  une question par écran, en mots d'enfant. Champs : practice_rating, fatigue, learning, understanding, confidence. */
export const KIOSK_QUESTIONS: { field: "practiceRating" | "fatigue" | "learning" | "understanding" | "confidence"; question: string; scale: Scale }[] = [
  { field: "practiceRating", question: "As-tu eu du plaisir aujourd'hui ?", scale: PLEASURE },
  { field: "fatigue", question: "Es-tu fatiguée ?", scale: FATIGUE },
  { field: "learning", question: "As-tu appris quelque chose de nouveau ?", scale: LEARNING },
  { field: "understanding", question: "As-tu compris ce qu'on devait faire dans les exercices ?", scale: UNDERSTANDING },
  { field: "confidence", question: "Te sens-tu confiante avec le ballon ?", scale: CONFIDENCE }
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

export interface SurveyAnswer {
  practiceRating: number | null;
  fatigue: number | null;
  wantsMore: string[];
  wantsMoreNote: string | null;
  /** Borne : apprentissage, compréhension de la pratique, confiance (sur 10). Absents = pas touchés. */
  learning?: number | null;
  understanding?: number | null;
  confidence?: number | null;
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
  const out: SurveyAnswer = { practiceRating, fatigue, wantsMore: [...new Set(raw.map(String))], wantsMoreNote: note || null };
  for (const k of ["learning", "understanding", "confidence"] as const) {
    if (!(k in body)) continue;
    const v = score(body[k]);
    if (v === undefined) return "Les réponses vont de 0 à 10.";
    out[k] = v;
  }
  return out;
}

export interface SurveySummary {
  answered: number;
  pleasure: number | null;
  fatigue: number | null;
  learning: number | null;
  understanding: number | null;
  confidence: number | null;
  /** Les demandes les plus fréquentes d'abord. */
  wants: { key: string; label: string; count: number }[];
  notes: string[];
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);

export function summarizeSurvey(rows: { practice_rating: number | null; fatigue: number | null; learning?: number | null; understanding?: number | null; confidence?: number | null; wants_more?: string[] | null; wants_more_note?: string | null }[]): SurveySummary {
  const answered = rows.filter((r) => r.practice_rating != null || r.fatigue != null || (r.wants_more ?? []).length > 0);
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of r.wants_more ?? []) counts.set(k, (counts.get(k) ?? 0) + 1);
  return {
    answered: answered.length,
    pleasure: avg(rows.map((r) => r.practice_rating).filter((v): v is number => v != null)),
    fatigue: avg(rows.map((r) => r.fatigue).filter((v): v is number => v != null)),
    learning: avg(rows.map((r) => r.learning).filter((v): v is number => v != null)),
    understanding: avg(rows.map((r) => r.understanding).filter((v): v is number => v != null)),
    confidence: avg(rows.map((r) => r.confidence).filter((v): v is number => v != null)),
    wants: [...counts.entries()].map(([key, count]) => ({ key, label: wantsLabel(key), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr")),
    notes: rows.map((r) => r.wants_more_note?.trim()).filter((n): n is string => Boolean(n))
  };
}
