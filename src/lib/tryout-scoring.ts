/** Calcul du verdict d'évaluation (section 7) — pur, sans dépendance,
 *  testable indépendamment de la base de données. Les critères et les
 *  seuils viennent de tryout_criteria_config (modifiables sans toucher au
 *  code) ; cette fonction ne fait qu'appliquer la logique exactement comme
 *  spécifiée, dans l'ordre : drapeau attitude → blocage technique → paliers.
 */

export interface CriterionConfig {
  id: string;
  block: "technique" | "jeu";
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
