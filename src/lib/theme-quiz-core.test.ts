import { describe, expect, it } from "vitest";

import { buildThemeQuiz, isThemeCorrect, normTheme, parseThemeAnswer, shortTheme, themeFamilies, themeForGroup, themeRateByPractice, themeRateByWeek, themeStatusOf } from "@/lib/theme-quiz-core";

const WEEK = {
  theme: "Récupération du ballon : défendre en infériorité (semaine 2 : un cran plus haut)",
  by_category: {
    "2015": "Réduction des espaces : se resserrer autour du ballon, presser au signal, relancer en 1 touche (semaine 2)",
    "2016": "Cadrage-couverture en infériorité : 1c2, 2c3, ralentir et fermer la passe (semaine 2)",
    "2014-2013": "Réduction des espaces : se resserrer autour du ballon (semaine 2)"
  }
};

const POOL = [
  { text: "Jeu entre les lignes", block: "Jeu entre les lignes" },
  { text: "Jeu en déviation", block: "Déséquilibre / finition" },
  { text: "Aide au porteur : se rendre disponible près de la porteuse", block: "Déséquilibre / finition" },
  { text: "Jeu dans les intervalles (2014-2015) · Jeu vers l'avant (2016-2017)", block: "Déséquilibre / finition" },
  { text: "Transition offensive : dès qu'on récupère le ballon", block: "Déséquilibre / finition" },
  { text: "Largeur : occuper les 2 côtés", block: "Conservation / progression" },
  { text: "Cadrage et couverture : la 1re défenseuse va sur la porteuse", block: "Récupération du ballon" },
  { text: "Réduction des espaces : rester groupées", block: "Récupération du ballon" },
  { text: "2e évaluation sur le jeu (mêmes tests)", block: "Conservation / progression" }
];

describe("thème du groupe", () => {
  it("prend la catégorie exacte, puis une de ses années, sinon le thème de tous", () => {
    expect(themeForGroup(WEEK, "2016")).toMatch(/^Cadrage-couverture/);
    expect(themeForGroup(WEEK, "2016-2017")).toMatch(/^Cadrage-couverture/);
    expect(themeForGroup(WEEK, "2014-2015")).toMatch(/^Réduction des espaces/);
    expect(themeForGroup(WEEK, "2012")).toMatch(/^Récupération du ballon/);
    expect(themeForGroup(null, "2016")).toBeNull();
  });
  it("garde la partie du groupe d'un thème « A (2014-2015) · B (2016-2017) »", () => {
    const t = { theme: "Jeu dans les intervalles (2014-2015) · Jeu vers l'avant (2016-2017)", by_category: {} };
    expect(themeForGroup(t, "2016-2017")).toBe("Jeu vers l'avant (2016-2017)");
    expect(shortTheme(themeForGroup(t, "2014-2015 avancé"))).toBe("Jeu dans les intervalles");
  });
  it("met le thème en mots courts", () => {
    expect(shortTheme("Réduction des espaces : se resserrer autour du ballon")).toBe("Réduction des espaces");
    expect(shortTheme("Transition défensive (changement de statut)")).toBe("Transition défensive");
    expect(shortTheme("Aide au porteur")).toBe("Aide au porteur");
    expect(shortTheme(null)).toBe("");
  });
});

describe("les 3 choix", () => {
  const quiz = (seed: string, cat = "2016-2017") => buildThemeQuiz({ correct: themeForGroup(WEEK, cat), block: "Récupération du ballon", pool: POOL, seed });

  it("3 choix différents, un seul bon, jamais du même bloc ni proches du bon", () => {
    for (const seed of ["a", "b", "c", "5519c293-1681-4007-84a3-9742e0f848b3", "e8af7f3e-152c-43b5-a549-da79233ceb54"]) {
      for (const cat of ["2016-2017", "2014-2015"]) {
        const q = quiz(seed, cat)!;
        expect(q.choices).toHaveLength(3);
        expect(new Set(q.choices.map(normTheme)).size).toBe(3);
        expect(q.choices.filter((c) => isThemeCorrect(c, q.correct))).toHaveLength(1);
        const wrong = q.choices.filter((c) => c !== q.correct);
        for (const w of wrong) {
          expect(w).not.toMatch(/Cadrage|Réduction|évaluation/i);
          expect(themeFamilies(w).filter((f) => themeFamilies(q.correct).includes(f))).toEqual([]);
        }
      }
    }
  });
  it("stables pour une même pratique (mêmes choix, même ordre), mélangés d'une pratique à l'autre", () => {
    expect(quiz("pratique-1")).toEqual(quiz("pratique-1"));
    const positions = new Set(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((s) => quiz(s)!.choices.indexOf(quiz(s)!.correct)));
    expect(positions.size).toBeGreaterThan(1);
  });
  it("sans thème ou en semaine d'évaluation : pas de question", () => {
    expect(buildThemeQuiz({ correct: null, pool: POOL, seed: "x" })).toBeNull();
    expect(buildThemeQuiz({ correct: "Évaluation sur le jeu (semaine d'évaluation, tests)", pool: POOL, seed: "x" })).toBeNull();
  });
  it("sans autre thème dans le plan : des thèmes de soccer simples", () => {
    const q = buildThemeQuiz({ correct: "Aide au porteur", pool: [], seed: "x" })!;
    expect(q.choices).toHaveLength(3);
    expect(q.choices).toContain("Aide au porteur");
  });
  it("n'accepte qu'un des choix proposés", () => {
    const q = quiz("z")!;
    expect(parseThemeAnswer(q.choices[1], q)).toBe(q.choices[1]);
    expect(parseThemeAnswer(normTheme(q.correct).toUpperCase(), q)).toBe(q.correct);
    expect(parseThemeAnswer("Autre chose", q)).toBeNull();
    expect(parseThemeAnswer(q.correct, null)).toBeNull();
  });
});

describe("résultats", () => {
  it("compris, pas compris, pas répondu", () => {
    expect(themeStatusOf({ theme_correct: true })).toBe("compris");
    expect(themeStatusOf({ theme_correct: false })).toBe("pas-compris");
    expect(themeStatusOf({ theme_correct: null })).toBe("pas-repondu");
    expect(themeStatusOf(undefined)).toBe("pas-repondu");
  });
  it("part par pratique et par semaine", () => {
    const rows = [
      { date: "2026-11-25", activity_id: "a", theme_correct: true },
      { date: "2026-11-25", activity_id: "a", theme_correct: false },
      { date: "2026-11-25", activity_id: "a", theme_correct: null },
      { date: "2026-11-23", activity_id: "b", theme_correct: true },
      { date: "2026-11-18", activity_id: "c", theme_correct: null }
    ];
    expect(themeRateByPractice(rows)).toEqual([
      { activityId: "a", date: "2026-11-25", answered: 2, understood: 1, pct: 50 },
      { activityId: "b", date: "2026-11-23", answered: 1, understood: 1, pct: 100 }
    ]);
    expect(themeRateByWeek(rows)).toEqual([{ week: "2026-11-23", answered: 3, understood: 2, pct: 67 }]);
  });
});

describe("themeVerdict (80 %)", () => {
  it("échec sous 80 %, compris à 80 % et plus, rien sans réponse", async () => {
    const { themeVerdict } = await import("@/lib/theme-quiz-core");
    expect(themeVerdict(79)).toBe("echec");
    expect(themeVerdict(80)).toBe("compris");
    expect(themeVerdict(null)).toBeNull();
  });
});
