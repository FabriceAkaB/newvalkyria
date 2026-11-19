import { describe, expect, it } from "vitest";

import { buildFamilyPassport, gestureState, parcoursRef } from "@/lib/family-passport";
import type { SkillTest, TestResult } from "@/lib/skill-tests";

const test = (id: string, thresholds: SkillTest["thresholds"] = {}, higher = true): SkillTest => ({
  id,
  name: `Test ${id}`,
  gesture: null,
  unit: "touches",
  higher_is_better: higher,
  duration_seconds: 30,
  protocol: null,
  thresholds,
  sort_order: 0,
  active: true,
  validated_at: null
});
const res = (test_id: string, tested_on: string, score: number): TestResult => ({ test_id, registration_id: "r1", tested_on, context: "mensuel", score, video_url: null });

describe("buildFamilyPassport", () => {
  it("vide quand rien n'est saisi", () => {
    const p = buildFamilyPassport({ tests: [test("a")], results: [], evaluations: [] });
    expect(p.empty).toBe(true);
    expect(p.level).toBeNull();
  });

  it("niveau tenu à tous ses tests notés, comparé à son premier test", () => {
    const p = buildFamilyPassport({
      tests: [test("a", { bronze: 10, argent: 20, or: 30 }), test("b", { bronze: 5, argent: 8 })],
      results: [res("a", "2026-09-01", 12), res("a", "2026-10-01", 31), res("b", "2026-10-01", 6)],
      evaluations: []
    });
    expect(p.tests.find((t) => t.testId === "a")?.level).toBe("or");
    expect(p.tests.find((t) => t.testId === "a")?.sinceFirst).toBe("+19 touches");
    expect(p.level).toBe("bronze");
    expect(p.next).toBe("argent");
  });

  it("pas de niveau tant qu'un test noté n'atteint pas le bronze", () => {
    const p = buildFamilyPassport({ tests: [test("a", { bronze: 10 })], results: [res("a", "2026-09-01", 4)], evaluations: [] });
    expect(p.level).toBeNull();
    expect(p.next).toBe("bronze");
  });

  it("gestes : dernière note, écart avec la première, signalés difficiles sans note", () => {
    const p = buildFamilyPassport({
      tests: [],
      results: [],
      evaluations: [
        { date: "2026-10-01", gesture_scores: { Semelle: 3, Crochet: 6 }, gestures: ["Roulette"] },
        { date: "2026-11-01", gesture_scores: { semelle: 9 }, gestures: ["Feinte de frappe"] }
      ],
      methodGestures: [{ name: "Semelle", passport_level: "bronze" }]
    });
    const semelle = p.gestures.find((g) => g.name === "Semelle")!;
    expect(semelle).toMatchObject({ state: "reussi", last: 9, sinceFirst: 6, level: "bronze" });
    expect(p.gestures.find((g) => g.name === "Crochet")?.state).toBe("en-progres");
    expect(p.gestures.find((g) => g.name === "Feinte de frappe")).toMatchObject({ state: "a-travailler", last: null });
    expect(p.gestures.some((g) => g.name === "Roulette")).toBe(false);
  });

  it("seuils des gestes et référence de la tâche", () => {
    expect([gestureState(4), gestureState(5), gestureState(8)]).toEqual(["a-travailler", "en-progres", "reussi"]);
    expect(parcoursRef("abc")).toBe("parcours:abc");
  });
});
