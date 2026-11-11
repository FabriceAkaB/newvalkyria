import { describe, expect, it } from "vitest";

import {
  EMPTY_INPUTS,
  applyProgram,
  applyVenue,
  averageSessionHours,
  bestScenarioIndex,
  computeLaunch,
  daysBetween,
  dollars,
  fillCount,
  isIsoDate,
  marginLabel,
  needsPresalesAlert,
  normalizeInputs,
  selectLaunchAlerts,
  torontoDay,
  venueHourlyCents,
  verdictFromMargin,
  type LaunchInputs,
  type ProgramSource,
  type WatchedScenario
} from "@/lib/launch-calculator";

/** Exemple de référence : 10 séances de 1 h 30, terrain à 100 $/h, 2 éducateurs à 40 $/h,
 *  200 $ de matériel, 300 $ de marketing, uniforme à 50 $, 20 places.
 *  F = 1 500 + 1 200 + 200 + 300 = 3 200 $ ; Vbase = 50 $ + 0,30 $ = 50,30 $. */
const base: LaunchInputs = {
  ...EMPTY_INPUTS,
  capacity: 20,
  sessions: 10,
  hoursPerSession: 1.5,
  fieldHourlyCents: 10_000,
  coachCount: 2,
  coachHourlyCents: 4_000,
  equipmentCents: 20_000,
  marketingCents: 30_000,
  kitCents: 5_000,
  paymentsPerFamily: 1
};
const at = (priceCents: number, extra: Partial<LaunchInputs> = {}, today?: string) => computeLaunch({ ...base, priceCents, ...extra }, today);
const flat = (s: string) => s.replace(/[  ]/g, " ");

describe("coûts fixes et variables", () => {
  it("additionne terrain, éducateurs et autres coûts fixes", () => {
    const r = at(40_000);
    expect(r.programHours).toBe(15);
    expect(r.fixedLines.find((l) => l.key === "field")?.cents).toBe(150_000);
    expect(r.fixedLines.find((l) => l.key === "coaches")?.cents).toBe(120_000);
    expect(r.fixedCents).toBe(320_000);
  });

  it("calcule les frais Stripe : 2,9 % du prix + 0,30 $ par paiement", () => {
    const r = at(40_000);
    expect(r.stripeCents).toBe(1_190);
    expect(r.variableCents).toBe(6_190);
    expect(r.contributionCents).toBe(33_810);
    expect(at(40_000, { paymentsPerFamily: 3 }).stripeCents).toBe(1_250);
  });

  it("utilise le montant du contrat en mode contrat, peu importe les heures", () => {
    const r = at(40_000, { fieldMode: "contract", fieldContractCents: 539_000 });
    expect(r.fixedLines.find((l) => l.key === "field")?.cents).toBe(539_000);
  });

  it("respecte les heures saisies à la main pour le terrain et les éducateurs", () => {
    const r = at(40_000, { fieldHours: 20, coachHours: 10 });
    expect(r.fixedLines.find((l) => l.key === "field")?.cents).toBe(200_000);
    expect(r.fixedLines.find((l) => l.key === "coaches")?.cents).toBe(80_000);
  });
});

