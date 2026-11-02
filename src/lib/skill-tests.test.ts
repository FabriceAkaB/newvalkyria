import { describe, expect, it } from "vitest";

import { formatGain, jour1Coverage, levelFor, parseScore, progressFor, videoFileName, type SkillTest, type TestResult } from "@/lib/skill-tests";

const touches: SkillTest = { id: "t", name: "Touches en 30 secondes", gesture: "touches", unit: "touches", higher_is_better: true, duration_seconds: 30, protocol: null, thresholds: { bronze: 40, argent: 55, or: 70, mauve: 85 }, sort_order: 1, active: true, validated_at: null };
const conduite: SkillTest = { ...touches, id: "c", name: "Conduite chronométrée", unit: "secondes", higher_is_better: false, thresholds: { bronze: 20, argent: 17, or: 15 } };
const r = (test_id: string, tested_on: string, score: number, context: TestResult["context"] = "mensuel", video_url: string | null = null): TestResult => ({ test_id, registration_id: "lea", tested_on, context, score, video_url });

describe("levelFor", () => {
  it("donne le plus haut niveau atteint, dans le bon sens", () => {
    expect(levelFor(touches, 39)).toBeNull();
    expect(levelFor(touches, 58)).toBe("argent");
    expect(levelFor(touches, 90)).toBe("mauve");
    expect(levelFor(conduite, 16)).toBe("argent");
    expect(levelFor(conduite, 21)).toBeNull();
  });
  it("sans seuils fixés, aucun niveau", () => {
    expect(levelFor({ ...touches, thresholds: {} }, 99)).toBeNull();
  });
});

describe("progressFor", () => {
  it("compare la joueuse à elle-même : écart avec le test précédent et avec le jour 1", () => {
    const p = progressFor(touches, [r("t", "2026-12-01", 52), r("t", "2026-11-03", 41, "jour-1"), r("t", "2027-01-12", 60), r("c", "2026-11-03", 18)])!;
    expect(p.first.score).toBe(41);
    expect(p.last.score).toBe(60);
    expect(p.sincePrevious).toBe(8);
    expect(p.sinceFirst).toBe(19);
    expect(p.best).toBe(60);
    expect(p.level).toBe("argent");
    expect(p.count).toBe(3);
  });
  it("pour un chrono, descendre est un progrès", () => {
    const p = progressFor(conduite, [r("c", "2026-11-03", 19.5, "jour-1"), r("c", "2026-12-01", 17.2)])!;
    expect(p.sinceFirst).toBe(2.3);
    expect(p.best).toBe(17.2);
    expect(formatGain(conduite, p.sinceFirst)).toBe("2,3 s plus vite");
  });
  it("rien sans résultat", () => {
    expect(progressFor(touches, [])).toBeNull();
  });
});

describe("formatGain", () => {
  it("affiche le progrès en mots simples", () => {
    expect(formatGain(touches, 6)).toBe("+6 touches");
    expect(formatGain(touches, -3)).toBe("−3 touches");
    expect(formatGain(touches, 0)).toBe("Pareil");
    expect(formatGain(touches, null)).toBe("—");
  });
});

describe("videoFileName", () => {
  it("suit la convention Prénom-Nom_geste_AAAA-MM-JJ_type, sans accents", () => {
    expect(videoFileName("Léa-Rose", "Côté Tremblay", "Touches", "2026-11-03")).toBe("Lea-Rose-Cote-Tremblay_touches_2026-11-03_test");
    expect(videoFileName("zoé", "o'neil", "semelle", "2026-11-10", "maison")).toBe("Zoe-O-Neil_semelle_2026-11-10_maison");
  });
});

describe("jour1Coverage", () => {
  it("compte les joueuses actives dont le test du jour 1 est filmé", () => {
    const c = jour1Coverage(["lea", "mia", "zoe"], [
      { registration_id: "lea", context: "jour-1", video_url: "https://youtu.be/x" },
      { registration_id: "mia", context: "jour-1", video_url: null },
      { registration_id: "zoe", context: "mensuel", video_url: "https://youtu.be/y" },
      { registration_id: "autre", context: "jour-1", video_url: "https://youtu.be/z" }
    ]);
    expect(c).toEqual({ filmed: 1, tested: 2, total: 3, percent: 33.3 });
  });
});

describe("parseScore", () => {
  it("lit les scores saisis au téléphone", () => {
    expect(parseScore("42")).toBe(42);
    expect(parseScore("12,5")).toBe(12.5);
    expect(parseScore("")).toBeNull();
    expect(Number.isNaN(parseScore("abc"))).toBe(true);
  });
});
