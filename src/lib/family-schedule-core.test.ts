import { describe, expect, it } from "vitest";

import { buildGirlSchedule, eventLabel, fmtDay, fmtHours, fmtTime, splitLocation, type ScheduleEvent } from "@/lib/family-schedule-core";

const ev = (p: Partial<ScheduleEvent>): ScheduleEvent => ({
  teamId: "t1",
  date: "2026-11-20",
  start: "18:30",
  end: "19:45",
  title: "Event Jeudi 2016-2017 - Pratique en gym",
  location: "École des Falaises (gym/futsal)  - 977 rue Marchand, Prévost J0R1T0",
  type: "Pratique",
  opponent: null,
  ...p
});

const base = {
  firstName: "Amaliah",
  lastName: "Ramazan",
  teams: [{ id: "t1", name: "Jeudi 2016-2017", until: null }, { id: "m1", name: "Équipe 2016-2017 INT", until: null }],
  teamNames: new Map([["t1", "Jeudi 2016-2017"], ["m1", "Équipe 2016-2017 INT"], ["solo", "Vendredi Solo"], ["autre", "Lundi 2014-2015"]]),
  absences: [] as { date: string; start: string | null }[],
  today: "2026-11-19",
  nowHm: "12:00"
};

describe("horaire famille", () => {
  it("sépare le lieu et l'adresse", () => {
    expect(splitLocation("École des Falaises (gym/futsal)  - 977 rue Marchand, Prévost J0R1T0")).toEqual({ place: "École des Falaises (gym/futsal)", address: "977 rue Marchand, Prévost J0R1T0" });
    expect(splitLocation("Centre multisports de Rosemère – 354, montée Lesage, Rosemère")).toEqual({ place: "Centre multisports de Rosemère", address: "354, montée Lesage, Rosemère" });
    expect(splitLocation("99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4")).toEqual({ place: null, address: "99 Rue Émilien Marcoux #108, Blainville, QC J7C 0B4" });
    expect(splitLocation(null)).toEqual({ place: null, address: null });
  });

  it("nettoie le titre MonClubSportif", () => {
    expect(eventLabel("Event Jeudi 2016-2017 - Pratique en gym", "Jeudi 2016-2017")).toBe("Pratique en gym");
    expect(eventLabel("Event Programme intensif  Garçons - 2014 - Pratique Programme Intensif", "Programme intensif Garçons 2014")).toBe("Pratique Programme Intensif");
    expect(eventLabel("Pre-season Équipe 2016-2017 INT vs. Dollard-Des-Ormeaux 2016 D2", "Équipe 2016-2017 INT")).toBe("Équipe 2016-2017 INT vs. Dollard-Des-Ormeaux 2016 D2");
  });

  it("écrit les heures à la québécoise", () => {
    expect(fmtTime("18:30")).toBe("18 h 30");
    expect(fmtTime("08:00")).toBe("8 h");
    expect(fmtHours("18:30", "19:45")).toBe("18 h 30 à 19 h 45");
    expect(fmtHours(null, null)).toBeNull();
    expect(fmtDay("2026-11-19", "2026-11-19")).toBe("Aujourd'hui");
    expect(fmtDay("2026-11-20", "2026-11-19")).toBe("Demain");
    expect(fmtDay("2026-11-23", "2026-11-19")).toBe("Lundi 23 novembre");
  });

  it("garde ses pratiques (14 jours) et ses matchs, sans les autres équipes ni les annulés", () => {
    const s = buildGirlSchedule({
      ...base,
      events: [
        ev({}),
        ev({ date: "2026-12-10" }), // au-delà de 14 jours
        ev({ teamId: "autre", date: "2026-11-23" }), // pas son équipe
        ev({ teamId: "m1", date: "2026-11-21", start: "08:15", end: "09:45", type: "Match", title: "Pre-season Équipe 2016-2017 INT vs. Dollard", opponent: "Dollard" }),
        ev({ teamId: "m1", date: "2026-12-20", type: "Match", title: "Other Équipe 2016-2017 INT vs. À déterminer", opponent: "À déterminer" }),
        ev({ teamId: "m1", date: "2026-11-22", type: "Match", title: "Other Équipe 2016-2017 INT vs. (Annulé) pas de match", opponent: "(Annulé) pas de match" })
      ]
    });
    expect(s.practices.map((p) => p.date)).toEqual(["2026-11-20"]);
    expect(s.practices[0]).toMatchObject({ group: "Jeudi 2016-2017", title: "Pratique en gym", place: "École des Falaises (gym/futsal)", start: "18:30", end: "19:45" });
    expect(s.matches.map((m) => [m.date, m.opponent])).toEqual([["2026-11-21", "Dollard"], ["2026-12-20", null]]);
    expect(s.matches[1].title).toBe("Match (adversaire à confirmer)");
  });

  it("montre sa séance solo (même rangée ailleurs), jamais celle d'une autre joueuse", () => {
    const s = buildGirlSchedule({
      ...base,
      events: [
        ev({ teamId: "solo", title: "Event Vendredi Solo - Pratique solo en gym (one-on-one) – Amaliah Ramazan" }),
        ev({ teamId: "t1", date: "2026-11-21", title: "Event Jeudi 2016-2017 - Pratique solo (45 min) – Niko Katsiaras" }),
        ev({ teamId: "solo", date: "2026-11-22", title: "Event Vendredi Solo - FC Elevate – séance de regroupement" })
      ]
    });
    expect(s.practices.map((p) => [p.date, p.group])).toEqual([["2026-11-20", "Vendredi Solo"]]);
  });

  it("retire l'activité où elle est notée absente, celle déjà finie aujourd'hui et ce qui suit la demi-saison", () => {
    const s = buildGirlSchedule({
      ...base,
      teams: [{ id: "t1", name: "Jeudi 2016-2017", until: "2026-11-25" }],
      nowHm: "19:00",
      absences: [{ date: "2026-11-20", start: "18:30" }],
      events: [ev({ date: "2026-11-19", start: "17:00", end: "18:00" }), ev({ date: "2026-11-19", start: "18:30", end: "19:45" }), ev({}), ev({ date: "2026-11-26" })]
    });
    expect(s.practices.map((p) => `${p.date} ${p.start}`)).toEqual(["2026-11-19 18:30"]);
  });
});