describe("prix planchers et seuils", () => {
  it("donne le prix coûtant à capacité pleine, le prix plancher de la méthode et le prix pour un GO", () => {
    const r = at(40_000);
    // (3 200 $ ÷ 20 + 50,30 $) ÷ (1 − 2,9 %) = 216,58 $
    expect(r.floorPriceCents).toBe(21_659);
    // (3 200 $ ÷ 16 + 50,30 $) ÷ (1 − 50 % − 2,9 %) = 531,42 $
    expect(r.methodFloorCents).toBe(53_143);
    // (3 200 $ ÷ 14 + 50,30 $) ÷ 0,471 = 592,08 $
    expect(r.goPriceCents).toBe(59_209);
  });

  it("le prix plancher de la méthode vaut 2 × (F ÷ N80 + V) sans frais en pourcentage", () => {
    const r = at(40_000);
    const withoutPercent = (320_000 / 16 + 5_030) * 2;
    expect(r.methodFloorCents).toBeGreaterThan(withoutPercent);
  });

  it("calcule le seuil de survie et le seuil de 50 % de marge", () => {
    const r = at(40_000);
    expect(r.breakEvenCount).toBe(10); // 3 200 $ ÷ 338,10 $ = 9,46
    expect(r.marginCount).toBe(24); // 3 200 $ ÷ 138,10 $ = 23,2
  });

  it("au seuil de survie, le profit est positif ; une inscrite de moins, il est négatif", () => {
    const r = at(40_000);
    const n = r.breakEvenCount!;
    expect(n * r.contributionCents - r.fixedCents).toBeGreaterThanOrEqual(0);
    expect((n - 1) * r.contributionCents - r.fixedCents).toBeLessThan(0);
  });

  it("un prix qui ne couvre même pas le coût par inscrite n'a aucun seuil", () => {
    const r = at(5_000);
    expect(r.contributionCents).toBeLessThan(0);
    expect(r.breakEvenCount).toBeNull();
    expect(r.marginCount).toBeNull();
    expect(r.verdict).toBe("no-go");
    expect(r.sentence).toContain("chaque inscrite coûte plus");
  });

  it("sans coûts fixes, la première inscrite couvre déjà ses coûts", () => {
    const r = computeLaunch({ ...EMPTY_INPUTS, priceCents: 10_000, capacity: 10, coachCount: 0, kitCents: 1_000 });
    expect(r.fixedCents).toBe(0);
    expect(r.ready).toBe(true);
    expect(r.breakEvenCount).toBe(0);
    expect(r.marginCount).toBe(1);
    expect(r.verdict).toBe("go");
  });

  it("aucun coût saisi : pas de verdict (sinon tout programme prérempli serait GO)", () => {
    const r = computeLaunch({ ...EMPTY_INPUTS, priceCents: 29_500, capacity: 10, sessions: 12, hoursPerSession: 1.5 });
    expect(r.ready).toBe(false);
    expect(r.missing).toBe("costs");
    expect(r.verdict).toBe("no-go");
    expect(r.headline).toBe("Entrez les coûts du programme");
    expect(r.rules.every((x) => x.ok === null)).toBe(true);
    expect(at(40_000).missing).toBeNull();
    expect(at(0).missing).toBe("price-capacity");
  });
});

describe("verdict à 70 % de remplissage", () => {
  it("NO-GO quand la marge est sous 35 %", () => {
    const r = at(40_000);
    expect(r.pessimisticCount).toBe(14);
    expect(r.profit70Cents).toBe(153_340);
    expect(r.margin70).toBeCloseTo(0.2738, 3);
    expect(r.verdict).toBe("no-go");
    expect(r.headline).toBe("NO-GO : seulement 27 % de marge à 70 % de remplissage");
    expect(flat(r.sentence)).toContain("un prix d'au moins 593 $");
    expect(flat(r.sentence)).toContain("coûts fixes d'au plus 1 933 $");
  });

  it("À RISQUE entre 35 % et 50 %", () => {
    const r = at(50_000);
    expect(r.margin70).toBeCloseTo(0.4133, 3);
    expect(r.verdict).toBe("risque");
    expect(r.headline).toBe("À risque : 41 % de marge à 70 % de remplissage");
  });

  it("GO à 50 % de marge ou plus", () => {
    const r = at(60_000);
    expect(r.profit70Cents).toBe(425_220);
    expect(r.margin70).toBeCloseTo(0.5062, 3);
    expect(r.verdict).toBe("go");
    expect(r.headline).toBe("GO : 50 % de marge même à 70 % de remplissage");
    expect(r.rules.slice(0, 3).every((rule) => rule.ok === true)).toBe(true);
    expect(r.breakEvenCount).toBe(7);
    expect(r.marginCount).toBe(14);
  });

  it("un prix sous le prix coûtant perd de l'argent", () => {
    const r = at(20_000);
    expect(r.floorPriceCents!).toBeGreaterThan(20_000);
    expect(r.profit70Cents).toBeLessThan(0);
    expect(r.verdict).toBe("no-go");
    expect(flat(r.headline)).toBe("NO-GO : perte de 1 185 $ à 70 % de remplissage");
    expect(r.rules.find((x) => x.key === "pessimistic")?.ok).toBe(false);
    expect(r.rules.find((x) => x.key === "price")?.ok).toBe(false);
  });

  it("les scénarios de remplissage vont de la moitié au groupe plein", () => {
    const r = at(60_000);
    expect(r.scenarios.map((s) => s.count)).toEqual([10, 14, 16, 20]);
    const full = r.scenarios.find((s) => s.key === "full")!;
    expect(full.revenueCents).toBe(1_200_000);
    expect(full.costCents).toBe(320_000 + 20 * 6_770);
  });
});

