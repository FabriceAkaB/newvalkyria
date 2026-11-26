import { describe, expect, it } from "vitest";

import { draftFromSlideText, guessCategory, guessType, sanitizeDraft, titleFromFileName } from "@/lib/exercise-slide-core";

describe("Diapo : nom du fichier", () => {
  it("garde un nom parlant, ignore les noms génériques", () => {
    expect(titleFromFileName("Rondo 4c2 pressing.png")).toBe("Rondo 4c2 pressing");
    expect(titleFromFileName("3c2_remise_dans_le_dos - page 2.png")).toBe("3c2 remise dans le dos");
    expect(titleFromFileName("Diapositive3.PNG")).toBeNull();
    expect(titleFromFileName("IMG_1234.jpg")).toBeNull();
    expect(titleFromFileName("Capture d'écran.png")).toBe("Capture d'écran");
  });
});

describe("Diapo : thème et type", () => {
  it("devine le thème d'après les mots", () => {
    expect(guessCategory("Finition : frappe devant le but")).toBe("Finition");
    expect(guessCategory("Rondo 5c3, presser au signal, récupérer le ballon")).toBe("Défense");
    expect(guessCategory("Conduite et dribble autour des cônes")).toBe("Conduite");
    expect(guessCategory("Rondo 5c3 pressez au signal")).toBe("Défense");
    expect(guessCategory("Bonjour")).toBe("Autre");
  });
  it("devine le type", () => {
    expect(guessType("Ball mastery : semelle")).toBe("ball-mastery");
    expect(guessType("Rondo 4c2")).toBe("jeu-reduit");
    expect(guessType("Match 7c7 à thème")).toBe("forme-jouee");
    expect(guessType("Bonjour")).toBeNull();
  });
});

describe("Diapo : lecture du texte", () => {
  const text = `Passe et va
Organisation : carré de 15 × 15 m
Matériel
Coupelles, ballons
Consignes :
- Passe au pied d'appui
- Regarde avant de recevoir
Variantes
Plus facile : 2 touches
Plus difficile : 1 touche
Durée 12 min, 8 à 12 joueuses, U10 et U11`;

  it("range les rubriques reconnues", () => {
    const d = draftFromSlideText(text, "Diapositive1.png");
    expect(d.title).toBe("Passe et va");
    expect(d.category).toBe("Passe");
    expect(d.dimensions).toBe("carré de 15 × 15 m");
    expect(d.material).toBe("Coupelles, ballons");
    expect(d.coachingPoints).toBe("Passe au pied d'appui\nRegarde avant de recevoir");
    expect(d.variantEasier).toBe("2 touches");
    expect(d.variantHarder).toBe("1 touche");
    expect(d.durationMinutes).toBe(12);
    expect([d.minPlayers, d.maxPlayers]).toEqual([8, 12]);
    expect(d.ageGroups).toEqual(["U10", "U11"]);
  });

  it("sans texte : le nom du fichier, sinon un titre par défaut", () => {
    expect(draftFromSlideText("", "Finition 2c1.png").title).toBe("Finition 2c1");
    expect(draftFromSlideText("", "Finition 2c1.png").category).toBe("Finition");
    expect(draftFromSlideText("", "IMG_0001.jpg").title).toBe("Nouvel exercice (diapo)");
  });
});

describe("Diapo : réponse de Claude nettoyée", () => {
  const fallback = draftFromSlideText("", "Rondo.png");
  it("ramène thème, type, niveau et âges aux listes de la banque", () => {
    const d = sanitizeDraft({ title: " 4c2 ", category: "defense", exerciseType: "Jeu réduit à thème", level: "avancé", ageGroups: ["u12", "U99"], minPlayers: 12, maxPlayers: 6, durationMinutes: 400, instructions: "x" }, fallback);
    expect(d.title).toBe("4c2");
    expect(d.category).toBe("Défense");
    expect(d.exerciseType).toBe("jeu-reduit");
    expect(d.sessionPlace).toBe("forme-jouee");
    expect(d.level).toBe("Avancé");
    expect(d.ageGroups).toEqual(["U12"]);
    expect([d.minPlayers, d.maxPlayers]).toEqual([6, 12]);
    expect(d.durationMinutes).toBeNull();
  });
  it("une réponse vide redonne la lecture sans IA", () => {
    expect(sanitizeDraft(null, fallback)).toBe(fallback);
  });
});
