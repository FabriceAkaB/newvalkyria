import { describe, expect, it } from "vitest";

import { buildShareMessage, computePrice, isBirthYearEligible } from "@/lib/private-programs";

describe("computePrice — programmes privés garçons", () => {
  it("garçons 2018 : paiement complet 375 $", () => {
    const p = computePrice({ listCents: 37500, option: "full", installmentFeeCents: 4000 });
    expect(p.totalCents).toBe(37500);
    expect(p.paymentsCents).toEqual([37500]);
  });

  it("garçons 2018 : 2 versements = 415 $ (207,50 $ + 207,50 $)", () => {
    const p = computePrice({ listCents: 37500, option: "two_installments", installmentFeeCents: 4000 });
    expect(p.totalCents).toBe(41500);
    expect(p.installmentFeeCents).toBe(4000);
    expect(p.paymentsCents).toEqual([20750, 20750]);
  });

  it("garçons 2014–2015 : 585 $ comptant, 625 $ en 2 versements de 312,50 $", () => {
    expect(computePrice({ listCents: 58500, option: "full", installmentFeeCents: 4000 }).totalCents).toBe(58500);
    const p = computePrice({ listCents: 58500, option: "two_installments", installmentFeeCents: 4000 });
    expect(p.totalCents).toBe(62500);
    expect(p.paymentsCents).toEqual([31250, 31250]);
  });

  it("rabais de référencement de 50 $ : 2018 → 325 $, ou 365 $ en 2 versements de 182,50 $", () => {
    const full = computePrice({ listCents: 37500, option: "full", installmentFeeCents: 4000, referralDiscountCents: 5000 });
    expect(full.totalCents).toBe(32500);
    const two = computePrice({ listCents: 37500, option: "two_installments", installmentFeeCents: 4000, referralDiscountCents: 5000 });
    expect(two.totalCents).toBe(36500);
    expect(two.paymentsCents).toEqual([18250, 18250]);
  });

  it("rabais de référencement : 2014–2015 → 535 $, ou 575 $ en 2 versements de 287,50 $", () => {
    expect(computePrice({ listCents: 58500, option: "full", installmentFeeCents: 4000, referralDiscountCents: 5000 }).totalCents).toBe(53500);
    const two = computePrice({ listCents: 58500, option: "two_installments", installmentFeeCents: 4000, referralDiscountCents: 5000 });
    expect(two.totalCents).toBe(57500);
    expect(two.paymentsCents).toEqual([28750, 28750]);
  });

  it("un crédit s'applique après le rabais et ne rend jamais le prix négatif", () => {
    const p = computePrice({ listCents: 37500, option: "full", installmentFeeCents: 4000, referralDiscountCents: 5000, creditCents: 5000 });
    expect(p.subtotalCents).toBe(27500);
    const huge = computePrice({ listCents: 5000, option: "full", installmentFeeCents: 0, creditCents: 999999 });
    expect(huge.totalCents).toBe(0);
  });

  it("répartit un total impair sans perdre un cent", () => {
    const p = computePrice({ listCents: 37501, option: "two_installments", installmentFeeCents: 4000 });
    expect(p.paymentsCents.reduce((a, b) => a + b, 0)).toBe(p.totalCents);
  });
});

describe("admissibilité et message de partage", () => {
  it("signale un joueur dont l'année de naissance n'est pas admissible", () => {
    expect(isBirthYearEligible(2018, ["2018"])).toBe(true);
    expect(isBirthYearEligible(2016, ["2018"])).toBe(false);
    expect(isBirthYearEligible(2015, ["2014", "2015"])).toBe(true);
    expect(isBirthYearEligible(null, ["2018"])).toBe(false);
  });

  it("génère le message avec le bon lien et le bon prix", () => {
    const msg = buildShareMessage({
      program: { slug: "garcons-2018", shortName: "Garçons 2018", priceCents: 37500 },
      link: "https://www.newvalkyria.com/prive/garcons-2018?ref=ABC123",
      practices: 16,
      matches: 3,
      capacity: 12,
      feeCents: 4000,
      referralDiscountCents: 5000,
      withReferralMention: true
    });
    expect(msg).toContain("garcons-2018?ref=ABC123");
    expect(msg).toContain("375");
    expect(msg).toContain("16 pratiques");
    expect(msg).toContain("rabais de");
  });
});
