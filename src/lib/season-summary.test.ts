import { describe, expect, it } from "vitest";

import { firstSentence, startNow, summarizeSeason, trendOf, type SummaryEval } from "@/lib/season-summary";

const ev = (date: string, bm: number, pr: number, at: number, extra: Partial<SummaryEval> = {}): SummaryEval => ({
  date,
  coachId: "c1",
  ratings: { "Ball mastery": bm, Prestation: pr, Attitude: at },
  ...extra
});

const base = { attendance: [], objectives: [], from: "2026-09-01", to: "2027-04-18" };

describe("startNow", () => {
  it("compare les premières et les dernières pratiques, sans chevauchement", () => {
    expect(startNow([])).toEqual({ start: null, now: null, delta: null });
    expect(startNow([3])).toEqual({ start: 3, now: 3, delta: null });
    expect(startNow([2, 4])).toEqual({ start: 2, now: 4, delta: 2 });
    expect(startNow([2, 2, 3, 3, 4, 4, 4, 5])).toEqual({ start: 2.3, now: 4.3, delta: 2 });
  });
  it("tendance avec un seuil", () => {
    expect(trendOf(0.3, 0.3)).toBe("hausse");
    expect(trendOf(0.2, 0.3)).toBe("stable");
    expect(trendOf(-0.5, 0.3)).toBe("baisse");
    expect(trendOf(null, 0.3)).toBeNull();
  });
});

describe("summarizeSeason", () => {
  it("progression de chaque échelle, la joueuse comparée à elle-même", () => {
    const s = summarizeSeason({ ...base, evaluations: [ev("2026-09-10", 2, 3, 4), ev("2026-09-17", 3, 3, 4), ev("2026-10-01", 4, 3, 4), ev("2026-10-08", 4, 3, 3)] });
    const bm = s.scales.find((x) => x.key === "Ball mastery")!;
    expect(bm).toMatchObject({ start: 2.5, now: 4, delta: 1.5, trend: "hausse", count: 4 });
    expect(s.scales.find((x) => x.key === "Prestation")!.trend).toBe("stable");
    expect(s.scales.find((x) => x.key === "Attitude")!.trend).toBe("baisse");
    expect(s.headline).toBe("Ball mastery : de 2,5 à 4,0 sur 5 depuis le début de la saison.");
    expect(s.practicesEvaluated).toBe(4);
  });

  it("deux éducateurs à la même pratique comptent pour une pratique", () => {
    const s = summarizeSeason({ ...base, evaluations: [ev("2026-09-10", 2, 3, 3), { ...ev("2026-09-10", 4, 3, 3), coachId: "c2" }, ev("2026-09-17", 4, 3, 3)] });
    expect(s.scales[0]).toMatchObject({ count: 2, start: 3, now: 4 });
    expect(s.practicesEvaluated).toBe(2);
  });

  it("ignore ce qui est hors période ou hors échelle", () => {
    const s = summarizeSeason({ ...base, evaluations: [ev("2026-08-20", 1, 1, 1), ev("2026-09-10", 9 as number, 3, 3)] });
    expect(s.scales[0].count).toBe(0);
    expect(s.scales[1].count).toBe(1);
  });

  it("gestes forts, à travailler et plus grand progrès", () => {
    const evaluations = [
      ev("2026-09-10", 3, 3, 3, { gestureScores: { "Sole Rolls": 3, "Toe Taps": 8, "Inside Outside": 5 } }),
      ev("2026-09-17", 3, 3, 3, { gestureScores: { "Sole Rolls": 6, "Toe Taps": 9 }, gestures: ["Inside Outside"] }),
      ev("2026-09-24", 3, 3, 3, { gestureScores: { "Sole Rolls": 7, "Toe Taps": 9 }, gestures: ["Inside Outside", "Croqueta"] })
    ];
    const s = summarizeSeason({ ...base, evaluations });
    expect(s.gestures.strong.map((g) => g.name)).toEqual(["Toe Taps", "Sole Rolls"]);
    expect(s.gestures.toWork.map((g) => g.name)).toEqual(["Inside Outside", "Croqueta"]);
    expect(s.gestures.improved).toMatchObject({ name: "Sole Rolls", first: 3, recent: 7, delta: 4 });
  });

  it("assiduité : taux, 6 dernières, série en cours", () => {
    const statuses = ["present", "absent", "absent", "present", "late", "present", "present", "present", "injured", "present"];
    const attendance = statuses.map((status, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, status }));
    const s = summarizeSeason({ ...base, evaluations: [], attendance: [...attendance, { date: "2026-10-20", status: "unknown" }] });
    expect(s.attendance).toMatchObject({ present: 7, total: 10, rate: 70, recentRate: 83, streak: 1, label: "Présence irrégulière" });
  });

  it("3 phrases tirées des observations, réparties dans la période, jamais pour les parents", () => {
    const evaluations = ["Bonne énergie aujourd'hui. Elle parle beaucoup.", "ok", "Le pied gauche reste à travailler, surtout en passe.", "Le pied gauche reste à travailler, surtout en passe.", "Capitaine des Violettes : elle a encouragé toute l'équipe.", "Très concentrée sur le ball mastery du début à la fin."].map((c, i) =>
      ev(`2026-10-${String(i + 1).padStart(2, "0")}`, 3, 3, 3, { comment: c })
    );
    const s = summarizeSeason({ ...base, evaluations });
    expect(s.observations.map((o) => o.text)).toEqual(["Bonne énergie aujourd'hui.", "Le pied gauche reste à travailler, surtout en passe.", "Très concentrée sur le ball mastery du début à la fin."]);
    expect(summarizeSeason({ ...base, evaluations, observations: false }).observations).toEqual([]);
  });

  it("objectifs actifs et fermés ; résumé vide sans données", () => {
    const s = summarizeSeason({ ...base, evaluations: [], objectives: [{ text: "Pied gauche", active: true }, { text: "Ancien", active: false }] });
    expect(s.objectives).toEqual({ active: ["Pied gauche"], closed: 1 });
    expect(s.headline).toBeNull();
    expect(s.attendance.rate).toBeNull();
  });
});

describe("firstSentence", () => {
  it("garde la première phrase si elle dit quelque chose, coupe proprement", () => {
    expect(firstSentence("Très belle pratique, beaucoup d'efforts. Le reste suit.")).toBe("Très belle pratique, beaucoup d'efforts.");
    expect(firstSentence("Bien. Elle a progressé en conduite de balle.")).toBe("Bien. Elle a progressé en conduite de balle.");
    expect(firstSentence("a".repeat(300)).length).toBe(220);
  });
});
