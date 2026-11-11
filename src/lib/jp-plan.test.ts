import { describe, expect, it } from "vitest";

import { PLAN, isPieceDone, leftovers, nextAction, parseChecks, pieceOfStep, pieceProgress, weekOf } from "@/lib/jp-plan";

const none = new Set<string>();

describe("Mon plan (espace JP)", () => {
  it("les semaines se suivent sans trou et chaque étape a un identifiant unique", () => {
    for (let i = 1; i < PLAN.length; i++) {
      const prevEnd = new Date(`${PLAN[i - 1].end}T12:00:00Z`);
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
      expect(PLAN[i].start).toBe(prevEnd.toISOString().slice(0, 10));
    }
    const ids = PLAN.flatMap((w) => w.pieces.flatMap((p) => [p.id, ...p.steps.map((s) => s.id)]));
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of PLAN) for (const p of w.pieces) expect(p.steps.length).toBeGreaterThan(0);
  });

  it("trouve la semaine du jour", () => {
    expect(weekOf("2026-11-11")?.n).toBe(1);
    expect(weekOf("2026-11-15")?.n).toBe(1);
    expect(weekOf("2026-11-16")?.n).toBe(2);
    expect(weekOf("2026-12-19")?.n).toBe(6);
    expect(weekOf("2027-01-05")).toBeNull();
  });

  it("une seule prochaine action : d'abord la pièce ⭐ de la semaine, étape par étape", () => {
    expect(nextAction("2026-11-11", {}, none)?.step.id).toBe("s1-p1");
    expect(nextAction("2026-11-11", { "s1-p1": true }, none)?.step.id).toBe("s1-p2");
    expect(nextAction("2026-11-16", {}, none)?.piece.id).toBe("s1-pratiques"); // pas fini la semaine 1 : à rattraper
    expect(nextAction("2026-11-16", {}, none)?.late).toBe(true);
  });

  it("une pièce est finie quand toutes ses étapes sont cochées ou que ses tâches du Mandalart sont faites", () => {
    const google = pieceOfStep("s2-g1")!;
    expect(google.id).toBe("s2-google");
    expect(isPieceDone(google, {}, none)).toBe(false);
    expect(isPieceDone(google, {}, new Set(["P3.8.06"]))).toBe(true);
    expect(pieceProgress(google, { "s2-g1": true }, none)).toEqual({ done: 1, total: 4, finished: false });
    const all = Object.fromEntries(google.steps.map((s) => [s.id, true]));
    expect(pieceProgress(google, all, none).finished).toBe(true);
    expect(leftovers("2026-11-23", all, none).map((p) => p.id)).not.toContain("s2-google");
  });

  it("lit le réglage sans planter", () => {
    expect(parseChecks(null)).toEqual({});
    expect(parseChecks("pas du json")).toEqual({});
    expect(parseChecks('{"s1-p1":true,"x":1}')).toEqual({ "s1-p1": true });
  });
});
