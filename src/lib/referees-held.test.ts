import { describe, expect, it } from "vitest";

import { canTake } from "@/lib/referees-repo";

describe("poste d'arbitre gardé pour quelqu'un", () => {
  it("seul l'arbitre du bon prénom peut le prendre", () => {
    const held = { status: "ouvert" as const, held_for: "Simon" };
    expect(canTake(held, { first_name: "Adham" })).toBe(false);
    expect(canTake(held, { first_name: "simon" })).toBe(true);
    expect(canTake(held, { first_name: "Simon-Pierre" })).toBe(true);
    expect(canTake(held, null)).toBe(false);
    expect(canTake({ status: "ouvert", held_for: null }, { first_name: "Adham" })).toBe(true);
    expect(canTake({ status: "reserve", held_for: null }, { first_name: "Adham" })).toBe(false);
  });
});
