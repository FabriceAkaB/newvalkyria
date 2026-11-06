import { describe, expect, it } from "vitest";

import { attendanceFromMcs, calendarDiff, DEFAULT_MCS_RULES, dueReminder, normalizeRules, reminderMoments, sameMemberName, teamsFor, yearsOf, type TeamTarget } from "@/lib/mcs-rules";

const H = 3_600_000;
const team = (p: Partial<TeamTarget>): TeamTarget => ({ id: "t", name: "T", kind: "pratique", birth_years: [], slot_ids: [], program_ids: [], session_program_slugs: [], mcs_team_id: 1, mcs_season_id: 2, ...p });

describe("règles MonClubSportif", () => {
  it("valeurs par défaut : mode assistant, tout automatique une fois activé, rappels 48 h, 24 h et 2 fois le jour même", () => {
    const r = normalizeRules(null);
    expect(r.robotActive).toBe(false);
    expect(r.inviteOnPaid && r.photoAuto && r.presenceAlwaysEditable && r.opponentOnPaid && r.calendarSync).toBe(true);
    expect(r.reminders).toEqual({ active: true, hoursBefore: [48, 24], sameDayHours: [9, 15] });
    expect(r.removeOnRefund).toBe("validation");
  });

  it("refuse les valeurs bizarres et garde le reste", () => {
    const r = normalizeRules({ robotActive: true, reminders: { hoursBefore: [24, "x", -3, 24, 72], sameDayHours: [30, 10] }, removeOnRefund: "n'importe", matchLevelByProgram: { TVA: "AV", "bad key!": "AV", TV: "XX" } });
    expect(r.robotActive).toBe(true);
    expect(r.reminders.hoursBefore).toEqual([72, 24]);
    expect(r.reminders.sameDayHours).toEqual([10]);
    expect(r.removeOnRefund).toBe("validation");
    expect(r.matchLevelByProgram).toEqual({ TVA: "AV" });
  });

  it("le bon rappel au bon moment, jamais en retard de plus de 3 h", () => {
    const day = Date.parse("2026-11-08T05:00:00Z"); // minuit à Montréal (HNE)
    const start = day + 16.5 * H; // 16 h 30
    const r = DEFAULT_MCS_RULES;
    expect(reminderMoments(start, day, r).map((m) => m.key)).toEqual(["48h", "24h", "jour-9h", "jour-15h"]);
    expect(dueReminder(start, day, start - 49 * H, r)).toBeNull();
    expect(dueReminder(start, day, start - 47.5 * H, r)).toBe("48h");
    expect(dueReminder(start, day, start - 23 * H, r)).toBe("24h");
    expect(dueReminder(start, day, day + 9.2 * H, r)).toBe("jour-9h");
    expect(dueReminder(start, day, day + 15.5 * H, r)).toBe("jour-15h");
    expect(dueReminder(start, day, start + 1, r)).toBeNull();
    expect(dueReminder(start, day, start - 40 * H, r)).toBeNull(); // 48 h passé depuis plus de 3 h
    expect(dueReminder(start, day, start - 47 * H, { ...r, reminders: { ...r.reminders, active: false } })).toBeNull();
  });

  it("chaque joueuse va dans son groupe de pratique, son équipe de matchs et son programme", () => {
    const teams = [
      team({ id: "lundi", slot_ids: ["s1"] }),
      team({ id: "av", kind: "match", program_ids: ["TVA"], birth_years: [2016, 2017] }),
      team({ id: "int", kind: "match", program_ids: ["TV"], birth_years: [2016, 2017] }),
      team({ id: "g14", kind: "programme", session_program_slugs: ["garcons-2014"] }),
      team({ id: "pv", kind: "programme", program_ids: ["PV"] }),
      team({ id: "sans-numero", slot_ids: ["s1"], mcs_team_id: null })
    ];
    expect(teamsFor({ slotId: "s1", programId: "TVA", years: [2016] }, teams).map((t) => t.id)).toEqual(["lundi", "av"]);
    expect(teamsFor({ slotId: "s9", programId: "TV", years: [2017, 2018] }, teams).map((t) => t.id)).toEqual(["int"]);
    expect(teamsFor({ slotId: "s9", programId: "NV", years: [2016] }, teams)).toEqual([]);
    expect(teamsFor({ sessionProgramSlug: "garcons-2014" }, teams).map((t) => t.id)).toEqual(["g14"]);
    expect(teamsFor({ slotId: null, programId: "PV", years: [2012, 2013] }, teams).map((t) => t.id)).toEqual(["pv"]);
    expect(yearsOf("2014–2013")).toEqual([2013, 2014]);
    expect(yearsOf("2015")).toEqual([2015]);
  });

  it("reconnaît le même jeune malgré un nom un peu différent, sans confondre deux jeunes", () => {
    expect(sameMemberName("Isabella Batista", "Isabella", "Batista Maceirinha")).toBe(true);
    expect(sameMemberName("ELOÏSE  cousineau", "Éloïse", "Cousineau")).toBe(true);
    expect(sameMemberName("Emma Gracioppo", "Emma", "Dorismond Giroux")).toBe(false);
    expect(sameMemberName("Mila Dorothy", "Lyvia", "Dorothy")).toBe(false);
  });

  it("une présence MonClubSportif devient une présence du site, sauf sans réponse ou incertaine", () => {
    expect(attendanceFromMcs("present")).toBe("present");
    expect(attendanceFromMcs("late")).toBe("late");
    expect(attendanceFromMcs("absent")).toBe("absent");
    expect(attendanceFromMcs("uncertain")).toBeNull();
    expect(attendanceFromMcs("unknown")).toBeNull();
    expect(attendanceFromMcs(undefined)).toBeNull();
  });

  it("calendrier : crée ce qui manque, corrige l'heure, signale le reste, ne touche pas aux matchs", () => {
    const site = [
      { date: "2026-11-07", start: "14:00", end: "15:30", title: "P", location: "Chambéry" },
      { date: "2026-11-14", start: "15:00", end: "16:30", title: "P", location: "Chambéry" },
      { date: "2026-11-21", start: "15:00", end: "16:30", title: "P", location: "Chambéry" },
      { date: "2026-11-28", start: "15:00", end: "16:30", title: "P", location: "Chambéry" }
    ];
    const mcs = [
      { id: 1, date: "2026-11-07", start: "15:00", end: "16:30", title: "P", isPractice: true },
      { id: 2, date: "2026-11-14", start: "15:00", end: "16:30", title: "P", isPractice: true },
      { id: 3, date: "2026-11-21", start: "15:05", end: "16:30", title: "P", isPractice: true },
      { id: 4, date: "2026-12-05", start: "15:00", end: "16:30", title: "P", isPractice: true },
      { id: 5, date: "2026-11-28", start: "10:00", end: "11:00", title: "Match", isPractice: false }
    ];
    const d = calendarDiff(site, mcs);
    expect(d.retime.map((r) => [r.id, r.to.start])).toEqual([[3, "15:00"], [1, "14:00"]]);
    expect(d.create.map((c) => c.date)).toEqual(["2026-11-28"]);
    expect(d.extra.map((e) => e.id)).toEqual([4]);
  });
});

