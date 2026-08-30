import { describe, expect, it } from "vitest";

import { computeVerdict, type CriterionConfig, type CriterionScoreInput, type ThresholdsConfig } from "@/lib/tryout-scoring";

const CRITERIA: CriterionConfig[] = [
  { id: "c1", block: "technique", label: "Première touche", coefficient: 1.5, order: 1 },
  { id: "c2", block: "technique", label: "Passe", coefficient: 1.5, order: 2 },
  { id: "c3", block: "technique", label: "Conduite/1v1", coefficient: 1.0, order: 3 },
  { id: "c4", block: "technique", label: "Pied faible", coefficient: 1.0, order: 4 },
  { id: "c5", block: "technique", label: "Frappe/finition", coefficient: 0.5, order: 5 },
  { id: "c6", block: "technique", label: "Aisance ballon", coefficient: 0.5, order: 6 },
  { id: "c7", block: "jeu", label: "Décision", coefficient: 1.0, order: 7 },
  { id: "c8", block: "jeu", label: "Placement/défense", coefficient: 1.0, order: 8 },
  { id: "c9", block: "jeu", label: "Vitesse/explosivité", coefficient: 1.0, order: 9 },
  { id: "c10", block: "jeu", label: "Mental/attitude", coefficient: 1.0, order: 10 }
];

const THRESHOLDS: ThresholdsConfig = {
  attitude_criterion_id: "c10",
  attitude_red_flag_max: 3,
  technical_block_min_for_pass: 30,
  tiers: [
    { min_technical: 45, min_total: 75, verdict: "pret", label: "Prête — profil sport-études" },
    { min_technical: 36, min_total: 62, verdict: "bonne_voie", label: "En bonne voie" },
    { min_technical: 30, min_total: 0, verdict: "juste", label: "Juste — technique prioritaire" }
  ],
  default_verdict: { verdict: "pas_prete", label: "Pas prête" },
  attitude_flag_verdict: { verdict: "a_revoir", label: "À revoir — enjeu d'attitude" },
  technical_block_fail_verdict: { verdict: "pas_prete_technique", label: "Pas prête — technique insuffisante" },
  maturation_alert: { physical_criteria_ids: ["c8", "c9"], physical_min: 7, technical_max_trigger: 30 }
};

function scoreAll(value: number): Record<string, CriterionScoreInput> {
  return Object.fromEntries(CRITERIA.map((c) => [c.id, { score: value }]));
}

describe("computeVerdict — sous-totaux", () => {
  it("calcule le sous-total technique (critères 1 à 6, sur 60) et le total (sur 100) à note 10 partout", () => {
    const result = computeVerdict(CRITERIA, THRESHOLDS, scoreAll(10));
    expect(result.technicalSubtotal).toBe(60);
    expect(result.total).toBe(100);
  });

  it("calcule les points par critère comme note × coefficient", () => {
    const result = computeVerdict(CRITERIA, THRESHOLDS, scoreAll(8));
    expect(result.criterionPoints.c1).toBeCloseTo(12); // 8 × 1.5
    expect(result.criterionPoints.c5).toBeCloseTo(4); // 8 × 0.5
    expect(result.criterionPoints.c7).toBeCloseTo(8); // 8 × 1.0
  });
});

describe("computeVerdict — drapeau rouge attitude", () => {
  it("bloque tout verdict positif si le critère 10 (attitude) est <= 3, même avec un excellent total", () => {
    const scores = scoreAll(10);
    scores.c10 = { score: 3 };
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    expect(result.verdict).toBe("a_revoir");
    expect(result.verdictLabel).toBe("À revoir — enjeu d'attitude");
  });

  it("ne déclenche pas le drapeau à 4 (juste au-dessus du seuil)", () => {
    const scores = scoreAll(10);
    scores.c10 = { score: 4 };
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    expect(result.verdict).not.toBe("a_revoir");
  });
});

describe("computeVerdict — blocage technique", () => {
  it("bloque tout verdict positif si le sous-total technique < 30, même avec un bon score physique/mental", () => {
    const scores: Record<string, { score: number }> = {
      c1: { score: 2 }, c2: { score: 2 }, c3: { score: 2 }, c4: { score: 2 }, c5: { score: 2 }, c6: { score: 2 }, // technique très faible
      c7: { score: 10 }, c8: { score: 10 }, c9: { score: 10 }, c10: { score: 10 }
    };
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    expect(result.technicalSubtotal).toBeLessThan(30);
    expect(result.verdict).toBe("pas_prete_technique");
  });
});

describe("computeVerdict — paliers", () => {
  it("« Prête — profil sport-études » quand technique >= 45 et total >= 75", () => {
    const result = computeVerdict(CRITERIA, THRESHOLDS, scoreAll(8));
    // technique = 48 (8×6), total = 80 (8×10) → dépasse les deux seuils
    expect(result.verdict).toBe("pret");
  });

  it("« En bonne voie » quand technique >= 36 et total >= 62 mais sous le palier « Prête »", () => {
    const scores = scoreAll(6.5);
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    // technique = 39, total = 65
    expect(result.technicalSubtotal).toBeGreaterThanOrEqual(36);
    expect(result.total).toBeGreaterThanOrEqual(62);
    expect(result.verdict).toBe("bonne_voie");
  });

  it("« Juste — technique prioritaire » quand technique >= 30 mais sous les paliers supérieurs", () => {
    const scores = scoreAll(5);
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    // technique = 30, total = 50
    expect(result.verdict).toBe("juste");
  });
});

describe("computeVerdict — double notation", () => {
  it("retient la note la plus basse entre isolé et match", () => {
    const scores = scoreAll(8);
    scores.c1 = { isole: 9, match: 4 };
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    expect(result.effectiveScores.c1).toBe(4);
    expect(result.criterionPoints.c1).toBeCloseTo(6); // 4 × 1.5
  });
});

describe("computeVerdict — alerte de maturation", () => {
  it("signale un profil physiquement dominant mais techniquement en retard", () => {
    const scores: Record<string, { score: number }> = {
      c1: { score: 3 }, c2: { score: 3 }, c3: { score: 3 }, c4: { score: 3 }, c5: { score: 3 }, c6: { score: 3 }, // technique faible (18/60)
      c7: { score: 5 }, c8: { score: 8 }, c9: { score: 8 }, c10: { score: 8 }
    };
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    expect(result.maturationAlert).toBe(true);
  });

  it("ne signale rien si le physique n'est pas dominant", () => {
    const scores: Record<string, { score: number }> = {
      c1: { score: 3 }, c2: { score: 3 }, c3: { score: 3 }, c4: { score: 3 }, c5: { score: 3 }, c6: { score: 3 },
      c7: { score: 5 }, c8: { score: 6 }, c9: { score: 6 }, c10: { score: 8 }
    };
    const result = computeVerdict(CRITERIA, THRESHOLDS, scores);
    expect(result.maturationAlert).toBe(false);
  });
});

describe("computeVerdict — cas limites", () => {
  it("traite les critères non notés comme 0 (déclenche le drapeau attitude, vérifié en premier)", () => {
    const result = computeVerdict(CRITERIA, THRESHOLDS, {});
    expect(result.total).toBe(0);
    expect(result.technicalSubtotal).toBe(0);
    expect(result.verdict).toBe("a_revoir");
  });

  it("note minimale (1) déclenche à la fois le drapeau attitude et le blocage technique — l'attitude gagne (vérifiée en premier)", () => {
    const result = computeVerdict(CRITERIA, THRESHOLDS, scoreAll(1));
    expect(result.verdict).toBe("a_revoir");
  });
});
