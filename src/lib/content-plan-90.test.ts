import { describe, expect, it } from "vitest";

import {
  buildPlan90,
  FAMILIES,
  HOOK_BANK,
  isWinnerReuse,
  MIN_TESTS_PER_WEEK,
  NETWORKS_DEFAULT,
  plan90ForSeed,
  planProblems,
  planWeek,
  PLAN90_END,
  PLAN90_START,
  POSTS_PER_WEEK,
  WINNER_FROM,
  weekBalance
} from "@/lib/content-plan-90";
import { NETWORKS } from "@/lib/marketing-posts-core";
import { CTA, FORMATS } from "@/lib/shooting-guide-core";

const plan = buildPlan90();
const tests = plan.filter((p) => p.postKind === "essai");
const days = [...new Set(plan.map((p) => p.date))];

describe("calendrier de contenu 90 jours, volume Hormozi", () => {
  it("3 publications par jour du vendredi 27 nov. 2026 au 28 févr. 2027", () => {
    expect(PLAN90_START).toBe("2026-11-27");
    expect(days).toHaveLength(94);
    expect(days[0]).toBe(PLAN90_START);
    expect(days.at(-1)).toBe(PLAN90_END);
    expect(plan).toHaveLength(94 * 3);
    for (const d of days) expect(plan.filter((p) => p.date === d).map((p) => p.version)).toEqual(["A", "B", "C"]);
  });

  it("chaque semaine complète : 21 publications, 9 haut, 9 milieu, 3 bas, au moins 15 tests, 3 reprises du gagnant", () => {
    expect(planProblems(plan)).toEqual([]);
    expect(POSTS_PER_WEEK).toBe(21);
    for (let w = 1; w <= 13; w++) {
      const list = plan.filter((p) => p.week === w);
      const b = weekBalance(list);
      expect(list).toHaveLength(21);
      expect([b.haut, b.milieu, b.bas]).toEqual([9, 9, 3]);
      expect(b.essais).toBeGreaterThanOrEqual(MIN_TESTS_PER_WEEK);
      expect(b.gagnants).toBe(w === 1 ? 2 : 3);
    }
  });

  it("les 3 publications d'un jour viennent du même tournage et restent dans la même place de l'entonnoir", () => {
    for (const d of days) {
      const list = plan.filter((p) => p.date === d);
      expect(new Set(list.map((p) => p.shoot)).size).toBe(1);
      expect(new Set(list.map((p) => p.funnel)).size).toBe(1);
      const bare = list.map((p) => p.hook.toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/g, " ").trim());
      for (const a of bare) expect(bare.filter((b) => b.includes(a))).toHaveLength(1);
    }
  });

  it("la règle du gagnant : la version C du mardi, du jeudi et du samedi, dès le 3 déc.", () => {
    const winners = plan.filter((p) => p.winnerReuse);
    expect(winners.every((p) => p.date >= WINNER_FROM && [2, 4, 6].includes(new Date(`${p.date}T12:00:00Z`).getUTCDay()) && p.version === "C")).toBe(true);
    expect(winners.every((p) => isWinnerReuse(p.title) && p.postKind === "organique")).toBe(true);
    expect(plan.filter((p) => !p.winnerReuse).some((p) => isWinnerReuse(p.title))).toBe(false);
  });

  it("la banque a 150 crochets différents, chacun testé une fois sur une vidéo de sa famille", () => {
    expect(HOOK_BANK).toHaveLength(150);
    expect(new Set(HOOK_BANK.map((h) => h.text)).size).toBe(150);
    expect(new Set(HOOK_BANK.map((h) => h.id)).size).toBe(150);
    for (const f of FAMILIES) expect(HOOK_BANK.filter((h) => h.family === f.id).length).toBeGreaterThanOrEqual(10);
    const banked = tests.filter((t) => t.hookId);
    expect(banked).toHaveLength(150);
    expect(new Set(banked.map((t) => t.hookId)).size).toBe(150);
    for (const t of banked) expect(HOOK_BANK.find((h) => h.id === t.hookId)!.family).toBe(t.family);
  });

  it("les 5 familles sont toutes utilisées, chacune dans une place de l'entonnoir qui lui convient", () => {
    for (const f of FAMILIES) expect(plan.some((p) => p.family === f.id)).toBe(true);
    for (const p of plan) expect(FAMILIES.find((f) => f.id === p.family)!.funnels).toContain(p.funnel);
  });

  it("chaque publication a un crochet, l'appel à l'action, un format du guide et des réseaux connus", () => {
    const formats = new Set(FORMATS.map((f) => f.id));
    const networks = new Set(NETWORKS.map((n) => n.id as string));
    expect(NETWORKS_DEFAULT).toEqual(["instagram", "facebook", "tiktok", "youtube"]);
    for (const p of plan) {
      expect(p.hook.length).toBeGreaterThan(5);
      expect(p.cta).toBe(CTA);
      expect(formats.has(p.format)).toBe(true);
      expect(p.shots.length).toBeGreaterThan(20);
      for (const n of p.networks) expect(networks.has(n)).toBe(true);
      expect(p.networks).toContain("instagram");
    }
    expect(new Set(plan.map((p) => `${p.date}|${p.title}`)).size).toBe(plan.length);
  });

  it("le jour 1 (27 nov.) est préparé à part : pas ajouté par le seed", () => {
    const seed = plan90ForSeed();
    expect(seed.some((p) => p.date === "2026-11-27")).toBe(false);
    expect(seed).toHaveLength(plan.length - 3);
  });

  it("les semaines vont du dimanche au samedi", () => {
    expect(planWeek("2026-11-27")).toBe(0);
    expect(planWeek("2026-11-28")).toBe(0);
    expect(planWeek("2026-11-29")).toBe(1);
    expect(planWeek("2026-12-05")).toBe(1);
    expect(planWeek("2027-02-28")).toBe(14);
  });

  it("aucun tiret cadratin, aucune mention de JP Coach ni des garçons", () => {
    const all = JSON.stringify(plan) + JSON.stringify(HOOK_BANK);
    expect(all).not.toMatch(/—/);
    expect(all).not.toMatch(/JP Coach|garçon/i);
  });
});
