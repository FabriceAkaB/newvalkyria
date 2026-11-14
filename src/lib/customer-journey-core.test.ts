import { describe, expect, it } from "vitest";

import { buildTree, countByStatus, JOURNEY_SEED, type JourneyNode } from "@/lib/customer-journey-core";

const n = (id: string, parent: string | null, order: number, kind: JourneyNode["kind"] = "famille", status: JourneyNode["status"] = "en-place"): JourneyNode => ({ id, parent_id: parent, sort_order: order, kind, title: id, detail: null, status, where_ref: null });

describe("Parcours client", () => {
  it("construit l'arbre dans l'ordre", () => {
    const t = buildTree([n("b", null, 20, "etape"), n("a", null, 10, "etape"), n("a2", "a", 20), n("a1", "a", 10), n("orphelin", "x", 5)]);
    expect(t.map((x) => x.id)).toEqual(["orphelin", "a", "b"]);
    expect(t[1].children.map((x) => x.id)).toEqual(["a1", "a2"]);
  });
  it("compte les éléments par statut, sans les étapes ni les choix", () => {
    expect(countByStatus([n("e", null, 0, "etape"), n("x", "e", 0, "droit", "prevu"), n("y", "e", 1, "auto"), n("c", "e", 2, "choix")])).toEqual({ "en-place": 1, "en-cours": 0, prevu: 1 });
  });
  it("le gabarit couvre la découverte, l'essai, l'inscription et chaque programme", () => {
    expect(JOURNEY_SEED.map((s) => s.title.slice(0, 2))).toEqual(["1.", "2.", "3.", "4.", "5.", "6."]);
    const choix = JOURNEY_SEED[2].children!.find((c) => c.title === "Choix du programme")!;
    expect(choix.children!.length).toBe(5);
    expect(choix.children!.every((p) => (p.children ?? []).length > 0)).toBe(true);
  });
});