describe("bornes", () => {
  it("N = 0 : pas de verdict, aucun prix plancher", () => {
    const r = at(40_000, { capacity: 0 });
    expect(r.ready).toBe(false);
    expect(r.floorPriceCents).toBeNull();
    expect(r.methodFloorCents).toBeNull();
    expect(r.goPriceCents).toBeNull();
    expect(r.pessimisticCount).toBe(0);
    expect(r.margin70).toBeNull();
    expect(r.verdict).toBe("no-go");
    expect(r.headline).toBe("Entrez un prix et un nombre de places");
    expect(r.rules.every((x) => x.ok === null)).toBe(true);
  });

  it("prix à 0 : pas de verdict", () => {
    const r = at(0);
    expect(r.ready).toBe(false);
    expect(r.breakEvenCount).toBeNull();
  });

  it("une seule place : 70 % ne donne aucune inscrite", () => {
    const r = at(60_000, { capacity: 1 });
    expect(r.pessimisticCount).toBe(0);
    expect(r.verdict).toBe("no-go");
    expect(r.headline).toContain("trop peu de places");
  });

  it("entrées vides ou négatives ramenées à des valeurs sûres", () => {
    const n = normalizeInputs({ priceCents: -500, capacity: 12.7, hoursPerSession: "1,5" as unknown as number, presales: "" as unknown as number, startDate: "15/12/2026", paymentsPerFamily: Number.NaN });
    expect(n.priceCents).toBe(0);
    expect(n.capacity).toBe(12);
    expect(n.hoursPerSession).toBe(1.5);
    expect(n.presales).toBeNull();
    expect(n.startDate).toBeNull();
    expect(n.paymentsPerFamily).toBe(0);
    expect(normalizeInputs(null)).toEqual(EMPTY_INPUTS);
  });

  it("arrondit le remplissage vers le bas, sans erreur de virgule flottante", () => {
    expect(fillCount(18, 0.7)).toBe(12);
    expect(fillCount(10, 0.7)).toBe(7);
    expect(fillCount(30, 0.7)).toBe(21);
    expect(fillCount(0, 0.7)).toBe(0);
  });

  it("le verdict et l'affichage utilisent la même marge arrondie", () => {
    expect(verdictFromMargin(0.4996)).toBe("go");
    expect(marginLabel(0.4996)).toBe("50 %");
    expect(verdictFromMargin(0.4994)).toBe("risque");
    expect(marginLabel(0.4994)).toBe("49 %");
    expect(verdictFromMargin(0.35)).toBe("risque");
    expect(verdictFromMargin(0.3494)).toBe("no-go");
    expect(verdictFromMargin(null)).toBe("no-go");
    expect(marginLabel(-0.123)).toBe("−12 %");
    expect(marginLabel(null)).toBe("—");
  });

  it("formate les montants au dollar, vers le haut pour les prix planchers", () => {
    expect(flat(dollars(123_401))).toBe("1 234 $");
    expect(flat(dollars(21_601, true))).toBe("217 $");
    expect(flat(dollars(21_600, true))).toBe("216 $");
    expect(dollars(-5_000)).toBe("−50 $");
  });
});

