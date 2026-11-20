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

describe("Borne iPad : les 4 mêmes questions", () => {
  const C1 = "53857a01-0000-4000-8000-000000000001";
  const C2 = "8e87db38-0000-4000-8000-000000000002";
  const G1 = "11111111-0000-4000-8000-000000000003";
  it("plaisir, fatigue, aide de la coach, aide des autres", async () => {
    const { KIOSK_QUESTIONS } = await import("@/lib/practice-survey");
    expect(KIOSK_QUESTIONS.map((q) => q.field)).toEqual(["practiceRating", "fatigue", "coach", "peer"]);
  });
  it("oui + les personnes, non = personne ; refuse une liste abîmée", async () => {
    const { parseSurveyAnswer } = await import("@/lib/practice-survey");
    expect(parseSurveyAnswer({ practiceRating: 9, fatigue: 4, coachHelped: true, coachHelpers: [C1, C2, C1], peerHelped: false, peerHelpers: [G1] })).toMatchObject({ coachHelped: true, coachHelpers: [C1, C2], peerHelped: false, peerHelpers: [] });
    expect(typeof parseSurveyAnswer({ practiceRating: 9, fatigue: 4, coachHelped: "oui" })).toBe("string");
    expect(typeof parseSurveyAnswer({ practiceRating: 9, fatigue: 4, peerHelped: true, peerHelpers: ["x"] })).toBe("string");
    // Sans les questions de la borne (portail des éducateurs), rien n'est écrasé.
    expect(parseSurveyAnswer({ practiceRating: 9, fatigue: 4 })).not.toHaveProperty("coachHelped");
    // Les anciennes questions restent lues.
    expect(parseSurveyAnswer({ practiceRating: 9, fatigue: 4, learning: 8 })).toMatchObject({ learning: 8 });
  });
  it("le résumé compte les oui et les personnes nommées", async () => {
    const { summarizeSurvey } = await import("@/lib/practice-survey");
    const s = summarizeSurvey([
      { practice_rating: 9, fatigue: 3, coach_helped: true, coach_helpers: [C1], peer_helped: true, peer_helpers: [G1] },
      { practice_rating: 7, fatigue: 5, coach_helped: false, coach_helpers: [], peer_helped: true, peer_helpers: [G1] },
      { practice_rating: 8, fatigue: 4 }
    ]);
    expect(s.coachHelp).toEqual({ answered: 2, yes: 1 });
    expect(s.peerHelp).toEqual({ answered: 2, yes: 2 });
    expect(s.coachMentions).toEqual({ [C1]: 1 });
    expect(s.peerMentions).toEqual({ [G1]: 2 });
  });
  it("le lien de la borne est signé par pratique", async () => {
    const { kioskKey, checkKioskKey } = await import("@/lib/survey-kiosk");
    const id = "230fcbaf-d5a1-4bd3-b0f8-d454005224e1";
    expect(checkKioskKey(id, kioskKey(id))).toBe(true);
    expect(checkKioskKey("f8e8d87a-82c5-4188-8658-90201d5b96ea", kioskKey(id))).toBe(false);
    expect(checkKioskKey(id, "x")).toBe(false);
  });
});

describe("Tableau de bord du sondage", () => {
  it("regroupe par semaine (lundi) et calcule la part aidée par la coach", async () => {
    const { weeklySeries, weekOf } = await import("@/lib/practice-survey");
    expect(weekOf("2026-11-22")).toBe("2026-11-16"); // dimanche → lundi d'avant
    expect(weekOf("2026-11-16")).toBe("2026-11-16");
    const w = weeklySeries([
      { date: "2026-11-10", activity_id: "a", practice_rating: 8, fatigue: 4 },
      { date: "2026-11-17", activity_id: "b", practice_rating: 9, fatigue: 3, coach_helped: true },
      { date: "2026-11-19", activity_id: "c", practice_rating: 7, fatigue: 5, coach_helped: false },
      { date: "2026-11-19", activity_id: "c", practice_rating: null, fatigue: null }
    ]);
    expect(w).toEqual([
      { week: "2026-11-09", answered: 1, pleasure: 8, fatigue: 4, coachHelpPct: null },
      { week: "2026-11-16", answered: 2, pleasure: 8, fatigue: 4, coachHelpPct: 50 }
    ]);
  });
  it("taux par coach : nommée sur les filles de ses pratiques", async () => {
    const { coachHelpRates } = await import("@/lib/practice-survey");
    const rows = [
      { date: "2026-11-17", activity_id: "a", practice_rating: 9, fatigue: 3, coach_helped: true, coach_helpers: ["will"] },
      { date: "2026-11-17", activity_id: "a", practice_rating: 9, fatigue: 3, coach_helped: true, coach_helpers: ["will", "noura"] },
      { date: "2026-11-17", activity_id: "a", practice_rating: 9, fatigue: 3, coach_helped: false, coach_helpers: [] },
      { date: "2026-11-18", activity_id: "b", practice_rating: 9, fatigue: 3, coach_helped: true, coach_helpers: ["noura"] }
    ];
    const r = coachHelpRates(rows, new Map([["a", ["will", "noura"]], ["b", ["noura"]]]));
    expect(r).toEqual([
      { coachId: "will", practices: 1, asked: 3, named: 2, pct: 67 },
      { coachId: "noura", practices: 2, asked: 4, named: 2, pct: 50 }
    ]);
  });
});
