import { describe, expect, it } from "vitest";

import { formatPlanSchedule, parsePlanSchedule } from "@/lib/payment-plan";

describe("calendrier de versements sur mesure", () => {
  it("lit et réécrit le calendrier", () => {
    const raw = "11000@2026-11-05,11000@2026-12-01,11000@2027-01-01,10798@2027-02-01";
    const s = parsePlanSchedule(raw)!;
    expect(s.reduce((t, i) => t + i.amountCents, 0)).toBe(43798);
    expect(formatPlanSchedule(s)).toBe(raw);
  });

  it("refuse un calendrier invalide", () => {
    expect(parsePlanSchedule("11000@2026-11-05")).toBeNull();
    expect(parsePlanSchedule("11000@2026-12-01,11000@2026-11-05")).toBeNull();
    expect(parsePlanSchedule("0@2026-11-05,100@2026-12-01")).toBeNull();
    expect(parsePlanSchedule("abc")).toBeNull();
    expect(parsePlanSchedule(null)).toBeNull();
  });
});
