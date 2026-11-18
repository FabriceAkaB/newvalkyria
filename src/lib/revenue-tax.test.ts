import { describe, expect, it } from "vitest";
import { taxRateOn } from "@/lib/revenue-calc";

describe("TPS/TVQ dans les revenus", () => {
  it("aucune taxe avant l'inscription, le taux ensuite", () => {
    expect(taxRateOn("2027-08-31", 0.14975, "2027-09-01")).toBe(0);
    expect(taxRateOn("2027-09-01", 0.14975, "2027-09-01")).toBe(0.14975);
  });
  it("sans date, le taux vaut pour tout ; sans taux, rien", () => {
    expect(taxRateOn("2026-01-01", 0.14975, null)).toBe(0.14975);
    expect(taxRateOn("2027-10-01", 0, "2027-09-01")).toBe(0);
  });
});
