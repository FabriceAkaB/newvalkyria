import { describe, expect, it } from "vitest";

import { PLAN } from "@/lib/mandalart-plan";
import { isForJp, LEVEL_GUIDES, TASK_GUIDES } from "@/lib/mandalart-steps";

const codes = new Set(PLAN.pillars.flatMap((p) => p.objectives.flatMap((o) => o.tasks.map((t) => t.code))));

describe("Mon plan : guides des tâches", () => {
  it("chaque guide vise une vraie tâche du Mandalart", () => {
    // Les codes « X » sont les tâches ajoutées dans l'admin (mandalart_tasks_custom), absentes du JSON.
    expect(Object.keys(TASK_GUIDES).filter((c) => !codes.has(c) && !/^P\d\.\d\.X\d\d$/.test(c))).toEqual([]);
  });
  it("chaque guide dit comment faire et quand c'est fini", () => {
    for (const [code, g] of Object.entries(TASK_GUIDES)) {
      expect(g.how.length, code).toBeGreaterThan(0);
      expect(g.done.length, code).toBeGreaterThan(5);
    }
  });
  it("chaque palier du plan a sa phrase simple et ses conditions de passage", () => {
    for (const l of PLAN.levels) {
      expect(LEVEL_GUIDES[l.id]?.plain, l.code).toBeTruthy();
      expect(LEVEL_GUIDES[l.id]?.pass.length, l.code).toBeGreaterThan(0);
    }
  });
  it("reconnaît les tâches de JP", () => {
    expect(isForJp("JP")).toBe(true);
    expect(isForJp("JP + Claude Code")).toBe(true);
    expect(isForJp("Coachs + caméra")).toBe(false);
    expect(isForJp("Claude Code (feu vert de JP)")).toBe(true);
    expect(isForJp(null)).toBe(false);
  });
});
