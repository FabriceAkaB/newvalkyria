/** Calcul du verdict d'évaluation (section 7) — pur, sans dépendance,
 *  testable indépendamment de la base de données. Les critères et les
 *  seuils viennent de tryout_criteria_config (modifiables sans toucher au
 *  code) ; cette fonction ne fait qu'appliquer la logique exactement comme
 *  spécifiée, dans l'ordre : drapeau attitude → blocage technique → paliers.
 */

/** Sections de la fiche d'évaluation de l'athlète, dans l'ordre de la fiche.
 *  « jeu » est conservé seulement pour d'anciennes configurations. */
export type CriterionBlock = "technique" | "tactique" | "physique" | "mentalite" | "jeu";

export const FICHE_SECTIONS: { block: Exclude<CriterionBlock, "jeu">; title: string }[] = [
  { block: "technique", title: "Technique" },
  { block: "tactique", title: "Tactique" },
  { block: "physique", title: "Physique" },
  { block: "mentalite", title: "Mentalité" }
];

/** Échelle de la fiche : 5 (meilleur) → 1. B = 5-4, M = 3, F = 2-1. */
export const RATING_VALUES = [5, 4, 3, 2, 1] as const;
export const RATING_MAX = 5;

export type RatingBand = "B" | "M" | "F";

export function ratingBand(value: number): RatingBand {
  if (value >= 4) return "B";
  if (value === 3) return "M";
  return "F";
}

export const RATING_BAND_LABELS: Record<RatingBand, string> = { B: "Bon", M: "Moyen", F: "Faible" };

export interface CriterionConfig {
  id: string;
  block: CriterionBlock;
  label: string;
  coefficient: number;
  order: number;
}

export interface ThresholdTier {
  min_technical: number;
  min_total: number;
  verdict: string;
  label: string;
}

export interface VerdictLabel {
  verdict: string;
  label: string;
}

export interface ThresholdsConfig {
  attitude_criterion_id: string;
  attitude_red_flag_max: number;
  technical_block_min_for_pass: number;
  tiers: ThresholdTier[];
  default_verdict: VerdictLabel;
  attitude_flag_verdict: VerdictLabel;
  technical_block_fail_verdict: VerdictLabel;
  maturation_alert: { physical_criteria_ids: string[]; physical_min: number; technical_max_trigger: number };
}

/** Note simple, ou double (isolé/match) si double_scoring_enabled sur
 *  l'événement — la note retenue pour le calcul est la plus basse des deux. */
export type CriterionScoreInput = { score: number } | { isole: number; match: number };

export interface VerdictResult {
  technicalSubtotal: number;
  total: number;
  verdict: string;
  verdictLabel: string;
  maturationAlert: boolean;
  /** Note retenue (après double notation le cas échéant) par critère. */
  effectiveScores: Record<string, number>;
  /** Points obtenus (note retenue × coefficient) par critère. */
  criterionPoints: Record<string, number>;
}

function effectiveScore(raw: CriterionScoreInput | undefined): number {
  if (!raw) return 0;
  if ("score" in raw) return raw.score;
  return Math.min(raw.isole, raw.match);
}

export function computeVerdict(
  criteria: CriterionConfig[],
  thresholds: ThresholdsConfig,
  scores: Record<string, CriterionScoreInput>
): VerdictResult {
  const effectiveScores: Record<string, number> = {};
  const criterionPoints: Record<string, number> = {};
  let technicalSubtotal = 0;
  let total = 0;

  for (const c of criteria) {
    const eff = effectiveScore(scores[c.id]);
    effectiveScores[c.id] = eff;
    const points = eff * c.coefficient;
    criterionPoints[c.id] = points;
    total += points;
    if (c.block === "technique") technicalSubtotal += points;
  }

  const maturationAlert = thresholds.maturation_alert.physical_criteria_ids.every(
    (id) => (effectiveScores[id] ?? 0) >= thresholds.maturation_alert.physical_min
  ) && technicalSubtotal < thresholds.maturation_alert.technical_max_trigger;

  const attitudeScore = effectiveScores[thresholds.attitude_criterion_id] ?? 0;
  if (attitudeScore <= thresholds.attitude_red_flag_max) {
    return {
      technicalSubtotal,
      total,
      verdict: thresholds.attitude_flag_verdict.verdict,
      verdictLabel: thresholds.attitude_flag_verdict.label,
      maturationAlert,
      effectiveScores,
      criterionPoints
    };
  }

  if (technicalSubtotal < thresholds.technical_block_min_for_pass) {
    return {
      technicalSubtotal,
      total,
      verdict: thresholds.technical_block_fail_verdict.verdict,
      verdictLabel: thresholds.technical_block_fail_verdict.label,
      maturationAlert,
      effectiveScores,
      criterionPoints
    };
  }

  for (const tier of thresholds.tiers) {
    if (technicalSubtotal >= tier.min_technical && total >= tier.min_total) {
      return { technicalSubtotal, total, verdict: tier.verdict, verdictLabel: tier.label, maturationAlert, effectiveScores, criterionPoints };
    }
  }

  return {
    technicalSubtotal,
    total,
    verdict: thresholds.default_verdict.verdict,
    verdictLabel: thresholds.default_verdict.label,
    maturationAlert,
    effectiveScores,
    criterionPoints
  };
}

export const VERDICT_COLORS: Record<string, string> = {
  pret: "#8fce9f",
  bonne_voie: "#78a8f0",
  juste: "#f0c878",
  pas_prete: "#e6394a",
  pas_prete_technique: "#e6394a",
  a_revoir: "#e6394a"
};

export interface SectionSummary {
  block: CriterionBlock;
  title: string;
  rated: number;
  total: number;
  /** Moyenne sur 5 des critères notés de la section (null si aucun). */
  average: number | null;
  band: RatingBand | null;
}

/** Résumé par section de la fiche (nombre de critères remplis + moyenne et
 *  bande B/M/F) — sert à l'affichage et à l'impression de la fiche. */
export function summarizeSections(criteria: CriterionConfig[], scores: Record<string, CriterionScoreInput>): SectionSummary[] {
  return FICHE_SECTIONS.map(({ block, title }) => {
    const list = criteria.filter((c) => c.block === block);
    const values = list.map((c) => effectiveScore(scores[c.id])).filter((v) => v > 0);
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { block, title, rated: values.length, total: list.length, average, band: average === null ? null : ratingBand(Math.round(average)) };
  });
}
