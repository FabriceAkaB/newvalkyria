import { describe, expect, it } from "vitest";

import { notObservedThisMonth, parseObservationScores } from "@/lib/coach-observations";

describe("parseObservationScores", () => {
  it("additionne les 5 critères sur 10", () => {
    expect(parseObservationScores({ parle_peu: 2, questions: 1, compliments: 2, toutes_actives: 2, plan: 1 })?.total).toBe(8);
  });
  it("refuse une grille incomplète ou hors limites", () => {
    expect(parseObservationScores({ parle_peu: 2 })).toBeNull();
    expect(parseObservationScores({ parle_peu: 3, questions: 1, compliments: 2, toutes_actives: 2, plan: 1 })).toBeNull();
  });
});

describe("notObservedThisMonth", () => {
  it("liste les coachs qui ont travaillé ce mois-ci sans observation", () => {
    const coaches = [{ id: "m", name: "Maéva" }, { id: "n", name: "Noura" }, { id: "w", name: "Will" }];
    const r = notObservedThisMonth(coaches, new Set(["m", "n"]), [{ coach_id: "m", observed_on: "2026-11-10" }, { coach_id: "n", observed_on: "2026-10-28" }], "2026-11");
    expect(r).toEqual([{ id: "n", name: "Noura" }]);
  });
});
