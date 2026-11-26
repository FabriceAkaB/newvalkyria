import { describe, expect, it } from "vitest";

import { ballMasteryState, isBallMasteryBlock, withoutSkippedGestures } from "@/lib/ball-mastery-skip";

const types: Record<string, string> = { bm: "ball-mastery", rondo: "rondo" };
const typeOf = (id: string) => types[id];

describe("Ball mastery fait aujourd'hui ? (JP, 25 nov. 2026)", () => {
  it("reconnaît un bloc de ball mastery par son type de bloc ou par l'exercice de la banque", () => {
    expect(isBallMasteryBlock({ block_type: "Ball mastery", exercise_id: null }, typeOf)).toBe(true);
    expect(isBallMasteryBlock({ block_type: "Échauffement", exercise_id: "bm" }, typeOf)).toBe(true);
    expect(isBallMasteryBlock({ block_type: "Rondo", exercise_id: "rondo" }, typeOf)).toBe(false);
  });

  it("« Non » seulement quand tous les blocs de ball mastery sont pas faits ; sans ball mastery, rien à demander", () => {
    expect(ballMasteryState([{ block_type: "Rondo", exercise_id: "rondo", not_done: true }], typeOf)).toEqual({ planned: false, skipped: false });
    expect(ballMasteryState([{ block_type: "Ball mastery", exercise_id: "bm", not_done: false }, { block_type: "Rondo", exercise_id: "rondo", not_done: true }], typeOf)).toEqual({ planned: true, skipped: false });
    expect(ballMasteryState([{ block_type: "Ball mastery", exercise_id: "bm", not_done: true }, { block_type: "Rondo", exercise_id: "rondo" }], typeOf)).toEqual({ planned: true, skipped: true });
    expect(ballMasteryState([{ block_type: "Ball mastery", exercise_id: "bm", not_done: true }, { block_type: "Ball mastery", exercise_id: null, not_done: false }], typeOf).skipped).toBe(false);
  });

  it("retire les gestes notés ce jour-là et ceux « à retravailler » qu'ils ont donnés, garde ceux ajoutés à la main", () => {
    const ev = { activity_id: "a", gesture_scores: { "Right Foot Weave": 3, "Toe Taps": 8 }, gestures: ["Right Foot Weave", "Contrôle pied gauche"] };
    expect(withoutSkippedGestures(ev, true)).toEqual({ activity_id: "a", gesture_scores: {}, gestures: ["Contrôle pied gauche"] });
    expect(withoutSkippedGestures(ev, false)).toBe(ev);
    expect(withoutSkippedGestures({ gesture_scores: null, gestures: null }, true)).toEqual({ gesture_scores: {}, gestures: null });
  });
});
