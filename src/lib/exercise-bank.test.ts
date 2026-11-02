import { describe, expect, it } from "vitest";

import { applicableBands, checklistSummary, compareBank, computeBankStatus, matchesFilters, parseScores, planningAvailability, recommendedVenue, weekStartOf, type ExerciseSheetFields, type RatingLite } from "@/lib/exercise-bank";

const r = (version: number, total: number, coach: string, date: string): RatingLite => ({ exercise_version: version, total, coach_id: coach, activity_date: date, created_at: `${date}T20:00:00Z` });
const v = (version: number, validated: number | null = null, retired: string | null = null) => ({ version, validated_version: validated, retired_at: retired });

describe("statut calculé", () => {
  it("à tester sans note", () => {
    expect(computeBankStatus(v(1), []).status).toBe("a-tester");
  });

  it("une seule note de 8 ne suffit pas", () => {
    const s = computeBankStatus(v(1), [r(1, 9, "a", "2026-11-03")]);
    expect(s.status).toBe("a-tester");
    expect(s.coachesAtApproval).toBe(1);
  });

  it("deux notes de 8+ du même éducateur ne suffisent pas", () => {
    expect(computeBankStatus(v(1), [r(1, 9, "a", "2026-11-03"), r(1, 8, "a", "2026-11-10")]).status).toBe("a-tester");
  });

  it("2 éducateurs différents à 8+ : à valider, puis approuvé avec la validation de JP", () => {
    const ratings = [r(1, 9, "a", "2026-11-03"), r(1, 8, "b", "2026-11-05")];
    expect(computeBankStatus(v(1), ratings).status).toBe("a-valider");
    const s = computeBankStatus(v(1, 1), ratings);
    expect(s.status).toBe("approuve");
    expect(s.average).toBe(8.5);
  });

  it("une validation d'une ancienne version ne compte pas", () => {
    expect(computeBankStatus(v(2, 1), [r(2, 9, "a", "2026-11-03"), r(2, 9, "b", "2026-11-05")]).status).toBe("a-valider");
  });

  it("une note sous 8 : à changer", () => {
    const s = computeBankStatus(v(1, 1), [r(1, 9, "a", "2026-11-03"), r(1, 9, "b", "2026-11-04"), r(1, 7, "c", "2026-11-05")]);
    expect(s.status).toBe("a-changer");
    expect(s.lastLowDate).toBe("2026-11-05");
  });

  it("nouvelle version : le compteur repart à zéro", () => {
    const s = computeBankStatus(v(2), [r(1, 6, "a", "2026-11-03")]);
    expect(s.status).toBe("a-tester");
    expect(s.count).toBe(0);
    expect(s.countAll).toBe(1);
  });

  it("retiré si la moyenne reste sous 6 après la nouvelle version", () => {
    expect(computeBankStatus(v(2), [r(1, 5, "a", "2026-11-03"), r(2, 6, "b", "2026-11-12")]).status).toBe("retire");
  });

  it("pas retiré si la nouvelle version marche", () => {
    expect(computeBankStatus(v(2), [r(1, 2, "a", "2026-11-03"), r(2, 9, "b", "2026-11-12")]).status).toBe("a-tester");
  });

  it("une note basse isolée reste « à changer », pas retirée", () => {
    expect(computeBankStatus(v(1), [r(1, 3, "a", "2026-11-03")]).status).toBe("a-changer");
  });

  it("retiré à la main par JP", () => {
    expect(computeBankStatus(v(1, 1, "2026-11-20T00:00:00Z"), []).status).toBe("retire");
  });
});

describe("pas la même semaine", () => {
  it("semaine du dimanche au samedi", () => {
    expect(weekStartOf("2026-11-04")).toBe("2026-11-01");
    expect(weekStartOf("2026-11-08")).toBe("2026-11-08");
  });

  it("bloque la même semaine, permet la semaine suivante", () => {
    const ratings = [r(1, 6, "a", "2026-11-03")];
    const s = computeBankStatus(v(2), ratings);
    expect(planningAvailability(s, ratings, "2026-11-06").ok).toBe(false);
    expect(planningAvailability(s, ratings, "2026-11-09").ok).toBe(true);
  });

  it("« à changer » ne peut pas être planifié avant la nouvelle version", () => {
    const ratings = [r(1, 6, "a", "2026-11-03")];
    expect(planningAvailability(computeBankStatus(v(1), ratings), ratings, "2026-11-20").ok).toBe(false);
  });
});

