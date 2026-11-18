import { describe, expect, it } from "vitest";

import { currentPeriod, levelOf, periodRange, summarize } from "@/lib/bulletin-report";

const ev = (date: string, b: number, p: number, a: number, coachId = "c1") => ({ date, coachId, ratings: { "Ball mastery": b, Prestation: p, Attitude: a } });

describe("bulletin de progression", () => {
  it("deux bulletins par saison : mi-saison au 15 décembre, fin de saison au 18 avril", () => {
    expect(periodRange("automne-hiver-2026", "mi-saison", "2026-11-17")).toMatchObject({ from: "2026-09-01", to: "2026-12-15", provisional: true });
    expect(periodRange("automne-hiver-2026", "fin-saison", "2027-05-01")).toMatchObject({ to: "2027-04-18", provisional: false });
    expect(currentPeriod("automne-hiver-2026", "2026-12-15")).toBe("mi-saison");
    expect(currentPeriod("automne-hiver-2026", "2027-01-10")).toBe("fin-saison");
  });

  it("évaluation globale, présences et critères de la période", () => {
    const s = summarize({
      evaluations: [ev("2026-10-01", 3, 3, 4), ev("2026-11-16", 4, 4, 5, "c2"), ev("2027-01-20", 5, 5, 5)],
      attendance: [
        { date: "2026-10-01", status: "present", practice_rating: 8, fatigue: 5 },
        { date: "2026-11-09", status: "absent" },
        { date: "2026-11-16", status: "present", practice_rating: 10, fatigue: 6, learning: 8 }
      ],
      captaincies: [{ date: "2026-11-16", leadership: 4 }],
      from: "2026-09-01",
      to: "2026-12-15"
    });
    expect(s.criteria.map((c) => c.value)).toEqual([3.5, 3.5, 4.5]);
    expect(s.global).toBe(3.8);
    expect(s.attendance).toEqual({ present: 2, total: 3, rate: 67 });
    expect(s.wellbeing.find((w) => w.key === "practice_rating")?.value).toBe(9);
    expect(s.leadership).toEqual({ times: 1, value: 4 });
    expect(s.coaches).toBe(2);
  });

  it("fin de saison : la valeur de la mi-saison pour montrer la progression", () => {
    const s = summarize({ evaluations: [ev("2026-10-01", 3, 3, 3), ev("2027-02-01", 5, 5, 5)], attendance: [], captaincies: [], from: "2026-09-01", to: "2027-04-18", mid: "2026-12-15" });
    expect(s.criteria[0]).toMatchObject({ value: 4, before: 3 });
  });

  it("niveau et couleur d'une note", () => {
    expect(levelOf(3.8)?.label).toBe("Bien");
    expect(levelOf(1.2)?.label).toBe("À travailler");
    expect(levelOf(null)).toBeNull();
  });
});

describe("bulletin remis et mot pour la famille", () => {
  it("la famille voit le bulletin flou avant sa date, l'équipe le voit toujours", async () => {
    const { isReleased, periodRange } = await import("@/lib/bulletin-report");
    const r = periodRange("automne-hiver-2026", "mi-saison", "2026-11-17");
    expect(isReleased(r, "parent")).toBe(false);
    expect(isReleased(r, "equipe")).toBe(true);
    expect(isReleased(periodRange("automne-hiver-2026", "mi-saison", "2026-12-15"), "parent")).toBe(true);
  });
  it("le mot pour la famille a une longueur utile", async () => {
    const { checkFamilyComment } = await import("@/lib/bulletin-report");
    expect(checkFamilyComment("Bravo !", "Léa")).toMatch(/au moins 40/);
    expect(checkFamilyComment("Léa garde la tête levée avec le ballon ; on travaille maintenant son pied gauche en conduite.", "Léa")).toBeNull();
  });
});
