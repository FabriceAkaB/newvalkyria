import { describe, expect, it } from "vitest";

import { exerciseCard } from "@/lib/exercise-bank";

describe("fiche en diapo", () => {
  it("lit les sections Règles / Points des pratiques importées", () => {
    const c = exerciseCard({
      instructions: "Règles :\n• 4 à l'extérieur, 1 chasseuse, 2 touches.\n• Chaque minute, la suivante entre.\n\nPoints :\n• Au sifflet, chaque joueuse à l'extérieur = 1 point.\n\nTemps : 10 × 1 min",
      coaching_points: "Je regarde avant de recevoir.\nÀ répéter : Tête levée ; Passe au sol\nQuestions : « Où était l'espace ? » « Qui était libre ? »",
      objective: "À répéter : Tête levée ; Passe au sol",
      dimensions: "Carrés de 8 × 8 m. 1 mini-but à 5 m.",
      min_players: 5,
      max_players: 16,
      duration_minutes: 11,
      level: "Avancé",
      category: "Passe",
      exercise_type: "jeu-reduit"
    });
    expect(c.rules).toEqual(["4 à l'extérieur, 1 chasseuse, 2 touches.", "Chaque minute, la suivante entre."]);
    expect(c.goals).toEqual(["Au sifflet, chaque joueuse à l'extérieur = 1 point."]);
    expect(c.behaviours).toEqual(["Je regarde avant de recevoir", "Tête levée", "Passe au sol"]);
    expect(c.objectives).toEqual([]);
    expect(c.animation).toEqual([
      { label: "Temps", items: ["10 × 1 min"] },
      { label: "Questions", items: ["« Où était l'espace ? »", "« Qui était libre ? »"] }
    ]);
    expect(c.chips).toEqual(["Carrés de 8 × 8 m", "5 à 16 joueuses", "11 min"]);
    expect(c.difficulty).toBe(3);
  });

  it("texte libre : phrases en règles, ligne Points en but du jeu, gestes numérotés", () => {
    const c = exerciseCard({
      instructions: "2 chasseuses au milieu. 2 touches maximum.\nPoints : au sifflet = 1 point ; récupérer et marquer = 2 points.",
      coaching_points: "Cadreuse : coupe un côté.",
      objective: "Fermer la passe entre les deux"
    });
    expect(c.rules).toEqual(["2 chasseuses au milieu", "2 touches maximum"]);
    expect(c.goals).toEqual(["au sifflet = 1 point", "récupérer et marquer = 2 points"]);
    expect(c.objectives).toEqual(["Fermer la passe entre les deux"]);
    const bm = exerciseCard({ instructions: "1. Sole Rolls : semelle.\n2. Nutmegs : on pousse." });
    expect(bm.numbered).toBe(true);
    expect(bm.rules).toEqual(["Sole Rolls : semelle.", "Nutmegs : on pousse."]);
  });
});
