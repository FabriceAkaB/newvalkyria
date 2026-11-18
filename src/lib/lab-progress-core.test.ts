import { describe, expect, it } from "vitest";

import { dailyChallenge, monthRate, monthTrack, streakOf } from "@/lib/lab-progress-core";

describe("Valkyria Lab : défi du jour et progression", () => {
  it("un exercice par jour, à tour de rôle", () => {
    expect(dailyChallenge(["a", "b", "c"], "2026-11-01")?.item).toBe("a");
    expect(dailyChallenge(["a", "b", "c"], "2026-11-04")?.item).toBe("a");
    expect(dailyChallenge(["a", "b", "c"], "2026-11-17")?.item).toBe("b");
    expect(dailyChallenge([], "2026-11-17")).toBeNull();
  });
  it("compte la série jusqu'à hier si aujourd'hui n'est pas encore fait", () => {
    expect(streakOf(["2026-11-15", "2026-11-16"], "2026-11-17")).toBe(2);
    expect(streakOf(["2026-11-15", "2026-11-16", "2026-11-17"], "2026-11-17")).toBe(3);
    expect(streakOf(["2026-11-14", "2026-11-16"], "2026-11-17")).toBe(1);
    expect(streakOf([], "2026-11-17")).toBe(0);
  });
  it("suit le mois jour par jour", () => {
    const t = monthTrack(["2026-11-02"], "2026-11-03");
    expect(t).toHaveLength(30);
    expect(t.slice(0, 4).map((x) => x.state)).toEqual(["manque", "fait", "aujourdhui", "avenir"]);
    expect(monthRate(["2026-11-02", "2026-11-03", "2026-10-30"], "2026-11-04")).toEqual({ done: 2, elapsed: 4, pct: 50 });
  });
});
