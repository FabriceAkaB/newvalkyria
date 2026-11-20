/** Rapports des éducateurs sur les joueuses (JP, 20 nov. 2026) : chaque réponse de chaque éducateur, puis la
 *  moyenne quand deux éducateurs ont évalué la même fille à la même pratique. Règles pures, testées. */

import { QUICK_CRITERIA } from "@/lib/coach-report";

export interface CoachEvaluation {
  coachId: string;
  coachName: string;
  ratings: Record<string, number>;
  gestureScores: Record<string, number>;
  difficult: string[];
  comment: string | null;
}

export interface MergedEvaluation {
  /** Nombre d'éducateurs qui ont évalué cette fille à cette pratique. */
  coaches: number;
  /** Moyenne de chaque critère (1 à 5), arrondie au dixième ; null si personne ne l'a noté. */
  ratings: Record<string, number | null>;
  /** Moyenne des 3 critères ensemble. */
  overall: number | null;
  /** Moyenne de chaque geste du ball mastery (1 à 10). */
  gestures: { name: string; average: number; scores: number }[];
  /** Gestes jugés difficiles par au moins un éducateur. */
  difficult: string[];
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const valid = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= max;

export function mergeEvaluations(evals: CoachEvaluation[]): MergedEvaluation {
  const ratings: Record<string, number | null> = {};
  for (const c of QUICK_CRITERIA) ratings[c] = mean(evals.map((e) => e.ratings?.[c]).filter((v): v is number => valid(v, 5)));
  const all = evals.flatMap((e) => QUICK_CRITERIA.map((c) => e.ratings?.[c]).filter((v): v is number => valid(v, 5)));
  const byGesture = new Map<string, number[]>();
  for (const e of evals) for (const [g, v] of Object.entries(e.gestureScores ?? {})) if (valid(v, 10)) byGesture.set(g, [...(byGesture.get(g) ?? []), v]);
  return {
    coaches: evals.length,
    ratings,
    overall: mean(all),
    gestures: [...byGesture.entries()].map(([name, xs]) => ({ name, average: mean(xs)!, scores: xs.length })).sort((a, b) => a.average - b.average || a.name.localeCompare(b.name, "fr")),
    difficult: [...new Set(evals.flatMap((e) => e.difficult ?? []))].sort((a, b) => a.localeCompare(b, "fr"))
  };
}

/** Écart entre deux éducateurs sur un critère (≥ 2 points sur 5 : à regarder ensemble). */
export function disagreements(evals: CoachEvaluation[]): string[] {
  if (evals.length < 2) return [];
  return QUICK_CRITERIA.filter((c) => {
    const xs = evals.map((e) => e.ratings?.[c]).filter((v): v is number => valid(v, 5));
    return xs.length >= 2 && Math.max(...xs) - Math.min(...xs) >= 2;
  });
}
