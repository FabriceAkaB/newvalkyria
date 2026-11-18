import { describe, expect, it } from "vitest";

import { isMethodOpen, methodWindow, opensOn } from "@/lib/coach-access-core";

const p = (d: string) => ({ activity_date: d, activity_type: "Pratique" });

describe("plan des pratiques : semaine en cours seulement", () => {
  it("en semaine : jusqu'au dimanche", () => {
    // mardi 17 nov. 2026
    expect(methodWindow("2026-11-17")).toEqual({ from: "2026-11-03", to: "2026-11-22" });
    expect(isMethodOpen(p("2026-11-22"), "2026-11-17")).toBe(true);
    expect(isMethodOpen(p("2026-11-23"), "2026-11-17")).toBe(false);
  });
  it("dès le samedi, la semaine suivante s'ouvre aussi", () => {
    expect(methodWindow("2026-11-21").to).toBe("2026-11-29");
    expect(methodWindow("2026-11-22").to).toBe("2026-11-29");
    expect(isMethodOpen(p("2026-11-23"), "2026-11-21")).toBe(true);
  });
  it("les pratiques passées restent ouvertes 14 jours, les matchs toujours", () => {
    expect(isMethodOpen(p("2026-11-03"), "2026-11-17")).toBe(true);
    expect(isMethodOpen(p("2026-11-02"), "2026-11-17")).toBe(false);
    expect(isMethodOpen({ activity_date: "2026-12-20", activity_type: "Match" }, "2026-11-17")).toBe(true);
  });
  it("dit quand le plan s'ouvrira", () => {
    expect(opensOn("2026-11-25")).toBe("2026-11-21");
    expect(opensOn("2026-11-23")).toBe("2026-11-21");
  });
});