describe("toujours assignés", () => {
  it("JP par défaut, liste nettoyée sinon", async () => {
    const { normalizeRules } = await import("@/lib/mcs-rules");
    expect(normalizeRules({}).alwaysAssigned).toEqual(["Jean-Paul Aka Boidi"]);
    expect(normalizeRules({ alwaysAssigned: ["  Maeva  Desjardin ", "x", "Maeva Desjardin"] }).alwaysAssigned).toEqual(["Maeva Desjardin"]);
  });
});

describe("clé photo", () => {
  it("le robot et la liste « à faire dans MCS » utilisent la même clé", async () => {
    const { photoKey } = await import("@/lib/mcs-sync");
    const { personKey } = await import("@/lib/mcs-rules");
    expect(photoKey("Béatrice", "Prévost")).toBe(personKey("Béatrice", "Prévost"));
    expect(photoKey("Béatrice", "Prévost")).toBe("beatrice prevost");
  });
});

describe("joueuses payées pas encore dans MonClubSportif", () => {
  it("liste celle qui manque dans une de ses équipes, ignore les anciennes et celles déjà vues", async () => {
    const { pendingMcsPlayers, memberTeamKey, personKey } = await import("@/lib/mcs-rules");
    const jeudi = { id: "t-jeudi", name: "Jeudi 2016-2017" };
    const int = { id: "t-int", name: "Équipe 2016-2017 INT" };
    const maeva = { key: personKey("Maeva", "ALLAGBE"), firstName: "Maeva", lastName: "ALLAGBE", parentEmail: "p@x.ca", createdAt: "2026-11-06T01:24:19Z", teams: [jeudi, int] };
    const vue = { ...maeva, key: personKey("Léa", "Roy"), firstName: "Léa", lastName: "Roy" };
    const vieille = { ...maeva, key: personKey("Anne", "Lee"), firstName: "Anne", lastName: "Lee", createdAt: "2026-09-01T00:00:00Z" };
    const inMcs = new Set([memberTeamKey(maeva.key, jeudi.id), memberTeamKey(vue.key, jeudi.id), memberTeamKey(vue.key, int.id)]);
    const out = pendingMcsPlayers([maeva, vue, vieille], inMcs, "2026-10-23T00:00:00Z");
    expect(out).toEqual([{ key: maeva.key, name: "Maeva ALLAGBE", parentEmail: "p@x.ca", createdAt: maeva.createdAt, missingTeams: ["Équipe 2016-2017 INT"] }]);
  });
});

describe("nom inversé dans le site", () => {
  it("reconnaît la même joueuse quand prénom et nom sont inversés, sans confondre deux sœurs", async () => {
    const { sameMemberName } = await import("@/lib/mcs-rules");
    expect(sameMemberName("Gabriella Rojas Afanador", "Afanador Reyes", "Gabriella")).toBe(true);
    expect(sameMemberName("Gabriella Rojas Afanador", "Gabriella", "Afanador Reyes")).toBe(true);
    expect(sameMemberName("Èva Roy", "Stella", "Roy")).toBe(false);
    expect(sameMemberName("Roy Stella", "Èva", "Roy")).toBe(false);
  });
});
