import { describe, expect, it } from "vitest";
import { departureSignal } from "@/lib/departure-signals";

const m = (date: string, present: boolean) => ({ date, present });

describe("signes de départ", () => {
  it("2 pratiques manquées de suite", () => {
    const s = departureSignal([m("2026-11-02", true), m("2026-11-09", false), m("2026-11-12", false)], "2026-11-18");
    expect(s?.kind).toBe("absences-de-suite");
    expect(s?.reason).toBe("2 pratiques manquées de suite (9 nov. et 12 nov.)");
    expect(s?.lastPresent).toBe("2026-11-02");
  });
  it("une seule absence : rien", () => {
    expect(departureSignal([m("2026-11-09", false), m("2026-11-12", true), m("2026-11-16", false)], "2026-11-18")).toBeNull();
  });
  it("les pratiques à venir ne comptent pas", () => {
    expect(departureSignal([m("2026-11-12", false), m("2026-11-25", false)], "2026-11-18")).toBeNull();
  });
  it("passe de 2 séances à 1 par semaine", () => {
    const marks = [m("2026-10-22", true), m("2026-10-23", true), m("2026-10-28", true), m("2026-10-30", true), m("2026-11-06", true), m("2026-11-13", true)];
    expect(departureSignal(marks, "2026-11-18")?.kind).toBe("frequence-en-baisse");
  });
  it("assidue : rien", () => {
    expect(departureSignal([m("2026-11-02", true), m("2026-11-05", true), m("2026-11-09", true), m("2026-11-12", true)], "2026-11-18")).toBeNull();
  });
});
