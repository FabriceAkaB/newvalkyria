import { describe, expect, it } from "vitest";

import { areConsecutive, checkEligibility, expandDoubles, restrictionLabel, totalsFor, type SlotRules } from "./match-slots-core";

const open: SlotRules = { allowed_gender: "tous", birth_year_min: null, birth_year_max: null, restriction_note: null };

describe("restrictions de plage", () => {
  it("plage ouverte : aucune restriction affichée, tout le monde admissible", () => {
    expect(restrictionLabel(open)).toBeNull();
    expect(checkEligibility(open, null)).toEqual({ ok: true });
  });

  it("filles nées en 2014 ou plus tôt", () => {
    const rules: SlotRules = { ...open, allowed_gender: "filles", birth_year_max: 2014 };
    expect(restrictionLabel(rules)).toBe("Équipes filles seulement · nés en 2014 ou plus tôt");
    expect(checkEligibility(rules, { gender: "filles", birthYear: 2014 }).ok).toBe(true);
    expect(checkEligibility(rules, { gender: "filles", birthYear: 2012 }).ok).toBe(true);
    expect(checkEligibility(rules, { gender: "filles", birthYear: 2015 }).ok).toBe(false);
    expect(checkEligibility(rules, { gender: "garcons", birthYear: 2014 }).ok).toBe(false);
    expect(checkEligibility(rules, { gender: "mixte", birthYear: 2014 }).ok).toBe(false);
  });

  it("garçons nés en 2015 ou plus tard, et plage de deux années", () => {
    expect(restrictionLabel({ ...open, allowed_gender: "garcons", birth_year_min: 2015 })).toBe("Équipes garçons seulement · nés en 2015 ou plus tard");
    expect(restrictionLabel({ ...open, birth_year_min: 2013, birth_year_max: 2014 })).toBe("nés entre 2013 et 2014");
    expect(restrictionLabel({ ...open, birth_year_min: 2014, birth_year_max: 2014 })).toBe("nés en 2014");
    expect(checkEligibility({ ...open, birth_year_min: 2015 }, { gender: "garcons", birthYear: 2014 }).ok).toBe(false);
  });

  it("une plage restreinte exige la catégorie de l'équipe", () => {
    const r = checkEligibility({ ...open, allowed_gender: "filles" }, null);
    expect(r.ok).toBe(false);
  });

  it("la précision libre s'ajoute au libellé", () => {
    expect(restrictionLabel({ ...open, restriction_note: "Niveau compétitif seulement" })).toBe("Niveau compétitif seulement");
  });
});

describe("doubles cédules", () => {
  const slots = [
    { id: "a", double_group: "g1" },
    { id: "b", double_group: "g1" },
    { id: "c", double_group: null },
    { id: "d", double_group: "g2" }
  ];
  it("choisir une moitié réserve les deux", () => {
    expect(expandDoubles(["a"], slots).sort()).toEqual(["a", "b"]);
    expect(expandDoubles(["c"], slots)).toEqual(["c"]);
    expect(expandDoubles(["b", "a"], slots).sort()).toEqual(["a", "b"]);
  });

  it("détecte deux plages consécutives", () => {
    const a = { slot_date: "2026-11-22", location: "X", end_time: "17:30" };
    expect(areConsecutive(a, { slot_date: "2026-11-22", location: "X", start_time: "17:30" })).toBe(true);
    expect(areConsecutive(a, { slot_date: "2026-11-22", location: "X", start_time: "18:30" })).toBe(false);
    expect(areConsecutive(a, { slot_date: "2026-11-29", location: "X", start_time: "17:30" })).toBe(false);
  });
});

describe("totaux", () => {
  it("50 $ d'acompte + 200 $ le jour du match par plage", () => {
    const one = { price_cents: 5000, balance_due_cents: 20000 };
    expect(totalsFor([one])).toEqual({ depositCents: 5000, balanceCents: 20000, totalCents: 25000 });
    expect(totalsFor([one, one])).toEqual({ depositCents: 10000, balanceCents: 40000, totalCents: 50000 });
  });
});
