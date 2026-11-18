import { describe, expect, it } from "vitest";

import { lastMonths, monthlyAverages, trendOf } from "@/lib/program-satisfaction-core";

describe("satisfaction par programme", () => {
  it("donne les derniers mois, même en changeant d'année", () => {
    expect(lastMonths("2027-01-10", 4)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
  });
  it("fait la moyenne de chaque mois et ignore les notes hors échelle", () => {
    const s = monthlyAverages([{ date: "2026-10-03", value: 8 }, { date: "2026-10-10", value: 9 }, { date: "2026-11-02", value: 0 }], ["2026-10", "2026-11"]);
    expect(s).toEqual([{ month: "2026-10", value: 8.5, count: 2 }, { month: "2026-11", value: null, count: 0 }]);
  });
  it("dit la tendance entre les deux derniers mois notés", () => {
    expect(trendOf([{ value: 8 }, { value: null }, { value: 8.6 }])).toBe("hausse");
    expect(trendOf([{ value: 8.5 }, { value: 8.3 }])).toBe("stable");
    expect(trendOf([{ value: 9 }, { value: 7 }])).toBe("baisse");
    expect(trendOf([{ value: 9 }])).toBeNull();
  });
});