describe("grille sur 10", () => {
  it("5 critères à 0, 1 ou 2", () => {
    expect(parseScores({ engagement: 2, touches: 2, objectif: 1, adapte: 2, explication: 1 })?.total).toBe(8);
    expect(parseScores({ engagement: 2, touches: 3, objectif: 1, adapte: 2, explication: 1 })).toBeNull();
    expect(parseScores({ engagement: 2 })).toBeNull();
  });
});

const sheet = (patch: Partial<ExerciseSheetFields>): ExerciseSheetFields => ({
  title: "Test", objective: null, category: null, exercise_type: null, session_place: null, age_groups: [], level: null, min_players: null, max_players: null,
  venue: null, duration_minutes: null, material: null, instructions: null, coaching_points: null, setup_5_7: null, setup_8_10: null, setup_11_16: null,
  variant_easier: null, variant_harder: null, variant_cognitive: null, progression: null, physical_metrics: null, image_url: null, video_url: null, diagram_data: null, author: null,
  ...patch
});

describe("liste de vérification Valkyria", () => {
  it("signale ce qui manque, avec les métriques pour le physique", () => {
    const s = checklistSummary(sheet({ exercise_type: "physique", objective: "Vitesse" }));
    expect(s.complete).toBe(false);
    expect(s.missing.map((m) => m.key)).toContain("metrics");
    expect(checklistSummary(sheet({ exercise_type: "ball-mastery" })).items.some((i) => i.key === "metrics")).toBe(false);
  });

  it("organisation demandée seulement pour les tranches qui concernent l'exercice", () => {
    expect(applicableBands(5, 7).map((b) => b.key)).toEqual(["setup_5_7"]);
    expect(applicableBands(8, 14).map((b) => b.key)).toEqual(["setup_8_10", "setup_11_16"]);
    expect(applicableBands(null, null)).toHaveLength(3);
  });

  it("fiche complète", () => {
    const s = checklistSummary(
      sheet({
        exercise_type: "ball-mastery", objective: "o", category: "Ball mastery", session_place: "ball-mastery", age_groups: ["U9"], level: "Développement", min_players: 6, max_players: 10,
        venue: "gymnase", duration_minutes: 12, material: "1 ballon par fille", instructions: "d", coaching_points: "c", setup_5_7: "a", setup_8_10: "b",
        variant_easier: "e", variant_harder: "h", variant_cognitive: "c", progression: "p", video_url: "https://x", author: "JP"
      })
    );
    expect(s.missing).toEqual([]);
  });
});

describe("lieu conseillé et recherche", () => {
  it("gymnase pour la technique, synthétique pour la prise de décision", () => {
    expect(recommendedVenue("ball-mastery", "Passe")?.venue).toBe("gymnase");
    expect(recommendedVenue("analytique", "Prise de décision")?.venue).toBe("synthetique");
    expect(recommendedVenue("forme-jouee", null)?.venue).toBe("synthetique");
  });

  const entry = (title: string, status: "approuve" | "a-tester", average: number | null, patch: Partial<Parameters<typeof matchesFilters>[0]> = {}) => ({
    title, category: "Finition", exercise_type: "jeu-reduit", session_place: "forme-jouee", age_groups: ["U10"], venue: "gymnase", min_players: 8, max_players: 14, objective: null,
    bank: { status, reason: "", average, count: average === null ? 0 : 2, countAll: 2, coachesAtApproval: 2, lastLowDate: null, top: false },
    ...patch
  });

  it("« finition, U10, gymnase, 12 joueuses, approuvé »", () => {
    const e = entry("A", "approuve", 9);
    expect(matchesFilters(e, { theme: "finition", age: "U10", venue: "gymnase", players: 12, status: "approuve" })).toBe(true);
    expect(matchesFilters(e, { players: 16 })).toBe(false);
    expect(matchesFilters(e, { minScore: 9.5 })).toBe(false);
  });

  it("top exercices d'abord", () => {
    const list = [entry("C", "a-tester", null), entry("B", "approuve", 8.5), entry("A", "approuve", 9.5)].sort(compareBank);
    expect(list.map((e) => e.title)).toEqual(["A", "B", "C"]);
  });
});
