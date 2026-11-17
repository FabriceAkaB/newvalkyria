import { describe, expect, it } from "vitest";

import { mergePayments, paymentLabel, totalsByYear, type Payment } from "@/lib/parent-billing";

const p = (id: string, date: string, amountCents: number, source: Payment["source"] = "paiement"): Payment => ({ id, date, amountCents, label: "x", child: null, source });

describe("factures de l'espace parent", () => {
  it("un versement déjà payé en ligne ne compte qu'une fois ; du plus récent au plus ancien", () => {
    const merged = mergePayments([p("pi_1", "2026-11-04", 11000)], [p("pi_1", "2026-11-04", 11000, "versement"), p("pi_2", "2026-12-01", 11000, "versement")]);
    expect(merged.map((x) => x.id)).toEqual(["pi_2", "pi_1"]);
  });

  it("totaux par année civile", () => {
    expect(totalsByYear([p("a", "2026-11-04", 11000), p("b", "2026-12-01", 11000), p("c", "2027-01-01", 10798)])).toEqual([
      { year: "2027", cents: 10798 },
      { year: "2026", cents: 22000 }
    ]);
  });

  it("libellés selon le type de paiement", () => {
    expect(paymentLabel("season-completion", "Alexia")).toBe("2e partie de la saison : Alexia");
    expect(paymentLabel("inconnu")).toBe("Paiement");
  });
});
