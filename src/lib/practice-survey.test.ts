import { describe, expect, it } from "vitest";

import { FATIGUE_SCALE, isAnswered, levelOf, parseSurveyAnswer, PLEASURE_SCALE, summarizeSurvey } from "@/lib/practice-survey";

describe("sondage de fin de pratique", () => {
  it("affiche le niveau le plus proche d'une note sur 10", () => {
    expect(levelOf(PLEASURE_SCALE, 10)?.label).toBe("Adoré");
    expect(levelOf(PLEASURE_SCALE, 7)?.value).toBe(6);
    expect(levelOf(FATIGUE_SCALE, 0)?.label).toBe("Pleine d'énergie");
    expect(levelOf(PLEASURE_SCALE, null)).toBeNull();
  });

  it("une réponse est complète avec le plaisir et la fatigue", () => {
    expect(isAnswered({ practiceRating: 8, fatigue: 4 })).toBe(true);
    expect(isAnswered({ practiceRating: 8, fatigue: null })).toBe(false);
    expect(isAnswered({ practiceRating: 0, fatigue: 0 })).toBe(true);
  });

  it("nettoie la réponse et refuse les valeurs hors échelle", () => {
    expect(parseSurveyAnswer({ practiceRating: 8, fatigue: 6, wantsMore: ["tirs", "tirs", "matchs"], wantsMoreNote: "  plus de   jeux de poursuite " })).toEqual({
      practiceRating: 8,
      fatigue: 6,
      wantsMore: ["tirs", "matchs"],
      wantsMoreNote: "plus de jeux de poursuite"
    });
    expect(parseSurveyAnswer({ practiceRating: 11, fatigue: 2 })).toMatch(/0 à 10/);
    expect(parseSurveyAnswer({ practiceRating: 8, fatigue: 2, wantsMore: ["n-importe"] })).toMatch(/inconnu/);
    expect(parseSurveyAnswer({ practiceRating: null, fatigue: null })).toEqual({ practiceRating: null, fatigue: null, wantsMore: [], wantsMoreNote: null });
  });

  it("résume la pratique : moyennes et demandes les plus fréquentes", () => {
    const s = summarizeSurvey([
      { practice_rating: 10, fatigue: 6, wants_more: ["matchs", "tirs"], wants_more_note: null },
      { practice_rating: 8, fatigue: 4, wants_more: ["matchs"], wants_more_note: "Plus de jeux" },
      { practice_rating: null, fatigue: null, wants_more: [] }
    ]);
    expect(s.answered).toBe(2);
    expect(s.pleasure).toBe(9);
    expect(s.fatigue).toBe(5);
    expect(s.wants.map((w) => [w.label, w.count])).toEqual([["Matchs", 2], ["Tirs au but", 1]]);
    expect(s.notes).toEqual(["Plus de jeux"]);
  });
});
