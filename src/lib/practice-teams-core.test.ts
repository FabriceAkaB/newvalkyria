import { describe, expect, it } from "vitest";

import { BASE_CAPTAIN_TASK, captainTaskFor, groupCost, makeDuos, makeGroups, pairCounts, pickCaptains, type PastTeam } from "@/lib/practice-teams-core";

const P = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("équipes et duos nouveaux", () => {
  it("répartit en groupes de tailles égales, chaque joueuse une seule fois", () => {
    const g = makeGroups(P.slice(0, 7), 2, [], 1);
    expect(g.map((x) => x.length).sort()).toEqual([3, 4]);
    expect(g.flat().sort()).toEqual(P.slice(0, 7));
  });

  it("évite les filles déjà ensemble la dernière fois", () => {
    const history: PastTeam[] = [
      { kind: "equipe", members: ["a", "b", "c", "d"], captain: "a", date: "2026-11-09" },
      { kind: "equipe", members: ["e", "f", "g", "h"], captain: "e", date: "2026-11-09" }
    ];
    const g = makeGroups(P, 2, history, 7);
    // Le mieux possible : 2 de chaque ancienne équipe dans chaque nouvelle équipe (2 paires répétées par équipe).
    expect(g.reduce((s, x) => s + groupCost(x, pairCounts(history)), 0)).toBe(4);
  });

  it("duos : jamais la même partenaire si c'est possible ; une fille seule rejoint un duo", () => {
    const history: PastTeam[] = [
      { kind: "duo", members: ["a", "b"], captain: null, date: "2026-11-09" },
      { kind: "duo", members: ["c", "d"], captain: null, date: "2026-11-09" }
    ];
    const d = makeDuos(["a", "b", "c", "d"], history, 3);
    expect(d.every((x) => groupCost(x, pairCounts(history)) === 0)).toBe(true);
    expect(makeDuos(["a", "b", "c"], [], 1).map((x) => x.length)).toEqual([3]);
  });

  it("capitaine : celle qui l'a été le moins, puis le moins récemment", () => {
    const history: PastTeam[] = [
      { kind: "equipe", members: ["a", "b"], captain: "a", date: "2026-11-02" },
      { kind: "equipe", members: ["a", "b"], captain: "b", date: "2026-11-09" },
      { kind: "equipe", members: ["c", "d"], captain: "c", date: "2026-11-09" }
    ];
    expect(pickCaptains([["a", "b"], ["c", "d"]], history)).toEqual(["a", "d"]);
  });

  it("tâche de la capitaine selon le thème de la semaine", () => {
    expect(captainTaskFor("Transition défensive (changement de statut)")).toMatch(/Presse/);
    expect(captainTaskFor("Largeur")).toMatch(/gauche/);
    expect(captainTaskFor("Appui-soutien")).toMatch(/appui/i);
    expect(captainTaskFor(null)).toBe(BASE_CAPTAIN_TASK);
  });
});

describe("thème du groupe", () => {
  it("prend la partie du thème qui correspond au groupe", async () => {
    const { themeForGroup } = await import("@/lib/practice-teams-core");
    const t = "Appui-soutien (2014-2015) · Transition offensive (2016-2017)";
    expect(themeForGroup(t, "2016-2017")).toBe("Transition offensive");
    expect(themeForGroup(t, "Filles 2014-2015 avancé")).toBe("Appui-soutien");
    expect(themeForGroup("Largeur", "2015")).toBe("Largeur");
  });
});

describe("Couleurs et qui affronte qui (JP, 20 nov. 2026)", () => {
  it("nombre d'équipes selon les filles attendues", async () => {
    const { teamCountFor } = await import("@/lib/practice-teams-core");
    expect([8, 11, 12, 17, 18].map(teamCountFor)).toEqual([2, 2, 3, 3, 4]);
  });
  it("chaque équipe affronte chaque autre une fois", async () => {
    const { matchups } = await import("@/lib/practice-teams-core");
    expect(matchups(["Violettes", "Noires"])).toEqual([{ games: [["Violettes", "Noires"]], rest: null }]);
    const three = matchups(["A", "B", "C"]);
    expect(three).toHaveLength(3);
    expect(three.every((r) => r.games.length === 1 && r.rest)).toBe(true);
    const four = matchups(["A", "B", "C", "D"]);
    const pairs = four.flatMap((r) => r.games.map((g) => [...g].sort().join("-"))).sort();
    expect(pairs).toEqual(["A-B", "A-C", "A-D", "B-C", "B-D", "C-D"]);
  });
});
