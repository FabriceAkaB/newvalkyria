import { describe, expect, it } from "vitest";

import { attributeScores } from "@/lib/coach-satisfaction-core";

describe("satisfaction des parents envers chaque éducatrice", () => {
  const sessions = [
    { coachId: "a", category: "2016-2017", date: "2026-11-02" },
    { coachId: "a", category: "2016-2017", date: "2026-11-09" },
    { coachId: "b", category: "2016-2017", date: "2026-11-09" },
    { coachId: "c", category: "2014-2015", date: "2026-11-02" },
    { coachId: "c", category: "2014-2015", date: "2026-11-09" }
  ];
  it("va aux éducatrices qui ont coaché sa fille au moins 2 fois dans les 45 jours", () => {
    const m = attributeScores([{ respondedAt: "2026-11-15T10:00:00Z", categories: ["2016-2017"], score: 9, comment: "Très à l'écoute" }], sessions);
    expect([...m.keys()]).toEqual(["a"]);
    expect(m.get("a")).toEqual({ coachId: "a", count: 1, average: 9, comments: ["Très à l'écoute"] });
  });
  it("fait la moyenne et ignore les pratiques trop anciennes ou après la réponse", () => {
    const m = attributeScores(
      [
        { respondedAt: "2026-11-15", categories: ["2016-2017"], score: 9, comment: null },
        { respondedAt: "2026-11-16", categories: ["2016-2017"], score: 6, comment: "  " },
        { respondedAt: "2027-02-01", categories: ["2016-2017"], score: 1, comment: null }
      ],
      sessions
    );
    expect(m.get("a")).toEqual({ coachId: "a", count: 2, average: 7.5, comments: [] });
  });
});
