import { describe, expect, it } from "vitest";

import { nextPayPeriod, payPeriodOf, periodFor } from "@/lib/pay-periods";

describe("calendrier de paie", () => {
  it("paie du vendredi 13 novembre = du dimanche 25 octobre au samedi 7 novembre", () => {
    expect(periodFor("2026-11-13")).toEqual({ payDate: "2026-11-13", from: "2026-10-25", to: "2026-11-07" });
  });
  it("la prochaine paie, puis celle de deux semaines plus tard", () => {
    expect(nextPayPeriod("2026-11-05").payDate).toBe("2026-11-13");
    expect(nextPayPeriod("2026-11-13").payDate).toBe("2026-11-13");
    expect(nextPayPeriod("2026-11-14")).toEqual({ payDate: "2026-11-27", from: "2026-11-08", to: "2026-11-21" });
  });
  it("chaque jour d'activité tombe dans une seule paie", () => {
    expect(payPeriodOf("2026-11-07").payDate).toBe("2026-11-13");
    expect(payPeriodOf("2026-11-08").payDate).toBe("2026-11-27");
    expect(payPeriodOf("2026-10-25").payDate).toBe("2026-11-13");
  });
});
