import { describe, expect, it } from "vitest";

import { bulletinChecklist, bulletinProgress, dossierAlerts, listBadges, overallTrend, searchKey, surveyStats, type SurveyRow } from "@/lib/player-dossier";

const row = (p: Partial<SurveyRow>): SurveyRow => ({
  date: "2026-11-10",
  group: "Filles 2016",
  status: "present",
  practiceRating: null,
  fatigue: null,
  coachHelped: null,
  coachHelpers: [],
  peerHelped: null,
  peerHelpers: [],
  themeAnswer: null,
  themeExpected: null,
  themeCorrect: null,
  ...p
});

describe("listBadges", () => {
  it("blessure en premier, présence et évaluation colorées", () => {
    const b = listBadges({ lastEvaluation: "2026-11-20", recent: { present: 3, total: 4 }, openIncident: true }, "2026-11-26");
    expect(b.map((x) => x.key)).toEqual(["blessure", "presence", "evaluation"]);
    expect(b[1]).toMatchObject({ label: "3/4 présente", tone: "good" });
    expect(b[2]).toMatchObject({ label: "Évaluée il y a 6 j", tone: "good" });
  });
  it("jamais évaluée, pas de présence récente", () => {
    const b = listBadges({ lastEvaluation: null, recent: { present: 0, total: 0 }, openIncident: false }, "2026-11-26");
    expect(b).toEqual([{ key: "evaluation", label: "Jamais évaluée", tone: "muted" }]);
  });
  it("présence faible et vieille évaluation", () => {
    const b = listBadges({ lastEvaluation: "2026-10-01", recent: { present: 1, total: 4 }, openIncident: false }, "2026-11-26");
    expect(b.map((x) => x.tone)).toEqual(["bad", "bad"]);
  });
});

describe("searchKey", () => {
  it("ignore accents, majuscules et espaces", () => expect(searchKey("  Mélia  Côté ")).toBe("melia cote"));
});

describe("surveyStats", () => {
  it("moyennes, parts et noms les plus souvent cités", () => {
    const s = surveyStats([
      row({ date: "2026-11-03", practiceRating: 8, fatigue: 4, coachHelped: true, coachHelpers: ["Maéva"], peerHelped: true, peerHelpers: ["Lia B."], themeAnswer: "a", themeCorrect: true }),
      row({ date: "2026-11-10", practiceRating: 6, fatigue: 6, coachHelped: false, peerHelped: true, peerHelpers: ["Lia B.", "Emma C."], themeAnswer: "b", themeCorrect: false }),
      row({ date: "2026-11-17" })
    ]);
    expect(s.answers).toBe(2);
    expect(s.pleasure).toBe(7);
    expect(s.fatigue).toBe(5);
    expect(s.coachHelpedRate).toBe(50);
    expect(s.peerHelpedRate).toBe(100);
    expect(s.theme).toEqual({ asked: 2, correct: 1, rate: 50 });
    expect(s.topPeers[0]).toEqual({ name: "Lia B.", times: 2 });
    expect(s.series.map((x) => x.date)).toEqual(["2026-11-03", "2026-11-10"]);
  });
});

describe("overallTrend", () => {
  it("au moins 4 pratiques", () => {
    expect(overallTrend([{ date: "a", overall: 3 }])).toBeNull();
    const t = overallTrend([
      { date: "2026-10-01", overall: 3 },
      { date: "2026-10-08", overall: 3 },
      { date: "2026-10-15", overall: 3 },
      { date: "2026-10-22", overall: 4 },
      { date: "2026-10-29", overall: 4 },
      { date: "2026-11-05", overall: 4 }
    ]);
    expect(t).toEqual({ start: 3, recent: 4, dir: "hausse" });
  });
});

describe("dossierAlerts", () => {
  it("blessure ouverte, santé, absences de suite", () => {
    const a = dossierAlerts({
      today: "2026-11-26",
      incidents: [{ status: "ouverte", kind: "choc-tete", date: "2026-11-24" }, { status: "fermee", kind: "blessure", date: "2026-10-01" }],
      attendance: [
        { date: "2026-11-10", status: "present", activityType: "Pratique" },
        { date: "2026-11-17", status: "absent", activityType: "Pratique" },
        { date: "2026-11-24", status: "absent", activityType: "Pratique" }
      ],
      evaluations: [],
      feedback: [],
      lastEvaluation: null,
      health: "Asthme, pompe dans le sac"
    });
    expect(a[0]).toMatchObject({ tone: "bad" });
    expect(a[0].text).toContain("Choc à la tête");
    expect(a.some((x) => x.text.includes("Asthme"))).toBe(true);
    expect(a.some((x) => x.text.startsWith("2 pratiques manquées"))).toBe(true);
    expect(a.at(-1)?.text).toContain("Pas encore évaluée");
  });
});

describe("bulletinChecklist", () => {
  it("dit ce qui manque, le capitanat ne compte pas", () => {
    const c = bulletinChecklist({
      criteria: [
        { label: "Ball mastery", count: 3 },
        { label: "Prestation", count: 1 },
        { label: "Attitude", count: 0 }
      ],
      wellbeingAnswers: 4,
      attendanceTotal: 6,
      practicesEvaluated: 3,
      coaches: 1,
      objectives: 0,
      familyComments: 0,
      captainTimes: 0,
      checkpointVideo: false,
      firstName: "Lexie",
      daysLeft: 19
    });
    expect(c.find((x) => x.label === "Prestation")).toMatchObject({ done: false, detail: "1 note sur 3 souhaitées" });
    expect(c.find((x) => x.label === "Le mot pour la famille")?.detail).toContain("dans 19 jours");
    expect(bulletinProgress(c)).toEqual({ done: 3, total: 9 });
  });
});