describe("préventes et date de début", () => {
  it("à plus de 2 semaines du début, des préventes basses ne bloquent pas encore", () => {
    const r = at(60_000, { presales: 5, startDate: "2026-11-20" }, "2026-11-01");
    expect(r.presalesCheckDate).toBe("2026-11-06");
    expect(r.daysToStart).toBe(19);
    expect(r.presalesBlock).toBe(false);
    expect(r.verdict).toBe("go");
    expect(r.rules.find((x) => x.key === "presales")?.ok).toBeNull();
    expect(r.scenarios[0]).toMatchObject({ key: "presales", count: 5 });
  });

  it("à moins de 2 semaines, des préventes sous le seuil de survie donnent NO-GO", () => {
    const r = at(60_000, { presales: 5, startDate: "2026-11-20" }, "2026-11-10");
    expect(r.economicVerdict).toBe("go");
    expect(r.presalesBlock).toBe(true);
    expect(r.verdict).toBe("no-go");
    expect(r.headline).toBe("NO-GO : 5 préventes sur 7 nécessaires, à 10 jours du début");
    expect(r.rules.find((x) => x.key === "presales")?.ok).toBe(false);
  });

  it("des préventes au seuil de survie gardent le GO", () => {
    const r = at(60_000, { presales: 7, startDate: "2026-11-20" }, "2026-11-10");
    expect(r.presalesBlock).toBe(false);
    expect(r.verdict).toBe("go");
    expect(r.rules.find((x) => x.key === "presales")?.ok).toBe(true);
  });

  it("signale dans Aujourd'hui les lancements des 14 prochains jours sous le seuil", () => {
    expect(needsPresalesAlert({ startDate: "2026-11-20", presales: 5, breakEvenCount: 7 }, "2026-11-10")).toBe(true);
    expect(needsPresalesAlert({ startDate: "2026-11-20", presales: 7, breakEvenCount: 7 }, "2026-11-10")).toBe(false);
    expect(needsPresalesAlert({ startDate: "2026-12-20", presales: 0, breakEvenCount: 7 }, "2026-11-10")).toBe(false);
    expect(needsPresalesAlert({ startDate: "2026-11-01", presales: 0, breakEvenCount: 7 }, "2026-11-10")).toBe(false);
    expect(needsPresalesAlert({ startDate: "2026-11-15", presales: 20, breakEvenCount: null }, "2026-11-10")).toBe(true);
    expect(daysBetween("2026-11-10", "2026-11-24")).toBe(14);
  });
});

describe("préremplissage et comparaison", () => {
  const program: ProgramSource = {
    kind: "session",
    id: "garcons-2014",
    key: "session:garcons-2014",
    label: "Programme intensif spécial garçons 2014",
    group: "Programmes à dates fixes",
    priceCents: 29_500,
    capacity: 10,
    sessions: 12,
    hoursPerSession: 1.5,
    presales: 6,
    otherFixedCents: 0,
    startDate: "2026-10-31",
    note: null
  };

  it("reprend le prix, les places, les séances, les préventes et la date d'un programme", () => {
    const r = applyProgram({ ...base, otherFixedCents: 12_300 }, program);
    expect(r).toMatchObject({ priceCents: 29_500, capacity: 10, sessions: 12, hoursPerSession: 1.5, presales: 6, startDate: "2026-10-31", otherFixedCents: 12_300 });
    expect(applyProgram(base, { ...program, capacity: null, sessions: null, otherFixedCents: 4_000 })).toMatchObject({ capacity: 20, sessions: 10, otherFixedCents: 4_000 });
  });

  it("reprend le coût horaire et le montant d'un contrat de terrain", () => {
    expect(venueHourlyCents(539_000, 154)).toBe(3_500);
    expect(venueHourlyCents(100_000, 0)).toBe(0);
    const r = applyVenue(base, { id: "v", label: "École de la Voltige", period: "", hours: 154, totalCents: 539_000, hourlyCents: 3_500, taxIncluded: false });
    expect(r.fieldHourlyCents).toBe(3_500);
    expect(r.fieldContractCents).toBe(539_000);
    expect(r.fieldMode).toBe("hourly");
  });

  it("calcule la durée moyenne d'une séance", () => {
    expect(averageSessionHours([{ start: "18:30", end: "19:45" }])).toBe(1.25);
    expect(averageSessionHours([{ start: "9:00", end: "10:30" }, { start: "18 h 30", end: "20 h" }])).toBe(1.5);
    expect(averageSessionHours([{ start: null, end: "10:00" }])).toBeNull();
    expect(averageSessionHours([])).toBeNull();
  });

  it("trouve le scénario à la meilleure marge", () => {
    expect(bestScenarioIndex([{ margin70: 0.2 }, { margin70: null }, { margin70: 0.55 }, { margin70: 0.41 }])).toBe(2);
    expect(bestScenarioIndex([{ margin70: null }])).toBeNull();
    expect(bestScenarioIndex([])).toBeNull();
  });
});

