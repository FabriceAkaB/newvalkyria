import { describe, expect, it } from "vitest";

import { isAnswered, parseSurveyAnswer, SCALE_VALUES, summarizeSurvey } from "@/lib/practice-survey";

describe("sondage de fin de pratique", () => {
  it("note de 1 à 10", () => {
    expect(SCALE_VALUES[0]).toBe(1);
    expect(SCALE_VALUES.at(-1)).toBe(10);
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

describe("Borne iPad : 5 questions sur 10", () => {
  it("accepte apprentissage, compréhension et confiance, et refuse une note hors échelle", async () => {
    const { parseSurveyAnswer, KIOSK_QUESTIONS } = await import("@/lib/practice-survey");
    expect(KIOSK_QUESTIONS.map((q) => q.field)).toEqual(["practiceRating", "fatigue", "learning", "understanding", "confidence"]);
    const ok = parseSurveyAnswer({ practiceRating: 9, fatigue: 4, learning: 8, understanding: 10, confidence: 7 });
    expect(ok).toMatchObject({ learning: 8, understanding: 10, confidence: 7 });
    expect(typeof parseSurveyAnswer({ practiceRating: 9, fatigue: 4, learning: 12 })).toBe("string");
    // Sans les nouvelles questions (portail des éducateurs), rien n'est écrasé.
    expect(parseSurveyAnswer({ practiceRating: 9, fatigue: 4 })).not.toHaveProperty("learning");
  });
  it("le lien de la borne est signé par pratique", async () => {
    const { kioskKey, checkKioskKey } = await import("@/lib/survey-kiosk");
    const id = "230fcbaf-d5a1-4bd3-b0f8-d454005224e1";
    expect(checkKioskKey(id, kioskKey(id))).toBe(true);
    expect(checkKioskKey("f8e8d87a-82c5-4188-8658-90201d5b96ea", kioskKey(id))).toBe(false);
    expect(checkKioskKey(id, "x")).toBe(false);
  });
});
