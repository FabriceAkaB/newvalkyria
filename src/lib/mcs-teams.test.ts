import { describe, expect, it } from "vitest";

import { needsOpponent, opponentOf, overlaps, parseBirthYears, slotConflict } from "@/lib/mcs-teams";

describe("MonClubSportif : équipes, adversaires et conflits", () => {
  it("lit l'adversaire dans le titre d'un match", () => {
    expect(opponentOf("U10 F vs Laval")).toBe("Laval");
    expect(opponentOf("Match contre FC Blainville (2015)")).toBe("FC Blainville 2015");
    expect(opponentOf("Match @ Rosemère")).toBe("Rosemère");
    expect(opponentOf("Match vs à déterminer")).toBeNull();
    expect(opponentOf("Match vs ???")).toBeNull();
    expect(opponentOf("Match amical")).toBeNull();
    // Titres réels de MonClubSportif
    expect(opponentOf("Other Équipe 2015 AV vs. À déterminer (équipe extérieure)")).toBeNull();
    expect(opponentOf("Autre Équipe 2015 INT c. À déterminer (équipe extérieure)")).toBeNull();
    expect(opponentOf("Hors-concours Équipe 2016-2017 AV c. Dollars-Des-Ormeaux D1")).toBe("Dollars-Des-Ormeaux D1");
    expect(opponentOf("Other Équipe 2015 AV vs. Atlhetic club Montréal 2014 F")).toBe("Atlhetic club Montréal 2014 F");
    expect(opponentOf("Événement Équipe 2016-2017 AV - Pratique bonus – 2016 avancé")).toBeNull();
  });

  it("un match sans adversaire est à combler, pas une pratique", () => {
    expect(needsOpponent({ type: "Match", title: "Match U11 vs TBD" })).toBe(true);
    expect(needsOpponent({ type: "Match", title: "U11 vs Mirabel" })).toBe(false);
    expect(needsOpponent({ type: "Pratique", title: "Pratique" })).toBe(false);
    expect(needsOpponent({ type: "Match", title: "Événement Équipe 2015 INT - Simulation match #2" })).toBe(false);
    expect(needsOpponent({ type: "Match", title: "Autre Équipe 2015 INT c. À déterminer (équipe extérieure)" })).toBe(true);
  });

  it("détecte le chevauchement avec 30 minutes de déplacement", () => {
    const slot = { date: "2026-11-07", start: "08:15", end: "09:45" };
    expect(overlaps(slot, { date: "2026-11-07", start: "10:00", end: "11:00" })).toBe(true);
    expect(overlaps(slot, { date: "2026-11-07", start: "10:30", end: "11:30" })).toBe(false);
    expect(overlaps(slot, { date: "2026-11-08", start: "08:15", end: "09:45" })).toBe(false);
    expect(overlaps(slot, { date: "2026-11-07", start: null, end: null })).toBe(true);
  });

  it("bloque une plage si l'équipe du même âge est déjà prise", () => {
    const teams = [
      { id: "a", name: "Valkyria 2016", birth_years: [2016] },
      { id: "b", name: "Valkyria 2014-2013", birth_years: [2013, 2014] }
    ];
    const events = [{ team_id: "a", date: "2026-11-07", start: "08:30", end: "10:00", title: "Pratique", type: "Pratique" }];
    const slot = { slot_date: "2026-11-07", start_time: "08:15", end_time: "09:45", birth_year_min: 2016, birth_year_max: 2016 };
    expect(slotConflict(slot, teams, events)?.team).toBe("Valkyria 2016");
    expect(slotConflict({ ...slot, birth_year_min: 2013, birth_year_max: 2014 }, teams, events)).toBeNull();
    expect(slotConflict({ ...slot, birth_year_min: null, birth_year_max: null }, teams, events)).toBeNull();
  });

  it("comprend les années écrites librement", () => {
    expect(parseBirthYears("2013-2014")).toEqual([2013, 2014]);
    expect(parseBirthYears("2017 et 2018")).toEqual([2017, 2018]);
    expect(parseBirthYears("U10")).toEqual([]);
  });
});
