import { describe, expect, it } from "vitest";

import { DEFAULT_STRUCTURE, gestureChecklist, gesturesPerLevel, parsePrinciples, parseStructure, structureTotal } from "@/lib/coaching-method";

describe("structure de séance", () => {
  it("la proposition de départ tient dans une pratique de 1 h 25", () => {
    expect(structureTotal(DEFAULT_STRUCTURE)).toBe(85);
  });
  it("refuse une structure illisible et nettoie une structure valide", () => {
    expect(parseStructure([])).toBeNull();
    expect(parseStructure([{ place: "inconnu", minutes: 10 }])).toBeNull();
    expect(parseStructure([{ place: "technique", minutes: 200 }])).toBeNull();
    expect(parseStructure([{ place: "technique", minutes: "18", label: "", objective: " Passes ", rules: "" }])).toEqual([
      { place: "technique", label: "Technique", minutes: 18, objective: "Passes", rules: "" }
    ]);
  });
});

describe("principes", () => {
  it("garde seulement les principes remplis", () => {
    expect(parsePrinciples([{ title: "Confiance", text: "" }, { title: "", text: "" }])).toEqual([{ title: "Confiance", text: "" }]);
    expect(parsePrinciples("x")).toBeNull();
  });
});

describe("gestes", () => {
  const empty = { execution: null, key_points: [], common_mistakes: null, video_url: null, progression: {}, passport_level: null };
  it("dit ce qui manque à la fiche d'un geste", () => {
    const c = gestureChecklist({ ...empty, passport_level: "bronze", execution: "Semelle vers l'arrière", key_points: ["a", "b"] });
    expect(c.done).toBe(2);
    expect(c.missing).toContain("3 points clés");
    expect(c.missing).toContain("Progression en 4 étapes");
    const full = gestureChecklist({
      passport_level: "or",
      execution: "x",
      key_points: ["a", "b", "c"],
      common_mistakes: "y",
      video_url: "https://youtu.be/z",
      progression: { "sur-place": "1", "en-mouvement": "2", "a-vitesse": "3", "sous-pression": "4" }
    });
    expect(full.done).toBe(full.total);
  });
  it("compte les 5 gestes de base par niveau", () => {
    const per = gesturesPerLevel([
      ...Array.from({ length: 5 }, () => ({ passport_level: "bronze" as const, active: true })),
      { passport_level: "argent" as const, active: true },
      { passport_level: "argent" as const, active: false }
    ]);
    expect(per.find((p) => p.level === "bronze")).toEqual({ level: "bronze", count: 5, target: 5, complete: true });
    expect(per.find((p) => p.level === "argent")?.count).toBe(1);
  });
});
