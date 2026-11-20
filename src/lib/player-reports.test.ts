import { describe, expect, it } from "vitest";

import { disagreements, mergeEvaluations } from "@/lib/player-reports";

const maeva = { coachId: "m", coachName: "Maéva", ratings: { "Ball mastery": 4, Prestation: 3, Attitude: 5 }, gestureScores: { "Left Foot Weave": 7, "L Drag Double U": 4 }, difficult: ["L Drag Double U"], comment: "a" };
const noura = { coachId: "n", coachName: "Noura", ratings: { "Ball mastery": 3, Prestation: 5, Attitude: 5 }, gestureScores: { "Left Foot Weave": 6 }, difficult: [], comment: "b" };

describe("Rapports des joueuses : moyenne des éducateurs", () => {
  it("fait la moyenne de chaque critère et de chaque geste", () => {
    const m = mergeEvaluations([maeva, noura]);
    expect(m.coaches).toBe(2);
    expect(m.ratings).toEqual({ "Ball mastery": 3.5, Prestation: 4, Attitude: 5 });
    expect(m.overall).toBe(4.2);
    expect(m.gestures).toEqual([
      { name: "L Drag Double U", average: 4, scores: 1 },
      { name: "Left Foot Weave", average: 6.5, scores: 2 }
    ]);
    expect(m.difficult).toEqual(["L Drag Double U"]);
  });
  it("un seul éducateur : ses notes telles quelles ; notes invalides ignorées", () => {
    const m = mergeEvaluations([{ ...maeva, ratings: { "Ball mastery": 9, Prestation: 3 } }]);
    expect(m.ratings).toEqual({ "Ball mastery": null, Prestation: 3, Attitude: null });
  });
  it("signale un écart de 2 points ou plus", () => {
    expect(disagreements([maeva, noura])).toEqual(["Prestation"]);
    expect(disagreements([maeva])).toEqual([]);
  });
});
