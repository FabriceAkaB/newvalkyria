import { describe, expect, it } from "vitest";

import { channelCosts, goalPeriods, measure, monthlyGoals, pace, prospectEvents, reviewsGained, weeklyGoalsFor, type AcqEvents } from "@/lib/acquisition-goals";

const empty = (): AcqEvents => ({ forms: [], clientSince: new Map(), manualProspects: [], trials: [], inscriptions: [], reviewTotals: [], posts: [], shoots: [], spend: [] });

describe("objectifs du plan", () => {
  it("semaine : objectifs du mois de son jeudi, aperçu de décembre avant le plan", () => {
    expect(weeklyGoalsFor("2026-11-23")).toMatchObject({ month: "2026-12", preview: true });
    expect(weeklyGoalsFor("2026-11-30").month).toBe("2026-12"); // jeudi 3 déc.
    expect(weeklyGoalsFor("2026-12-28").month).toBe("2026-12"); // jeudi 31 déc.
    expect(weeklyGoalsFor("2027-01-25").goals.trialsBooked).toBe(8);
    expect(weeklyGoalsFor("2027-02-22").goals.prospects).toBe(40);
    expect(weeklyGoalsFor("2027-03-15")).toMatchObject({ month: "2027-02", preview: false });
  });

  it("mois : cible de la semaine × jours ÷ 7", () => {
    expect(monthlyGoals("2026-12")).toMatchObject({ prospects: 44, trialsBooked: 18, inscriptions: 9, posts: 31, trialsDone: null });
    expect(monthlyGoals("2027-02")).toMatchObject({ trialsBooked: 48, trialReels: 20 });
    expect(monthlyGoals("2026-11")).toBeNull();
  });

  it("périodes du lundi : semaine, semaine dernière, mois, trimestre", () => {
    const p = goalPeriods("2026-12-09");
    expect(p.map((x) => [x.key, x.from, x.to])).toEqual([
      ["semaine", "2026-12-07", "2026-12-13"],
      ["semaine-derniere", "2026-11-30", "2026-12-06"],
      ["mois", "2026-12-01", "2026-12-31"],
      ["trimestre", "2026-12-01", "2027-02-28"]
    ]);
    expect(p[0].elapsed).toBeCloseTo(3 / 7);
    const before = goalPeriods("2026-11-25");
    expect(before[2]).toMatchObject({ from: "2026-12-01", preview: true, elapsed: 0 });
    expect(before[1].goals).toBeNull(); // semaine du 16 nov. : pas d'objectif
  });

  it("rythme au prorata du temps écoulé", () => {
    expect(pace(4, 4, 0.5)).toBe("atteint");
    expect(pace(2, 4, 0.5)).toBe("en-route");
    expect(pace(1, 4, 0.7)).toBe("en-retard");
    expect(pace(0, 4, 0)).toBe("a-venir");
    expect(pace(3, null, 0.5)).toBeNull();
  });
});

describe("mesures", () => {
  it("prospect = premier formulaire d'une famille pas encore cliente", () => {
    const forms = [
      { family: "a@x", day: "2026-12-02", source: null },
      { family: "a@x", day: "2026-12-02", source: "reseaux" },
      { family: "a@x", day: "2026-12-09", source: "google" },
      { family: "b@x", day: "2026-12-03", source: "parrainage" },
      { family: "c@x", day: "2026-09-01", source: null },
      { family: "c@x", day: "2026-12-04", source: null }
    ];
    const p = prospectEvents(forms, new Map([["b@x", "2026-10-01"]]));
    expect(p).toEqual([
      { family: "c@x", day: "2026-09-01", source: null },
      { family: "a@x", day: "2026-12-02", source: "reseaux" }
    ]);
  });

  it("avis gagnés d'un relevé à l'autre, null sans relevé dans la période", () => {
    const totals = [
      { day: "2026-11-30", total: 2 },
      { day: "2026-12-07", total: 9 }
    ];
    expect(reviewsGained(totals, "2026-12-07", "2026-12-13")).toBe(7);
    expect(reviewsGained(totals, "2026-11-30", "2026-12-06")).toBe(2);
    expect(reviewsGained(totals, "2026-12-14", "2026-12-20")).toBeNull();
    expect(reviewsGained([], "2026-12-14", "2026-12-20")).toBeNull();
  });

  it("essais réservés, faits (sans annulés ni absentes), publications sans double compte, dépenses", () => {
    const e = empty();
    e.trials = [
      { day: "2026-12-07", trialDate: "2026-12-09", cancelled: false, absent: false, source: "reseaux" },
      { day: "2026-12-08", trialDate: "2026-12-12", cancelled: false, absent: false, source: null },
      { day: "2026-12-01", trialDate: "2026-12-08", cancelled: false, absent: true, source: null },
      { day: "2026-12-01", trialDate: "2026-12-08", cancelled: true, absent: false, source: null }
    ];
    e.posts = [
      { day: "2026-12-07", key: "g1" },
      { day: "2026-12-07", key: "g1" },
      { day: "2026-12-08", key: "g2" }
    ];
    e.shoots = [
      { day: "2026-12-07", trialReel: false },
      { day: "2026-12-09", trialReel: false },
      { day: "2026-12-09", trialReel: true }
    ];
    e.spend = [{ day: "2026-12-08", cents: 1500 }];
    e.manualProspects = [{ day: "2026-12-08", source: "reseaux", count: 3 }];
    const m = measure(e, "2026-12-07", "2026-12-13", "2026-12-10");
    expect(m).toMatchObject({ trialsBooked: 2, trialsDone: 1, posts: 3, trialReels: 1, spendCents: 1500, prospects: 3, reviews: null });
  });

  it("coût par canal : la publicité porte les dépenses, ligne « Tous les canaux »", () => {
    const e = empty();
    e.forms = [
      { family: "a", day: "2027-01-20", source: "publicite" },
      { family: "b", day: "2027-01-20", source: "publicite" },
      { family: "c", day: "2027-01-21", source: "parrainage" }
    ];
    e.trials = [
      { day: "2027-01-20", trialDate: null, cancelled: false, absent: false, source: "publicite" },
      { day: "2027-01-21", trialDate: null, cancelled: false, absent: false, source: "parrainage" }
    ];
    e.inscriptions = [{ day: "2027-01-22", source: "publicite" }];
    e.spend = [{ day: "2027-01-20", cents: 6000 }];
    const rows = channelCosts(e, "2027-01-18", "2027-01-24");
    const pub = rows.find((r) => r.source === "publicite")!;
    expect(pub).toMatchObject({ prospects: 2, trials: 1, inscriptions: 1, spendCents: 6000, costPerProspect: 3000, costPerTrial: 6000, costPerInscription: 6000 });
    expect(rows.find((r) => r.source === "parrainage")).toMatchObject({ trials: 1, costPerTrial: null });
    expect(rows.at(-1)).toMatchObject({ label: "Tous les canaux", prospects: 3, trials: 2, costPerTrial: 3000 });
  });
});
