import { describe, expect, it } from "vitest";
import { parseDeductions, summarizePay, type PayLine } from "@/lib/coach-pay";

const l = (state: PayLine["state"], hours: number, cents: number): PayLine => ({ activityId: "a", date: "2026-11-18", start: "18:00", end: "19:15", label: "x", hours, cents, state });

describe("ma paie", () => {
  it("compté, retenu et prévu à part ; net après retenues", () => {
    const s = summarizePay([l("compte", 1.25, 3750), l("compte", 2, 6000), l("retenu", 1.25, 3750), l("prevu", 1.5, 4500), l("absent", 0, 0)], [{ label: "Retenue", rate: 0.1 }]);
    expect(s.earnedCents).toBe(9750);
    expect(s.heldCents).toBe(3750);
    expect(s.plannedCents).toBe(4500);
    expect(s.hoursEarned).toBe(3.25);
    expect(s.deductions).toEqual([{ label: "Retenue", cents: 975 }]);
    expect(s.netCents).toBe(8775);
    expect(s.netIfAllCents).toBe(16200);
  });
  it("sans retenue, le net est le brut", () => {
    expect(summarizePay([l("compte", 1, 3000)], []).netCents).toBe(3000);
  });
  it("retenues mal écrites ignorées", () => {
    expect(parseDeductions([{ label: "A", rate: 0.05 }, { label: "B", rate: 5 }, { rate: 0.1 }])).toEqual([{ label: "A", rate: 0.05 }]);
    expect(parseDeductions("pas du json")).toEqual([]);
  });
});
