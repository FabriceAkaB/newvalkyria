// @vitest-environment node
import { describe, expect, it } from "vitest";

import { checkSlotPass, matchLinks, slotLinks, slotPass } from "@/lib/match-links";

const A = "75ed2118-0000-4000-8000-000000000001";
const B = "75ed2118-0000-4000-8000-000000000002";

describe("liens de match", () => {
  it("la clé du lien de paiement ne vaut que pour sa plage", () => {
    expect(checkSlotPass(A, slotPass(A))).toBe(true);
    expect(checkSlotPass(B, slotPass(A))).toBe(false);
    expect(checkSlotPass(A, "x")).toBe(false);
    expect(checkSlotPass("pas-un-id", slotPass(A))).toBe(false);
    expect(checkSlotPass(A, null)).toBe(false);
  });

  it("donne le lien de paiement, des arbitres, et de l'adversaire seulement si la plage est réservée", () => {
    const l = matchLinks(A);
    expect(l.pay).toContain(`/prive/matchs?plage=${A}&cle=`);
    expect(l.referee).toContain(`/arbitres/match/${A}`);
    expect(l.opponent).toBeNull();
  });

  it("le lien adversaire couvre les 2 matchs de sa double cédule", () => {
    const slots = [{ id: A, double_group: "g" }, { id: B, double_group: "g" }];
    const bookings = [
      { id: "b1", slot_id: A, org_key: "laval", status: "paid", slot: { double_group: "g" } },
      { id: "b2", slot_id: B, org_key: "laval", status: "paid", slot: { double_group: "g" } },
      { id: "b3", slot_id: B, org_key: "autre", status: "cancelled", slot: { double_group: "g" } }
    ];
    expect(slotLinks(slots, bookings)[A].opponent).toContain("ids=b1,b2");
  });
});
