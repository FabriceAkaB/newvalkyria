import { describe, expect, it } from "vitest";
import { reconcile, type StripeCharge } from "@/lib/stripe-reconcile";

const c = (id: string, pi: string | null, amount: number, refunded = 0): StripeCharge => ({ id, paymentIntent: pi, amountCents: amount, refundedCents: refunded, created: `2026-11-${id.padStart(2, "0")}`, email: null, description: null });

describe("rapprochement Stripe", () => {
  const site = new Map([
    ["pi_a", { table: "registrations", status: "paid", label: "Inscription A" }],
    ["pi_b", { table: "registrations", status: "cancelled", label: "Inscription B" }],
    ["pi_c", { table: "shop_orders", status: "paid", label: "Commande C" }]
  ]);
  it("trouve les paiements absents du site", () => {
    const r = reconcile([c("1", "pi_a", 100), c("2", "pi_x", 500), c("3", null, 50)], site);
    expect(r.matched).toBe(1);
    expect(r.missing.map((m) => m.id)).toEqual(["3", "2"]);
    expect(r.totalCents).toBe(650);
  });
  it("trouve les remboursements pas notés dans le site", () => {
    const r = reconcile([c("1", "pi_a", 100, 100), c("2", "pi_b", 200, 200), c("3", "pi_c", 300, 50)], site);
    expect(r.refundNotRecorded.map((m) => m.site.label)).toEqual(["Inscription A", "Commande C"]);
    expect(r.refundedCents).toBe(350);
  });
});
