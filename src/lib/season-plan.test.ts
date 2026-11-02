import { describe, expect, it } from "vitest";

import { blockRuns, mondayOf, monthsWithoutTest, seasonWeeks } from "@/lib/season-plan";

const season = { start: "2026-09-01", end: "2027-04-18", breaks: [["2026-12-20", "2027-01-02"]] as [string, string][] };

describe("seasonWeeks", () => {
  it("donne chaque lundi de la saison et ferme les semaines des Fêtes", () => {
    const weeks = seasonWeeks(season);
    expect(weeks[0].weekStart).toBe("2026-08-31");
    expect(weeks[0].closed).toBe(false);
    expect(weeks.find((w) => w.weekStart === "2026-12-21")?.closed).toBe(true);
    expect(weeks.find((w) => w.weekStart === "2026-12-28")?.closed).toBe(true);
    expect(weeks.find((w) => w.weekStart === "2026-12-14")?.closed).toBe(false);
    expect(weeks.at(-1)?.weekStart).toBe("2027-04-12");
  });
  it("mondayOf ramène au lundi", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
  });
});

describe("blockRuns", () => {
  it("regroupe les semaines d'un même bloc et vérifie 4 à 6 semaines, sans compter les Fêtes", () => {
    const weeks = seasonWeeks(season);
    const plan: Record<string, string> = {
      "2026-11-30": "Bloc conduite", "2026-12-07": "Bloc conduite", "2026-12-14": "Bloc conduite",
      "2027-01-04": "Bloc conduite", "2027-01-11": "Bloc passes", "2027-01-18": "Bloc passes"
    };
    const runs = blockRuns(weeks, (w) => plan[w]);
    expect(runs).toEqual([
      { label: "Bloc conduite", start: "2026-11-30", weeks: 4, ok: true },
      { label: "Bloc passes", start: "2027-01-11", weeks: 2, ok: false }
    ]);
  });
});

describe("monthsWithoutTest", () => {
  it("liste les mois sans semaine de tests", () => {
    const weeks = seasonWeeks({ start: "2026-11-02", end: "2026-12-18", breaks: [] });
    expect(monthsWithoutTest(weeks, (w) => w === "2026-11-02")).toEqual(["2026-12"]);
  });
});
