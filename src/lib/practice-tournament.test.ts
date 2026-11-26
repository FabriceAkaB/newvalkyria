import { describe, expect, it } from "vitest";

import { captainTaskFor, type PastTeam } from "@/lib/practice-teams-core";
import {
  buildSchedule,
  champion,
  finishFor,
  formTournamentTeams,
  outcome,
  pairSaturation,
  parseResult,
  parseSettings,
  poolDone,
  resolveSlot,
  standings,
  teamPlan,
  type TournamentSettings
} from "@/lib/practice-tournament";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `j${i + 1}`);
const base: TournamentSettings = { format: 4, finish: "poule", durationMin: 30, fields: 1, changeoverMin: 0, rounds: 1 };

describe("teamPlan", () => {
  it("fait des équipes complètes et une joker par fille en trop", () => {
    expect(teamPlan(16, 4)).toEqual({ teams: 4, jokers: 0, short: 0 });
    expect(teamPlan(13, 4)).toEqual({ teams: 3, jokers: 1, short: 0 });
    expect(teamPlan(11, 3)).toEqual({ teams: 3, jokers: 2, short: 0 });
  });
  it("ajoute une équipe quand il reste plus de filles que d'équipes", () => {
    const p = teamPlan(17, 6);
    expect(p.teams).toBe(3);
    expect(p.jokers).toBe(0);
  });
  it("garde 2 équipes quand il n'y a pas assez de filles", () => {
    expect(teamPlan(7, 4).teams).toBe(2);
    expect(teamPlan(1, 4).teams).toBe(0);
  });
});

describe("formTournamentTeams", () => {
  it("met tout le monde, une seule fois, avec une joker dans une équipe", () => {
    const players = ids(13).map((id) => ({ id, rating: 3 }));
    const teams = formTournamentTeams(players, 4, [], 42);
    expect(teams).toHaveLength(3);
    expect(teams.flatMap((t) => t.members).sort()).toEqual(ids(13).sort());
    expect(teams.filter((t) => t.joker)).toHaveLength(1);
    expect(teams.every((t) => t.captain && t.members.includes(t.captain))).toBe(true);
    expect(new Set(teams.map((t) => t.color)).size).toBe(3);
  });

  it("équilibre les forces : les 4 meilleures ne sont jamais ensemble", () => {
    const players = ids(16).map((id, i) => ({ id, rating: i < 4 ? 5 : i < 8 ? 4 : i < 12 ? 2 : 1 }));
    const teams = formTournamentTeams(players, 4, [], 7);
    for (const t of teams) expect(t.members.filter((m) => ["j1", "j2", "j3", "j4"].includes(m)).length).toBe(1);
  });

  it("évite les filles déjà ensemble", () => {
    const history: PastTeam[] = [
      { kind: "equipe", members: ["j1", "j2", "j3", "j4"], captain: "j1", date: "2026-11-20" },
      { kind: "equipe", members: ["j5", "j6", "j7", "j8"], captain: "j5", date: "2026-11-20" }
    ];
    const teams = formTournamentTeams(ids(8).map((id) => ({ id, rating: null })), 4, history, 3);
    for (const t of teams) {
      expect(t.members.filter((m) => ["j1", "j2", "j3", "j4"].includes(m)).length).toBe(2);
      // Les capitaines d'avant ne le sont pas encore.
      expect(["j1", "j5"]).not.toContain(t.captain);
    }
  });

  it("tient plus compte des notes quand toutes les paires ont déjà été ensemble", () => {
    const all = ids(8);
    const history: PastTeam[] = [];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) history.push({ kind: "duo", members: [all[i], all[j]], captain: null, date: "2026-11-01" });
    expect(pairSaturation(all, history)).toBe(1);
    const players = all.map((id, i) => ({ id, rating: i < 2 ? 5 : 1 }));
    const teams = formTournamentTeams(players, 4, history, 11);
    for (const t of teams) expect(t.members.filter((m) => m === "j1" || m === "j2").length).toBe(1);
  });
});

describe("buildSchedule", () => {
  it("5 équipes, 1 terrain : 10 matchs, chacune affronte chacune une fois", () => {
    const s = buildSchedule(5, base);
    const pool = s.matches.filter((m) => m.phase === "poule");
    expect(pool).toHaveLength(10);
    const pairs = new Set(pool.map((m) => ["team" in m.a ? m.a.team : -1, "team" in m.b ? m.b.team : -1].sort().join("-")));
    expect(pairs.size).toBe(10);
    expect(s.matchMin).toBe(3);
  });
  it("4 équipes, 2 terrains, demi-finales : 3 vagues de poule, demi, finale + petite finale", () => {
    const s = buildSchedule(4, { ...base, fields: 2, finish: "demi-finales", durationMin: 40, changeoverMin: 1 });
    expect(s.waves).toBe(5);
    expect(s.matchMin).toBe(7);
    expect(s.matches.find((m) => m.id === "f")?.start).toBe(32);
    expect(s.matches.some((m) => m.phase === "petite-finale")).toBe(true);
  });
  it("aller-retour double la poule ; trop court est signalé", () => {
    expect(buildSchedule(3, { ...base, rounds: 2 }).matches).toHaveLength(6);
    expect(buildSchedule(6, { ...base, durationMin: 10 }).tooShort).toBe(true);
  });
  it("pas de demi-finales à moins de 4 équipes", () => {
    expect(finishFor(3, "demi-finales")).toBe("finale");
    expect(finishFor(2, "finale")).toBe("poule");
  });
});

