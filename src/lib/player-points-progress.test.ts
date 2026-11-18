import { describe, expect, it } from "vitest";

import { LEVELS, progressOf } from "@/lib/player-points";

describe("progression des points comme dans un jeu", () => {
  it("monte de niveau avec les points gagnés", () => {
    expect(progressOf(0).level.name).toBe("Recrue");
    const p = progressOf(80);
    expect(p.level.name).toBe("Joueuse");
    expect(p.next?.name).toBe("Guerrière");
    expect(p.toNext).toBe(20);
    expect(p.pct).toBeCloseTo(0.5);
  });

  it("au dernier niveau, la barre est pleine", () => {
    const p = progressOf(999);
    expect(p.level.name).toBe(LEVELS.at(-1)!.name);
    expect(p.next).toBeNull();
    expect(p.pct).toBe(1);
  });

  it("le niveau suit les points gagnés, les récompenses suivent le solde à dépenser", () => {
    const rewards = [
      { id: "b", name: "Gourde", cost: 120 },
      { id: "a", name: "Choisir le jeu de fin", cost: 50 }
    ];
    const p = progressOf(170, rewards, 70);
    expect(p.level.name).toBe("Capitaine");
    expect(p.affordable).toEqual([{ id: "a", name: "Choisir le jeu de fin", cost: 50 }]);
    expect(p.nextReward).toEqual({ id: "b", name: "Gourde", cost: 120, toGo: 50 });
  });
});
