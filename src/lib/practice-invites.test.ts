import { describe, expect, it } from "vitest";

import { dayName, inviteSettings, invitesNeeded, isWeekday, overlaps, rankCandidates, rankReason } from "@/lib/practice-invites";

const c = (name: string, o: Partial<{ pinned: number | null; invites: number; evalAvg: number | null; attendance: number | null }> = {}) => ({ registrationId: name, name, pinned: null, invites: 0, evalAvg: null, attendance: null, ...o });

describe("invitations à l'avancé", () => {
  it("n'invite pas pour une seule absence, sinon autant que d'absentes moins les invitations en cours", () => {
    expect(invitesNeeded(1, 0, 2)).toBe(0);
    expect(invitesNeeded(3, 0, 2)).toBe(3);
    expect(invitesNeeded(3, 2, 2)).toBe(1);
    expect(invitesNeeded(2, 3, 2)).toBe(0);
  });

  it("classe : épinglées par JP, puis la moins invitée, puis les évaluations, puis la présence", () => {
    const list = [c("Zoé", { evalAvg: 4.5 }), c("Mia", { invites: 2, evalAvg: 5 }), c("Léa", { pinned: 1 }), c("Ana", { evalAvg: 3.2, attendance: 1 }), c("Eva", { evalAvg: 3.2, attendance: 0.5 })];
    expect(rankCandidates(list).map((x) => x.name)).toEqual(["Léa", "Zoé", "Ana", "Eva", "Mia"]);
    expect(rankReason(c("Léa", { pinned: 1, evalAvg: 4.25, attendance: 0.9 }))).toBe("priorité 1 choisie par JP · pas encore invitée · évaluations 4,3/5 · présence 90 %");
  });

  it("repère un chevauchement d'horaire le même jour", () => {
    expect(overlaps({ day: "Lundi", start: "18:00", end: "19:25" }, { day: "lundi", start: "19:00", end: "20:30" })).toBe(true);
    expect(overlaps({ day: "Lundi", start: "18:00", end: "19:25" }, { day: "Lundi", start: "19:30", end: "20:55" })).toBe(false);
    expect(overlaps({ day: "Lundi", start: "18:00", end: "19:25" }, { day: "Mercredi", start: "18:00", end: "19:25" })).toBe(false);
    expect(dayName("2026-11-23")).toBe("Lundi");
    expect(isWeekday("2026-11-23")).toBe(true);
    expect(isWeekday("2026-11-22")).toBe(false);
    expect(isWeekday("2026-11-21")).toBe(false);
  });

  it("lit les réglages avec des bornes", () => {
    expect(inviteSettings(null)).toEqual({ threshold: 2, horizonDays: 7, enabled: true });
    expect(inviteSettings({ threshold: 0, horizonDays: 99, enabled: false })).toEqual({ threshold: 1, horizonDays: 21, enabled: false });
  });
});
