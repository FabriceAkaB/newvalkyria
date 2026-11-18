import { describe, expect, it } from "vitest";
import { computeLaunch, normalizeInputs } from "@/lib/launch-calculator";
import { evaluateProject } from "@/lib/project-pipeline";
import { MANUAL_REQUIREMENTS, projectRequirements, requirementsDone, taxCollected, taxThreshold } from "@/lib/finance-officer";

const camp = (checks: Record<string, boolean> = {}) => {
  const inputs = normalizeInputs({ priceCents: 52_900, capacity: 24, sessions: 5, hoursPerSession: 6, fieldHourlyCents: 4153, coachCount: 2, coachHourlyCents: 3000, startDate: "2027-06-28", jpHours: 10 });
  return { inputs, results: computeLaunch(inputs, "2026-11-17"), checks };
};

describe("responsable financier", () => {
  it("les conditions automatiques suivent le calculateur et l'intérêt", () => {
    const s = camp();
    const items = projectRequirements(s, evaluateProject({ yes: 30, maybe: 0, no: 0, answered: 30 }, s));
    expect(items.filter((i) => i.auto).every((i) => i.done)).toBe(true);
    expect(requirementsDone(items)).toBe(5);
  });
  it("les conditions à la main se cochent", () => {
    const s = camp({ lieu: true, assurance: true });
    const items = projectRequirements(s, evaluateProject({ yes: 30, maybe: 0, no: 0, answered: 30 }, s));
    expect(items.filter((i) => !i.auto && i.done).map((i) => i.key)).toEqual(["lieu", "assurance"]);
    expect(items.filter((i) => !i.auto)).toHaveLength(MANUAL_REQUIREMENTS.length);
  });
  it("sans calcul, rien n'est prêt", () => {
    expect(requirementsDone(projectRequirements(null, evaluateProject({ yes: 3, maybe: 0, no: 0, answered: 3 }, null)))).toBe(0);
  });
  it("seuil de la TPS/TVQ : un trimestre ou 4 trimestres au-dessus de 30 000 $", () => {
    expect(taxThreshold([{ month: "2026-07", revenueCents: 2_000_000 }, { month: "2026-08", revenueCents: 1_500_000 }], "2026-11-17")).toMatchObject({ overThreshold: true, firstOver: "2026-T3" });
    expect(taxThreshold([{ month: "2026-01", revenueCents: 900_000 }, { month: "2026-04", revenueCents: 900_000 }, { month: "2026-07", revenueCents: 900_000 }], "2026-11-17").overThreshold).toBe(false);
    expect(taxThreshold([{ month: "2026-01", revenueCents: 900_000 }, { month: "2026-04", revenueCents: 900_000 }, { month: "2026-07", revenueCents: 900_000 }, { month: "2026-10", revenueCents: 900_000 }], "2026-11-17").firstOver).toBe("2026-T4");
  });
  it("taxe perçue à remettre", () => {
    expect(taxCollected([{ month: "2027-09", revenueCents: 114_975, revenueExTaxCents: 100_000 }])).toBe(14_975);
  });
});
