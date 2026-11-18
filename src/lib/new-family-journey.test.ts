import { describe, expect, it } from "vitest";

import { isoWeek } from "@/lib/new-family-journey";

describe("30 premiers jours : semaine des mini-sondages", () => {
  it("donne la semaine ISO", () => {
    expect(isoWeek("2026-11-17")).toBe("2026-S47");
    expect(isoWeek("2027-01-01")).toBe("2026-S53");
    expect(isoWeek("2027-01-04")).toBe("2027-S01");
  });
});
