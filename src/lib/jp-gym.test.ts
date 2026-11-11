import { describe, expect, it } from "vitest";

import { GYM, cycleWeek, exerciseById, lastEntry, parseGymLog, restLabel, sessionFor, sessionLine, setsFor, targetFor, trimGymLog } from "@/lib/jp-gym";

const squat = exerciseById("squat")!;
const planche = exerciseById("planche")!;

describe("Mon gym (espace JP)", () => {
  it("chaque exercice a un identifiant unique et une fourchette valide", () => {
    const ids = GYM.flatMap((s) => s.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of GYM) for (const e of s.exercises) expect(e.repsMin).toBeLessThanOrEqual(e.repsMax);
  });

  it("mardi A, mercredi B, vendredi C, sinon la prochaine séance", () => {
    expect(sessionFor("2026-11-10").session.key).toBe("A");
    expect(sessionFor("2026-11-11")).toMatchObject({ isToday: true, session: { key: "B" } });
    expect(sessionFor("2026-11-13").session.key).toBe("C");
    expect(sessionFor("2026-11-14")).toMatchObject({ isToday: false, date: "2026-11-17", session: { key: "A" } });
  });

  it("cycle de 6 semaines : repères, progression, allègement", () => {
    expect(cycleWeek("2026-11-11")).toMatchObject({ week: 1, phase: "reperes" });
    expect(cycleWeek("2026-11-18")).toMatchObject({ week: 2, phase: "progression" });
    expect(cycleWeek("2026-12-16")).toMatchObject({ week: 6, phase: "allegement" });
    expect(cycleWeek("2026-12-22")).toMatchObject({ week: 1, cycle: 2 });
    expect(setsFor(squat, "allegement")).toBe(2);
  });

  it("double progression : la charge monte quand le haut de la fourchette est fait partout", () => {
    expect(targetFor(squat, null, "reperes").weight).toBeNull();
    expect(targetFor(squat, { w: 60, r: [8, 8, 8] }, "progression")).toMatchObject({ weight: 62.5 });
    expect(targetFor(squat, { w: 60, r: [8, 7, 6] }, "progression").weight).toBe(60);
    expect(targetFor(squat, { w: 60, r: [8, 8, 8] }, "allegement").weight).toBe(60);
    expect(targetFor(planche, { w: null, r: [45, 45] }, "progression").text).toContain("10 s");
  });

  it("retrouve la dernière fois et lit le journal sans planter", () => {
    const log = parseGymLog('{"2026-11-10":{"squat":{"w":60,"r":[8,7,6]}},"2026-11-17":{"squat":{"w":60,"r":[8,8,8]}},"pas-une-date":{}}');
    expect(lastEntry(log, "squat", "2026-11-17")?.date).toBe("2026-11-10");
    expect(lastEntry(log, "squat", "2026-11-24")?.entry.r).toEqual([8, 8, 8]);
    expect(parseGymLog("x")).toEqual({});
    expect(Object.keys(trimGymLog(log, "2027-06-01"))).toEqual([]);
  });

  it("textes courts pour le calendrier", () => {
    expect(restLabel(150)).toBe("2 min 30");
    expect(restLabel(45)).toBe("45 s");
    expect(sessionLine(GYM[0])).toMatch(/^Mardi A : squat 3×5-8/);
  });
});
