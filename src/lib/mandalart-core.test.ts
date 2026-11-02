import { describe, expect, it } from "vitest";

import planJson from "../../data/mandalart.json";
import {
  addMonths,
  buildLiveTasks,
  currentLevelId,
  executionOf,
  kpiProgress,
  levelProgress,
  medalFor,
  monthFocus,
  nowList,
  parseKpiNumber,
  pillarProgress,
  progressOf
} from "@/lib/mandalart-core";
import type { MandalartPlan } from "@/lib/mandalart-plan";

const PLAN = planJson as unknown as MandalartPlan;
const TODAY = "2026-11-02";

describe("plan", () => {
  it("contient 8 piliers × 8 objectifs, des codes uniques et 6 niveaux", () => {
    expect(PLAN.pillars).toHaveLength(8);
    for (const p of PLAN.pillars) expect(p.objectives).toHaveLength(8);
    const codes = PLAN.pillars.flatMap((p) => p.objectives.flatMap((o) => o.tasks.map((t) => t.code)));
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThanOrEqual(251);
    expect(PLAN.levels.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(PLAN.trajectory.months[0]).toMatchObject({ month: "2026-11", target: 6300, floor: 3400 });
  });
});

describe("progression", () => {
  it("pondère les ⭐ double et exclut les abandonnées", () => {
    expect(progressOf([{ status: "fait", priority: "star" }, { status: "a_faire", priority: "progressive" }])).toBeCloseTo(2 / 3);
    expect(progressOf([{ status: "en_cours", priority: "progressive" }, { status: "abandonne", priority: "star" }])).toBe(0.5);
    expect(progressOf([{ status: "abandonne", priority: "star" }])).toBeNull();
  });

  it("donne les médailles aux bons seuils", () => {
    expect(medalFor(0.2, false)).toBeNull();
    expect(medalFor(0.25, false)).toBe("bronze");
    expect(medalFor(0.5, false)).toBe("argent");
    expect(medalFor(1, false)).toBe("or");
    expect(medalFor(0.1, true)).toBe("mauve");
  });

  it("garde les cases cochées du plan ([x]) et l'état en base a priorité", () => {
    const tasks = buildLiveTasks(PLAN, [{ code: "P2.2.01", status: "a_faire", note: null, evidence_url: null, done_at: null }], [], TODAY);
    expect(tasks.find((t) => t.code === "P2.7.01")?.status).toBe("fait");
    expect(tasks.find((t) => t.code === "P2.2.01")?.status).toBe("a_faire");
  });

  it("commence au niveau 1 et passe au niveau 2 quand toutes les ⭐ du niveau 1 sont faites", () => {
    const tasks = buildLiveTasks(PLAN, [], [], TODAY);
    expect(currentLevelId(tasks, [1, 2, 3, 4, 5, 6])).toBe(1);
    const states = tasks.filter((t) => t.level === 1 && t.priority === "star").map((t) => ({ code: t.code, status: "fait" as const, note: null, evidence_url: null, done_at: null }));
    const after = buildLiveTasks(PLAN, states, [], TODAY);
    const { current, levels } = levelProgress(PLAN, after, TODAY);
    expect(current).toBe(2);
    expect(levels[0].state).toBe("fait");
    expect(levels[1].state).toBe("en_cours");
  });

  it("calcule pilier et exécution", () => {
    const tasks = buildLiveTasks(PLAN, [], [], TODAY);
    const pillars = pillarProgress(PLAN, tasks);
    expect(pillars).toHaveLength(8);
    const exec = executionOf(pillars);
    expect(exec).toBeGreaterThan(0);
    expect(exec).toBeLessThan(0.1);
  });

  it("marque en retard une tâche ouverte dont l'échéance est passée", () => {
    const tasks = buildLiveTasks(PLAN, [], [], "2026-12-01");
    expect(tasks.find((t) => t.code === "P1.1.01")?.overdue).toBe(true);
    expect(buildLiveTasks(PLAN, [], [], TODAY).find((t) => t.code === "P1.1.01")?.overdue).toBe(false);
  });
});

describe("écrans", () => {
  it("« À faire maintenant » montre au plus 7 ⭐ du niveau actuel, triées par échéance", () => {
    const tasks = buildLiveTasks(PLAN, [], [], TODAY);
    const now = nowList(tasks, 1);
    expect(now.stars.length).toBe(7);
    expect(now.stars[0].due! <= now.stars[6].due!).toBe(true);
    expect(now.moreStars).toBeGreaterThan(0);
  });

  it("« Ce mois-ci » sépare les tâches du mois et celles à préparer d'avance", () => {
    const tasks = buildLiveTasks(PLAN, [], [], TODAY);
    const f = monthFocus(tasks, TODAY);
    expect(f.month).toBe("2026-11");
    expect(f.dueThisMonth.every((t) => t.due?.startsWith("2026-11"))).toBe(true);
    expect(f.prepare.every((t) => t.priority === "star" && t.due! >= "2026-12-01" && t.due! < "2027-02-01")).toBe(true);
    expect(f.prepare.some((t) => t.code === "P2.4.05")).toBe(true);
  });

  it("addMonths passe les années", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });
});

describe("indicateurs", () => {
  it("lit les nombres du plan", () => {
    expect(parseKpiNumber("106 986 $ (2026, encaissé d'avril à octobre)")).toMatchObject({ value: 106986, unit: "$" });
    expect(parseKpiNumber("74 % (37 familles sur 50)")).toMatchObject({ value: 74, unit: "%" });
    expect(parseKpiNumber("≤ 70 $")).toMatchObject({ value: 70, lowerIsBetter: true });
    expect(parseKpiNumber("9/10").value).toBe(9);
    expect(parseKpiNumber("à mesurer").value).toBeNull();
  });

  it("mesure la distance à la cible entre 0 et 1", () => {
    expect(kpiProgress(83, 200, 141.5)).toBeCloseTo(0.5);
    expect(kpiProgress(74, 85, 90)).toBe(1);
    expect(kpiProgress(0, 100, -5)).toBe(0);
    expect(kpiProgress(null, 70, 60, true)).toBe(1);
    expect(kpiProgress(0, 10, null)).toBeNull();
  });
});

describe("jeu", () => {
  it("donne l'XP, le rang et la série", async () => {
    const { xpOf, rankOf, streakOf, dailyQuest } = await import("@/lib/mandalart-game");
    const tasks = buildLiveTasks(PLAN, [{ code: "P1.1.01", status: "fait", note: null, evidence_url: null, done_at: "2026-11-02T15:00:00Z" }], [], TODAY);
    expect(xpOf(tasks)).toBeGreaterThanOrEqual(100);
    expect(rankOf(0).name).toBe("Recrue");
    expect(rankOf(600).name).toBe("Titulaire");
    expect(streakOf(["2026-11-02", "2026-11-01", "2026-10-30"], "2026-11-02")).toBe(2);
    expect(streakOf(["2026-11-01"], "2026-11-02")).toBe(1);
    expect(streakOf([], "2026-11-02")).toBe(0);
    const q = dailyQuest(tasks, 1);
    expect(q).toHaveLength(3);
    expect(q.every((t) => t.status !== "fait")).toBe(true);
  });
});
