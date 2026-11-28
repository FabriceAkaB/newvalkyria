import { describe, expect, it } from "vitest";

import { alarmPlan, timerState } from "@/lib/coach-guide";

const blocks = [
  { title: "Ball mastery", minutes: 10 },
  { title: "Rondo", minutes: 11 },
  { title: "Match", minutes: 29 }
];

describe("guide de l'éducateur", () => {
  it("les alarmes : début de chaque bloc, puis la fin", () => {
    expect(alarmPlan("18:00", blocks).map((a) => `${a.time} ${a.label}`)).toEqual(["18:00 Début : Ball mastery", "18:10 Début : Rondo", "18:21 Début : Match", "18:50 Fin : bilan, sondage et rangement"]);
  });

  it("le minuteur sait quel bloc est en cours et le temps qui reste", () => {
    const t0 = 0;
    expect(timerState(t0, 5 * 60_000, blocks)).toEqual({ index: 0, remaining: 300, done: false });
    expect(timerState(t0, 10 * 60_000, blocks)).toEqual({ index: 1, remaining: 660, done: false });
    expect(timerState(t0, 60 * 60_000, blocks).done).toBe(true);
  });
});

describe("causerie aux 2 semaines", () => {
  it("une semaine sur deux depuis le 30 nov. 2026", async () => {
    const { causerieDue } = await import("@/lib/coach-guide");
    expect(causerieDue("2026-11-26")).toBe(false);
    expect(causerieDue("2026-11-30")).toBe(true);
    expect(causerieDue("2026-12-06")).toBe(true);
    expect(causerieDue("2026-12-07")).toBe(false);
    expect(causerieDue("2026-12-17")).toBe(true);
    expect(causerieDue("2027-01-11")).toBe(true);
    expect(causerieDue("2027-01-18")).toBe(false);
    expect(causerieDue("2027-01-25")).toBe(true);
  });
});