describe("classement", () => {
  const s = buildSchedule(3, { ...base, finish: "finale" });
  const pool = s.matches.filter((m) => m.phase === "poule");
  const idOf = (a: number, b: number) => pool.find((m) => "team" in m.a && "team" in m.b && [m.a.team, m.b.team].sort().join() === [a, b].sort().join())!;
  const res = (a: number, b: number, ga: number | null, gb: number | null, winner: "a" | "b" | "nul" | null = null) => {
    const m = idOf(a, b);
    const flip = "team" in m.a && m.a.team !== a;
    return { [m.id]: flip ? { a: gb, b: ga, winner: winner === "a" ? "b" : winner === "b" ? "a" : winner } : { a: ga, b: gb, winner } } as Record<string, { a: number | null; b: number | null; winner: "a" | "b" | "nul" | null }>;
  };

  it("victoire 2, nul 1, défaite 0 ; départage à la différence de buts", () => {
    const results = { ...res(0, 1, 3, 1), ...res(1, 2, 2, 2), ...res(0, 2, 0, 1) };
    const t = standings(3, s.matches, results);
    // 0 : 2 pts (+1), 1 : 1 pt, 2 : 3 pts.
    expect(t.map((r) => [r.team, r.points])).toEqual([[2, 3], [0, 2], [1, 1]]);
    expect(poolDone(s.matches, results)).toBe(true);
    const f = s.matches.find((m) => m.phase === "finale")!;
    expect(resolveSlot(f.a, s.matches, results, t)).toBe(2);
    expect(resolveSlot(f.b, s.matches, results, t)).toBe(0);
  });

  it("toucher l'équipe gagnante sans score compte la victoire", () => {
    const results = res(0, 1, null, null, "a");
    const t = standings(3, s.matches, results);
    expect(t[0]).toMatchObject({ team: 0, points: 2, played: 1, goalsFor: 0 });
  });

  it("la finale nulle attend la gagnante aux tirs", () => {
    const results = { ...res(0, 1, 1, 0), ...res(1, 2, 1, 0), ...res(0, 2, 1, 0), f: { a: 2, b: 2, winner: null } };
    const t = standings(3, s.matches, results);
    expect(champion(s.matches, results, t)).toBeNull();
    const done = { ...results, f: { a: 2, b: 2, winner: "b" as const } };
    expect(champion(s.matches, done, t)).toBe(1);
  });

  it("lit les scores et la gagnante", () => {
    expect(outcome({ a: 2, b: 1, winner: null })).toBe("a");
    expect(outcome({ a: null, b: null, winner: "nul" })).toBe("nul");
    expect(parseResult({ a: "3", b: "", winner: null })).toEqual({ a: 3, b: null, winner: null });
    expect(parseResult({ a: -1, b: 0 })).toBeNull();
  });
});

describe("réglages et capitaine", () => {
  it("refuse un format inconnu ou une durée absurde", () => {
    expect(parseSettings({ format: 7, durationMin: 20 })).toBeNull();
    expect(parseSettings({ format: 4, durationMin: 2 })).toBeNull();
    expect(parseSettings({ format: 4, durationMin: 25, fields: 9, finish: "finale" })).toMatchObject({ fields: 4, finish: "finale", rounds: 1 });
  });
  it("tâche de la capitaine pour la prise d'info", () => {
    expect(captainTaskFor("Prise d'information")).toMatch(/disponible/);
  });
});

describe("équipes déjà faites", () => {
  it("par date, la plus récente d'abord, seulement avec des filles présentes", async () => {
    const { pastTeamsByDate, captainCounts } = await import("@/lib/practice-tournament");
    const history: PastTeam[] = [
      { kind: "equipe", members: ["j1", "j2"], captain: "j1", date: "2026-11-20" },
      { kind: "equipe", members: ["j3", "j4"], captain: "j3", date: "2026-11-24" },
      { kind: "equipe", members: ["x9"], captain: "x9", date: "2026-11-25" },
      { kind: "duo", members: ["j1", "j3"], captain: null, date: "2026-11-25" }
    ];
    const out = pastTeamsByDate(history, ["j1", "j3"]);
    expect(out.map((d) => d.date)).toEqual(["2026-11-24", "2026-11-20"]);
    expect(captainCounts(history, ["j1", "j3"]).get("j1")).toBe(1);
  });
});
