import { describe, expect, it } from "vitest";

import { cleanTitle, computeGroup, eventKind, isCancelled, isSoloSession, promiseFor, titleDate, type DeliveryEvent } from "@/lib/delivery-core";

const ev = (id: number, date: string | null, title = "Pratique en gym"): DeliveryEvent => ({ id, title, date, kind: eventKind(title), cancelled: isCancelled(title) });

describe("promesses tenues", () => {
  it("reconnaît les matchs et les activités annulées", () => {
    expect(eventKind("Match vs Dollard CDC")).toBe("match");
    expect(eventKind("Pratique semi privée")).toBe("pratique");
    expect(isCancelled("ANNULÉE : Pratique semi privée")).toBe(true);
    expect(isCancelled("[Annulé] Pratique")).toBe(true);
    expect(isCancelled("Pratique en gym")).toBe(false);
    expect(isCancelled("Pratique solo en gym (one-o... (Annulé) Ven 16 oct. 2026 06:00 PM")).toBe(true);
    expect(eventKind("Hors-concours c. Dollars-De... Sam 7 nov. 2026 08:15 AM")).toBe("match");
    expect(eventKind("Autre c. À déterminer (équi... Dim 3 jan. 2027 04:30 PM")).toBe("match");
    expect(eventKind("Pratique sur synthétique Dim 6 déc. 2026 04:30 PM")).toBe("pratique");
    expect(isSoloSession("Pratique solo en gym (one-o... Ven 9 oct. 2026 06:00 PM")).toBe(true);
    expect(isSoloSession("FC Elevate – séance de regr... Sam 28 nov. 2026 07:30 PM")).toBe(false);
  });

  it("lit la date et nettoie le titre de la grille", () => {
    expect(titleDate("Pratique sur synthétique Dim 6 déc. 2026 04:30 PM")).toBe("2026-12-06");
    expect(titleDate("Hors-concours c. À détermin... Sam 9 jan. 2027 08:45 AM")).toBe("2027-01-09");
    expect(titleDate("Pratique d'ajustement Mer 23 sept. 2026 06:30 PM")).toBe("2026-09-23");
    expect(titleDate("Pratique en gym")).toBe(null);
    expect(cleanTitle("Pratique sur synthétique Dim 6 déc. 2026 04:30 PM")).toBe("Pratique sur synthétique");
  });

  it("calcule donné, à venir, annulé et ce qu'il faut remettre, joueuse par joueuse (demi-saison comprise)", () => {
    const events = [ev(1, "2026-11-02"), ev(2, "2026-11-09"), ev(3, "2026-11-16", "ANNULÉE : Pratique en gym"), ev(4, "2026-11-23"), ev(5, "2026-12-21"), ev(6, "2026-11-30", "Match vs X")];
    const g = computeGroup("Lundi", "technique", events, [
      { name: "Léa", program: "TV", promised: 5, until: null },
      { name: "Alexia", program: "TVA", promised: 3, until: "2026-12-15" }
    ], "2026-11-10");
    expect(g.given).toBe(2);
    expect(g.upcoming).toBe(2);
    expect(g.cancelled).toEqual([{ date: "2026-11-16", title: "ANNULÉE : Pratique en gym" }]);
    expect(g.players.find((p) => p.name === "Léa")).toMatchObject({ given: 2, upcoming: 2, shortfall: 1 });
    expect(g.players.find((p) => p.name === "Alexia")).toMatchObject({ given: 2, upcoming: 1, shortfall: 0 });
    expect(g.shortfall).toBe(1);
  });

  it("promesse selon le programme, divisée en deux pour la demi-saison", () => {
    expect(promiseFor("technique", "TV", false)).toBe(20);
    expect(promiseFor("technique", "TVA", true)).toBe(10);
    expect(promiseFor("equipe", "SV", false)).toBe(10);
    expect(promiseFor("equipe", "NV", false)).toBe(0);
    expect(promiseFor("solo", "SVA", false)).toBe(5);
    expect(promiseFor("programme", "prog:garcons-2014", false, 12)).toBe(12);
  });
});