describe("dates", () => {
  it("refuse une date qui n'existe pas (sinon le calcul de la date de vérification plante)", () => {
    expect(isIsoDate("2026-11-20")).toBe(true);
    expect(isIsoDate("2026-13-45")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-11-2")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(normalizeInputs({ startDate: "2026-13-45" }).startDate).toBeNull();
    expect(() => computeLaunch({ ...base, priceCents: 60_000, startDate: "2026-02-30" }, "2026-02-20")).not.toThrow();
  });

  it("date d'enregistrement à l'heure du Québec, pas en UTC", () => {
    expect(torontoDay("2026-11-07T02:30:00.000Z")).toBe("2026-11-06");
    expect(torontoDay("2026-11-07T06:30:00+00:00")).toBe("2026-11-07");
    expect(torontoDay("2026-07-01T03:59:00Z")).toBe("2026-06-30");
  });
});

describe("alerte des préventes dans Aujourd'hui", () => {
  const scenario = (over: Omit<Partial<WatchedScenario>, "inputs"> & { inputs?: Partial<LaunchInputs> }): WatchedScenario => ({
    id: over.id ?? "a",
    name: over.name ?? "Camp des Fêtes",
    sourceKey: over.sourceKey ?? null,
    startDate: over.startDate === undefined ? "2026-11-20" : over.startDate,
    updatedAt: over.updatedAt ?? "2026-11-01T12:00:00+00:00",
    inputs: { ...base, priceCents: 60_000, presales: 5, ...(over.inputs ?? {}) }
  });
  const none = () => null;

  it("signale un lancement des 14 prochains jours sous le seuil de survie", () => {
    const alerts = selectLaunchAlerts([scenario({})], none, "2026-11-10");
    expect(alerts).toEqual([{ scenarioId: "a", name: "Camp des Fêtes", startDate: "2026-11-20", daysToStart: 10, presales: 5, breakEvenCount: 7, linked: false }]);
    expect(selectLaunchAlerts([scenario({ inputs: { presales: 7 } })], none, "2026-11-10")).toEqual([]);
    expect(selectLaunchAlerts([scenario({ startDate: "2026-12-20" })], none, "2026-11-10")).toEqual([]);
    expect(selectLaunchAlerts([scenario({ startDate: null })], none, "2026-11-10")).toEqual([]);
  });

  it("préventes non saisies : à entrer ; scénario sans coûts : pas d'alerte", () => {
    expect(selectLaunchAlerts([scenario({ inputs: { presales: null } })], none, "2026-11-10")[0]?.presales).toBeNull();
    const noCosts = scenario({ inputs: { ...EMPTY_INPUTS, priceCents: 30_000, capacity: 10, presales: 0 } });
    expect(selectLaunchAlerts([noCosts], none, "2026-11-10")).toEqual([]);
  });

  it("un programme relié compte les inscrites en direct", () => {
    const linked = scenario({ sourceKey: "session:garcons-2014", inputs: { presales: 2 } });
    expect(selectLaunchAlerts([linked], () => 9, "2026-11-10")).toEqual([]);
    expect(selectLaunchAlerts([linked], () => 3, "2026-11-10")[0]).toMatchObject({ presales: 3, linked: true });
  });

  it("seul le scénario le plus récent d'un programme compte : un lancement reporté n'alerte plus", () => {
    const old = scenario({ id: "old", sourceKey: "session:camp", startDate: "2026-11-20", updatedAt: "2026-11-01T12:00:00+00:00" });
    const postponed = scenario({ id: "new", sourceKey: "session:camp", startDate: "2027-01-10", updatedAt: "2026-11-08T12:00:00+00:00" });
    expect(selectLaunchAlerts([old, postponed], () => 2, "2026-11-10")).toEqual([]);
    expect(selectLaunchAlerts([old], () => 2, "2026-11-10").map((a) => a.scenarioId)).toEqual(["old"]);
  });
});
