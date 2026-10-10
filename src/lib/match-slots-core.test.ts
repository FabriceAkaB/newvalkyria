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

describe("catégories admises multiples", () => {
  // Ex. : plage contre notre groupe AV 2015 → garçons 2014 ou filles 2014–2015
  const rules: SlotRules = {
    ...open,
    allowed_categories: [
      { gender: "garcons", birthYearMin: 2014, birthYearMax: 2014 },
      { gender: "filles", birthYearMin: 2014, birthYearMax: 2015 }
    ],
    preferred_note: "Équipe 2014 recherchée"
  };
  it("libellé lisible avec accord au féminin", () => {
    expect(restrictionLabel(rules)).toBe("Garçons nés en 2014 · Filles nées entre 2014 et 2015");
  });
  it("accepte une catégorie parmi la liste, refuse les autres", () => {
    expect(checkEligibility(rules, { gender: "garcons", birthYear: 2014 }).ok).toBe(true);
    expect(checkEligibility(rules, { gender: "filles", birthYear: 2015 }).ok).toBe(true);
    expect(checkEligibility(rules, { gender: "garcons", birthYear: 2015 }).ok).toBe(false);
    expect(checkEligibility(rules, { gender: "filles", birthYear: 2013 }).ok).toBe(false);
    expect(checkEligibility(rules, { gender: "mixte", birthYear: 2014 }).ok).toBe(false);
    expect(checkEligibility(rules, null).ok).toBe(false);
  });
  it("une catégorie « tous genres » accepte aussi les équipes mixtes", () => {
    const r: SlotRules = { ...open, allowed_categories: [{ gender: "tous", birthYearMin: 2016, birthYearMax: 2017 }] };
    expect(checkEligibility(r, { gender: "mixte", birthYear: 2016 }).ok).toBe(true);
    expect(checkEligibility(r, { gender: "filles", birthYear: 2015 }).ok).toBe(false);
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
  it("200 $ au total par plage : 50 $ d'acompte + 150 $ le jour du match", () => {
    const one = { price_cents: 5000, balance_due_cents: 15000 };
    expect(totalsFor([one])).toEqual({ depositCents: 5000, balanceCents: 15000, totalCents: 20000 });
    expect(totalsFor([one, one])).toEqual({ depositCents: 10000, balanceCents: 30000, totalCents: 40000 });
  });
});
