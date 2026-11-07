import { describe, expect, it } from "vitest";

import { categorize, dayMet, habitWeek, mondayOf, nutritionDay, parseTags, weekScore, weekTime, type Habit } from "@/lib/jp-core";

const sommeil: Habit = { id: "s", name: "Sommeil", kind: "nombre", unit: "heures", target: 7.5, active: true, sort_order: 1 };
const gym: Habit = { id: "g", name: "Entraînement", kind: "check", unit: null, target: 4, active: true, sort_order: 2 };

describe("espace JP", () => {
  it("habitudes : jour réussi, semaine, série et moyenne", () => {
    expect(mondayOf("2026-11-06")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(dayMet(sommeil, 7)).toBe(false);
    expect(dayMet(sommeil, 8)).toBe(true);
    expect(dayMet(gym, 1)).toBe(true);
    expect(dayMet(gym, null)).toBe(false);
    const logs = [
      { habit_id: "s", day: "2026-11-02", value: 6 },
      { habit_id: "s", day: "2026-11-03", value: 8 },
      { habit_id: "s", day: "2026-11-04", value: 7.5 },
      { habit_id: "s", day: "2026-11-05", value: 8 },
      { habit_id: "g", day: "2026-11-03", value: 1 },
      { habit_id: "g", day: "2026-11-05", value: 1 }
    ];
    const w = habitWeek(sommeil, logs, "2026-11-06");
    expect(w.met).toBe(3);
    expect(w.goal).toBe(7);
    expect(w.streak).toBe(3); // aujourd'hui pas encore noté : la série tient
    expect(w.average).toBe(7.4);
    const g = habitWeek(gym, logs, "2026-11-06");
    expect(g.met).toBe(2);
    expect(g.goal).toBe(4);
    expect(g.streak).toBe(1);
    expect(weekScore([w, g])).toBeCloseTo((3 / 7 + 2 / 4) / 2);
  });

  it("calendrier : chaque activité dans sa catégorie, heures de la semaine", () => {
    expect(categorize("🎥⚽️ création de contenue (synthetique Blainville )")).toBe("contenu");
    expect(categorize("🎬🎞️Montage plus planification")).toBe("contenu");
    expect(categorize("coaching école st gabriel futsal cadet.")).toBe("terrain");
    expect(categorize("Appel découverte — GrowthLab")).toBe("ventes");
    expect(categorize("Rseq formation  coaching 3R lecture")).toBe("formation");
    expect(categorize("Souper famille")).toBe("perso");
    expect(categorize("Truc")).toBe("autre");
    const h = 3_600_000;
    const t0 = Date.parse("2026-11-02T10:00:00Z");
    const w = weekTime(
      [
        { summary: "Pratique Lundi", date: "2026-11-02", start: "18:00", end: "19:30", startMs: t0, endMs: t0 + 1.5 * h, allDay: false },
        { summary: "Montage", date: "2026-11-03", start: "07:30", end: "09:30", startMs: t0, endMs: t0 + 2 * h, allDay: false },
        { summary: "Férié", date: "2026-11-04", start: null, end: null, startMs: t0, endMs: t0 + 24 * h, allDay: true },
        { summary: "Pratique", date: "2026-11-09", start: "18:00", end: "19:00", startMs: t0, endMs: t0 + h, allDay: false }
      ],
      "2026-11-02"
    );
    expect(w.total).toBe(3.5);
    expect(w.byCategory).toEqual([
      { category: "contenu", hours: 2 },
      { category: "terrain", hours: 1.5 }
    ]);
    expect(w.byDay[0]).toEqual({ day: "2026-11-02", hours: 1.5 });
  });

  it("nutrition et étiquettes", () => {
    const d = nutritionDay(
      [
        { id: "1", day: "2026-11-06", moment: "dejeuner", description: "Œufs", protein_g: 25, quality: "bien" },
        { id: "2", day: "2026-11-06", moment: "collation", description: "Chips", protein_g: null, quality: "a-ameliorer" },
        { id: "3", day: "2026-11-05", moment: "souper", description: "Poulet", protein_g: 40, quality: "bien" }
      ],
      "2026-11-06"
    );
    expect(d.protein).toBe(25);
    expect(d.good).toBe(0.5);
    expect(d.mainMeals).toBe(1);
    expect(parseTags("Marketing, #ventes, marketing, x")).toEqual(["marketing", "ventes"]);
  });
});
