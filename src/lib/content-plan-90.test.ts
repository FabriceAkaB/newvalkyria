import { describe, expect, it } from "vitest";

import { buildPlan90, FAMILIES, HOOK_BANK, planProblems, planWeek, PLAN90_END, PLAN90_START, TESTS_PER_WEEK, weekBalance } from "@/lib/content-plan-90";
import { CTA, FORMATS } from "@/lib/shooting-guide-core";

const plan = buildPlan90();
const organic = plan.filter((p) => p.postKind === "organique");
const tests = plan.filter((p) => p.postKind === "essai");

describe("calendrier de contenu 90 jours", () => {
  it("une publication par jour du 1er déc. 2026 au 28 févr. 2027", () => {
    expect(organic).toHaveLength(90);
    expect(new Set(organic.map((p) => p.date)).size).toBe(90);
    expect(organic[0].date).toBe(PLAN90_START);
    expect(organic.at(-1)!.date).toBe(PLAN90_END);
  });

  it("chaque semaine complète : 3 haut, 3 milieu, 1 bas, et 3 à 5 reels d'essai", () => {
    expect(planProblems(plan)).toEqual([]);
    for (let w = 1; w <= 12; w++) {
      const b = weekBalance(plan.filter((p) => p.week === w));
      expect([b.haut, b.milieu, b.bas]).toEqual([3, 3, 1]);
      expect(b.essais).toBeGreaterThanOrEqual(3);
      expect(b.essais).toBeLessThanOrEqual(5);
    }
  });

  it("la banque a 50 crochets différents, 10 par famille, chacun testé une fois en reel d'essai", () => {
    expect(HOOK_BANK).toHaveLength(50);
    expect(new Set(HOOK_BANK.map((h) => h.text)).size).toBe(50);
    expect(new Set(HOOK_BANK.map((h) => h.id)).size).toBe(50);
    for (const f of FAMILIES) expect(HOOK_BANK.filter((h) => h.family === f.id)).toHaveLength(10);
    expect(TESTS_PER_WEEK.reduce((a, b) => a + b, 0)).toBe(50);
    expect(tests).toHaveLength(50);
    expect(new Set(tests.map((t) => t.hookId)).size).toBe(50);
  });

  it("les 5 familles sont toutes utilisées, chacune dans une place de l'entonnoir qui lui convient", () => {
    for (const f of FAMILIES) expect(organic.some((p) => p.family === f.id)).toBe(true);
    for (const p of organic) expect(FAMILIES.find((f) => f.id === p.family)!.funnels).toContain(p.funnel);
  });

  it("chaque publication a un crochet, l'appel à l'action et un format du guide", () => {
    const formats = new Set(FORMATS.map((f) => f.id));
    for (const p of plan) {
      expect(p.hook.length).toBeGreaterThan(5);
      expect(p.cta).toBe(CTA);
      expect(formats.has(p.format)).toBe(true);
      expect(p.shots.length).toBeGreaterThan(20);
    }
    expect(new Set(plan.map((p) => `${p.date}|${p.title}`)).size).toBe(plan.length);
  });

  it("les semaines vont du dimanche au samedi", () => {
    expect(planWeek("2026-12-01")).toBe(0);
    expect(planWeek("2026-12-05")).toBe(0);
    expect(planWeek("2026-12-06")).toBe(1);
    expect(planWeek("2027-02-28")).toBe(13);
  });

  it("aucun tiret cadratin", () => {
    expect(JSON.stringify(plan) + JSON.stringify(HOOK_BANK)).not.toMatch(/—/);
  });
});
