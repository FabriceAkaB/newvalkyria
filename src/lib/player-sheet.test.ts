import { describe, expect, it } from "vitest";

import { briefingLines, checkSheet, cleanSheet, filledCount, SHEET_FIELD_MAX } from "@/lib/player-sheet";

describe("fiche joueuse", () => {
  it("nettoie les réponses : texte seulement, vide = null, longueur bornée", () => {
    const a = cleanSheet({ likes: "  Les   dribbles ", stress: 42, health: "", season_goal: "x".repeat(900), extra: "ignoré" });
    expect(a.likes).toBe("Les dribbles");
    expect(a.stress).toBeNull();
    expect(a.health).toBeNull();
    expect(a.season_goal!.length).toBe(SHEET_FIELD_MAX);
    expect(Object.keys(a)).not.toContain("extra");
    expect(filledCount(a)).toBe(2);
  });

  it("au moins une réponse", () => {
    expect(checkSheet(cleanSheet({}))).toMatch(/au moins une/);
    expect(checkSheet(cleanSheet({ encouragement: "Lui taper dans la main" }))).toBeNull();
  });

  it("lignes du briefing : la santé à part, le reste sur une ligne", () => {
    const l = briefingLines(cleanSheet({ likes: "Les dribbles", stress: "Être nommée devant le groupe", health: "Allergie aux arachides, EpiPen dans son sac", encouragement: "Un pouce en l'air" }));
    expect(l.health).toBe("Allergie aux arachides, EpiPen dans son sac");
    expect(l.sheet).toBe("aime : Les dribbles · stressée par : Être nommée devant le groupe · l'encourager : Un pouce en l'air");
    expect(briefingLines(null)).toEqual({ health: null, sheet: null });
    expect(briefingLines(cleanSheet({ likes: "a".repeat(300) }), 50).sheet!.length).toBe("aime : ".length + 50);
  });
});
