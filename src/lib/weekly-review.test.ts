import { describe, expect, it } from "vitest";

import { isComplete, mondayOf, parseReview, previousWeek, reviewWeekFor, weekLabel } from "@/lib/weekly-review";

describe("bilan de la semaine", () => {
  it("trouve le lundi de la semaine", () => {
    expect(mondayOf("2026-11-03")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
  });

  it("du lundi au jeudi : la semaine passée, en retard ; du vendredi au dimanche : la semaine qui finit", () => {
    expect(reviewWeekFor("2026-11-03")).toEqual({ weekStart: "2026-10-26", late: true });
    expect(reviewWeekFor("2026-11-06")).toEqual({ weekStart: "2026-11-02", late: false });
    expect(reviewWeekFor("2026-11-08")).toEqual({ weekStart: "2026-11-02", late: false });
    expect(reviewWeekFor("2026-11-09")).toEqual({ weekStart: "2026-11-02", late: true });
  });

  it("la priorité de cette semaine vient du bilan de la semaine passée", () => {
    expect(previousWeek("2026-11-04")).toBe("2026-10-26");
  });

  it("un bilan est complet avec les 3 réponses", () => {
    expect(isComplete({ wentWell: "Les essais", doDifferently: "Relancer plus tôt", nextPriority: "Remplir le mercredi" })).toBe(true);
    expect(isComplete({ wentWell: "Les essais", doDifferently: " ", nextPriority: "x" })).toBe(false);
  });

  it("écrit la semaine en clair", () => {
    expect(weekLabel("2026-11-02")).toBe("du 2 au 8 novembre");
    expect(weekLabel("2026-10-26")).toBe("du 26 octobre au 1er novembre");
  });

  it("refuse une semaine qui ne commence pas un lundi", () => {
    expect(parseReview({ weekStart: "2026-11-03" })).toBe("Semaine invalide.");
    expect(parseReview({ weekStart: "2026-11-02", wentWell: "  Bien  " })).toEqual({ weekStart: "2026-11-02", answers: { wentWell: "Bien", doDifferently: null, nextPriority: null } });
  });
});
