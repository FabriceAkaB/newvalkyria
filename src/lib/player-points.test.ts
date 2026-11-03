import { describe, expect, it } from "vitest";

import { canAddWinner, pointsBalance, POINTS, rewardsFor } from "@/lib/player-points";

describe("pointsBalance", () => {
  it("additionne présences, victoires et attitude, et retire les échanges", () => {
    const b = pointsBalance(4, [
      { kind: "victoire", points: POINTS.victoire },
      { kind: "attitude", points: POINTS.attitude },
      { kind: "bonus", points: 5 },
      { kind: "echange", points: -30 }
    ]);
    expect(b).toEqual({ presence: 20, victoires: 1, attitudes: 1, earned: 45, spent: 30, balance: 15 });
  });
});

describe("canAddWinner", () => {
  it("au plus 3 gagnantes par catégorie et par pratique", () => {
    expect(canAddWinner(2)).toBe(true);
    expect(canAddWinner(3)).toBe(false);
  });
});

describe("rewardsFor", () => {
  it("donne les récompenses atteintes et la prochaine", () => {
    const r = rewardsFor(40, [{ id: "b", name: "Bracelet", cost: 50 }, { id: "a", name: "Choisir le jeu", cost: 20 }, { id: "c", name: "Ballon", cost: 150 }]);
    expect(r.available.map((x) => x.name)).toEqual(["Choisir le jeu"]);
    expect(r.next?.name).toBe("Bracelet");
  });
});
