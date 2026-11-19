import { describe, expect, it } from "vitest";

import { checkReview } from "@/lib/family-reviews";

describe("avis des familles", () => {
  it("demande des étoiles de 1 à 5 et une vraie phrase", () => {
    expect(checkReview({ stars: 0, text: "Super académie, ma fille adore ses pratiques." }).ok).toBe(false);
    expect(checkReview({ stars: 5, text: "Top" }).ok).toBe(false);
    expect(checkReview({ stars: 5, text: "  Super académie, ma fille adore ses pratiques.  " })).toEqual({ ok: true, stars: 5, text: "Super académie, ma fille adore ses pratiques." });
  });
});
