import { describe, expect, it } from "vitest";
import { cleanGestureScores, difficultGestures, observerOf } from "@/lib/gesture-scores";

describe("notes par geste", () => {
  it("garde seulement des notes de 1 à 10", () => {
    expect(cleanGestureScores({ "Sole Rolls": 3, Cruyff: 10, X: 0, Y: 11, Z: "7", W: 4.5 })).toEqual({ "Sole Rolls": 3, Cruyff: 10, Z: 7 });
    expect(cleanGestureScores(null)).toEqual({});
  });
  it("4 ou moins = à retravailler", () => {
    expect(difficultGestures({ A: 4, B: 5, C: 1 })).toEqual(["A", "C"]);
  });
  it("chaque fille a un éducateur, la même répartition pour tous", () => {
    const m = observerOf(["p1", "p2", "p3"], ["c2", "c1"]);
    expect([m.get("p1"), m.get("p2"), m.get("p3")]).toEqual(["c1", "c2", "c1"]);
  });
});
