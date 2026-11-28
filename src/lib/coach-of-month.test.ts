import { describe, expect, it } from "vitest";

import { coachOfMonthHistory } from "@/lib/coach-of-month";
import type { HelperRank } from "@/lib/practice-survey-results-core";

const r = (coachId: string, helped: number, asked = 10): HelperRank => ({ coachId, name: coachId, helped, asked, pct: Math.round((helped / asked) * 100), rank: 1, tied: false, practices: 1 });

describe("entraîneur du mois", () => {
  it("additionne les pratiques du mois et donne le gagnant, le plus récent d'abord", () => {
    const h = coachOfMonthHistory(
      [
        { date: "2026-11-20", ranking: [r("maeva", 6), r("william", 4)] },
        { date: "2026-11-25", ranking: [r("maeva", 2), r("william", 7)] },
        { date: "2026-12-02", ranking: [r("maeva", 5), r("william", 1)] }
      ],
      "2026-12-03"
    );
    expect(h.map((m) => [m.month, m.inProgress, m.winners.map((w) => w.coachId)])).toEqual([
      ["2026-12", true, ["maeva"]],
      ["2026-11", false, ["william"]]
    ]);
    expect(h[1].ranking[0]).toMatchObject({ coachId: "william", helped: 11, practices: 2 });
    expect(h[1].label).toBe("novembre 2026");
  });

  it("égalité = co-entraîneurs ; un mois sans réponse ne compte pas", () => {
    const h = coachOfMonthHistory([{ date: "2027-01-10", ranking: [r("a", 3), r("b", 3)] }, { date: "2027-02-01", ranking: [r("a", 0, 0)] }], "2027-03-01");
    expect(h).toHaveLength(1);
    expect(h[0].winners.map((w) => w.coachId).sort()).toEqual(["a", "b"]);
  });
});
