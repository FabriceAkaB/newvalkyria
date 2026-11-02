/** Observation filmée mensuelle des coachs (Mandalart P1.4.03) : grille sur 10, règles pures. */

export const OBSERVATION_CRITERIA = [
  { key: "parle_peu", label: "Parle moins de 20 % du temps", hint: "Explications courtes, les filles jouent." },
  { key: "questions", label: "Pose des questions", hint: "Fait trouver la solution plutôt que la donner." },
  { key: "compliments", label: "Compliment précis à chaque fille", hint: "Chaque fille nommée, avec un compliment qui dit quoi." },
  { key: "toutes_actives", label: "Toutes les filles actives", hint: "Un ballon par fille, aucune file d'attente." },
  { key: "plan", label: "Plan et thème respectés", hint: "Les blocs, le temps et le thème de la semaine." }
] as const;
export type ObservationCriterion = (typeof OBSERVATION_CRITERIA)[number]["key"];

export const SCORE_LABEL: Record<number, string> = { 0: "Pas encore", 1: "En partie", 2: "Oui" };

/** Lit la grille (5 critères à 0, 1 ou 2). null si un critère manque ou est hors limites. */
export function parseObservationScores(input: unknown): { scores: Record<ObservationCriterion, number>; total: number } | null {
  if (!input || typeof input !== "object") return null;
  const scores = {} as Record<ObservationCriterion, number>;
  for (const c of OBSERVATION_CRITERIA) {
    const v = Number((input as Record<string, unknown>)[c.key]);
    if (!Number.isInteger(v) || v < 0 || v > 2) return null;
    scores[c.key] = v;
  }
  return { scores, total: Object.values(scores).reduce((a, b) => a + b, 0) };
}

/** Coachs pas encore observés dans le mois (AAAA-MM), parmi les coachs actifs qui ont eu une activité ce mois-là. */
export function notObservedThisMonth(
  coaches: { id: string; name: string }[],
  workedThisMonth: Set<string>,
  observations: { coach_id: string; observed_on: string }[],
  month: string
): { id: string; name: string }[] {
  const observed = new Set(observations.filter((o) => String(o.observed_on).slice(0, 7) === month).map((o) => o.coach_id));
  return coaches.filter((c) => workedThisMonth.has(c.id) && !observed.has(c.id));
}
