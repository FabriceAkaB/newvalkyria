import { describe, expect, it } from "vitest";
import { computeLaunch, normalizeInputs, type LaunchInputs } from "@/lib/launch-calculator";
import { DEFAULT_SEASON_SETTINGS, NO_SEASON, budgetVsSpent, parseSeasonSettingsMap, seasonLabels, seasonTotals } from "@/lib/season-budget";

const sc = (id: string, over: Partial<LaunchInputs>) => {
  const inputs = normalizeInputs({ priceCents: 30_000, capacity: 20, sessions: 10, hoursPerSession: 2, fieldHourlyCents: 5_000, coachCount: 2, coachHourlyCents: 2_500, ...over });
  return { id, name: id, inputs, results: computeLaunch(inputs, "2026-11-26") };
};

describe("cumul d'une saison", () => {
  const camp = sc("camp", { season: "Été 2027", format: "camp", weeks: 8, perWeek: 30, daysPerWeek: 5, hoursPerSession: 7, priceCents: 27_500, jpHours: 40 });
  const ballon = sc("ballon", { season: "Été 2027", jpHours: 10 });

  it("additionne les scénarios cochés au remplissage choisi", () => {
    const t = seasonTotals([camp, ballon], DEFAULT_SEASON_SETTINGS);
    expect(t.included).toBe(2);
    expect(t.revenueCents).toBe(camp.results.scenarios.find((s) => s.key === "pessimistic")!.revenueCents + ballon.results.scenarios.find((s) => s.key === "pessimistic")!.revenueCents);
    expect(t.programProfitCents).toBe(t.revenueCents - t.costCents);
    expect(t.jpHours).toBe(50);
  });

  it("un scénario décoché ne compte pas", () => {
    const t = seasonTotals([camp, ballon], { ...DEFAULT_SEASON_SETTINGS, excluded: ["ballon"] });
    expect(t.included).toBe(1);
    expect(t.lines.find((l) => l.id === "ballon")!.included).toBe(false);
  });

  it("enlève le salaire de JP et les autres charges : ce qui reste dans l'entreprise", () => {
    const t = seasonTotals([camp, ballon], { ...DEFAULT_SEASON_SETTINGS, fill: "full", jpSalaryCents: 1_000_000, otherChargesCents: 200_000 });
    expect(t.leftCents).toBe(t.programProfitCents - 1_200_000);
    expect(t.maxSalaryCents).toBe(t.programProfitCents - 200_000);
  });

  it("le camp : semaines × places par semaine, séances = semaines × jours", () => {
    expect(camp.inputs.capacity).toBe(240);
    expect(camp.inputs.sessions).toBe(40);
    expect(camp.results.programHours).toBe(280);
  });

  it("regroupe par saison, « Sans saison » en dernier, et relit le réglage enregistré", () => {
    expect(seasonLabels([camp, sc("x", {}), sc("y", { season: "Hiver 2027-2028" })])).toEqual(["Été 2027", "Hiver 2027-2028", NO_SEASON]);
    expect(parseSeasonSettingsMap('{"Été 2027":{"jpSalaryCents":500000,"fill":"full","excluded":["a"]}}')["Été 2027"]).toMatchObject({ jpSalaryCents: 500_000, otherChargesCents: 0, fill: "full", excluded: ["a"], seasonKey: null });
    expect(parseSeasonSettingsMap("pas du json")).toEqual({});
  });
});

describe("budget de la saison et coût d'opportunité", () => {
  const camp = sc("camp", { season: "Été 2027", format: "camp", weeks: 8, perWeek: 30, daysPerWeek: 5, hoursPerSession: 7, priceCents: 27_500, kitCents: 2_000, jpHours: 40 });

  it("le budget par poste égale les coûts des programmes, plus ton salaire et les autres charges", () => {
    const t = seasonTotals([camp], { ...DEFAULT_SEASON_SETTINGS, jpSalaryCents: 500_000, otherChargesCents: 100_000 });
    const total = t.budget.reduce((s, l) => s + l.cents, 0);
    expect(Math.abs(total - (t.costCents + 600_000))).toBeLessThanOrEqual(2);
    expect(t.budget.find((l) => l.key === "kit")!.cents).toBe(168 * 2_000);
  });

  it("le coût d'opportunité : tes heures × la valeur de ton heure", () => {
    const t = seasonTotals([camp], { ...DEFAULT_SEASON_SETTINGS, jpHourValueCents: 10_000 });
    expect(t.opportunityCents).toBe(400_000);
    expect(t.overOpportunityCents).toBe(t.programProfitCents - 400_000);
  });

  it("budget contre dépensé, par catégorie de Revenus", () => {
    const t = seasonTotals([camp], DEFAULT_SEASON_SETTINGS);
    const rows = budgetVsSpent(t.budget, { "Location / Terrain": 100_000, Assurance: 50_000 });
    const terrain = rows.find((r) => r.category === "Location / Terrain")!;
    expect(terrain.leftCents).toBe(terrain.budgetCents - 100_000);
    expect(rows.find((r) => r.category === "Assurance")!.budgetCents).toBe(0);
  });
});
