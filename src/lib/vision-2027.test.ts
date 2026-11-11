import { describe, expect, it } from "vitest";

import { PLAN } from "@/lib/mandalart-plan";
import { buildVision, VISION_2027 } from "@/lib/vision-2027";

const codes = new Set(PLAN.pillars.flatMap((p) => p.objectives.flatMap((o) => o.tasks.map((t) => t.code))));

describe("À développer en 2027", () => {
  it("chaque chantier vise de vraies tâches du Mandalart", () => {
    expect(VISION_2027.flatMap((p) => p.codes).filter((c) => !codes.has(c))).toEqual([]);
  });
  it("compte les étapes faites et donne la prochaine par date", () => {
    const t = (code: string, status: string, due: string) => ({ code, title: code, owner: "JP", due, status, overdue: false }) as never;
    const [v] = buildVision([t("A", "fait", "2026-12-01"), t("B", "a_faire", "2027-02-01"), t("C", "a_faire", "2027-01-01"), t("D", "abandonne", "2026-12-15")], [
      { key: "x", emoji: "", title: "x", why: "", who: "jp", codes: ["A", "B", "C", "D"] }
    ]);
    expect([v.done, v.total, v.next?.code]).toEqual([1, 3, "C"]);
  });
});
