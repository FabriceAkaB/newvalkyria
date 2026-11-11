import { describe, expect, it } from "vitest";

import { inventoryTodayItems, lotCost, planInventory, replacementOf, type InventoryItem } from "@/lib/inventory-repo";

const TODAY = "2026-11-02";

function item(p: Partial<InventoryItem>): InventoryItem {
  return {
    id: "i1",
    name: "Ballons taille 4",
    category: "ballons",
    quantity: 20,
    location: "Chambéry",
    assigned_to: null,
    condition: "bon",
    condition_at: "2026-09-01T12:00:00Z",
    purchased_on: null,
    unit_cost_cents: 2500,
    lifespan_months: null,
    notes: null,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
    ...p
  };
}

describe("replacementOf", () => {
  it("date d'achat + durée de vie de la catégorie (ballons : 12 mois)", () => {
    const r = replacementOf(item({ purchased_on: "2026-03-15" }), TODAY);
    expect(r).toMatchObject({ date: "2027-03-15", year: 2027, estimated: false, due: false });
  });

  it("une durée de vie propre à l'article l'emporte sur celle de la catégorie", () => {
    expect(replacementOf(item({ purchased_on: "2026-03-15", lifespan_months: 6 }), TODAY)).toMatchObject({ date: "2026-09-15", year: 2026, due: true });
  });

  it("une date dépassée tombe dans l'année en cours et le dit", () => {
    const r = replacementOf(item({ category: "dossards", purchased_on: "2023-05-01" }), TODAY);
    expect(r).toMatchObject({ date: "2025-05-01", year: 2026, due: true });
    expect(r.reason).toBe("Durée de vie atteinte en mai 2025");
  });

  it("« à remplacer » : tout de suite", () => {
    expect(replacementOf(item({ condition: "a_remplacer", purchased_on: "2026-08-01" }), TODAY)).toMatchObject({ year: 2026, due: true });
  });

  it("« usé » : au plus tard 12 mois après qu'on l'a noté", () => {
    const r = replacementOf(item({ category: "mini-buts", condition: "use", purchased_on: "2026-01-10", condition_at: "2026-10-01T15:00:00Z" }), TODAY);
    expect(r).toMatchObject({ date: "2027-10-01", year: 2027, due: false });
    expect(r.reason).toContain("Noté usé");
  });

  it("sans date d'achat : estimée selon l'état noté à l'ajout", () => {
    expect(replacementOf(item({ category: "cones", condition: "neuf" }), TODAY)).toMatchObject({ date: "2029-09-01", estimated: true });
    expect(replacementOf(item({ category: "cones", condition: "bon" }), TODAY)).toMatchObject({ date: "2028-03-01", estimated: true });
  });

  it("sans date d'achat : un lot remis à « neuf » repart du jour où l'état a changé, pas du jour de l'ajout", () => {
    const r = replacementOf(item({ category: "ballons", condition: "neuf", created_at: "2024-01-10T12:00:00Z", condition_at: "2026-10-20T14:00:00Z" }), TODAY);
    expect(r).toMatchObject({ date: "2027-10-20", year: 2027, due: false, estimated: true });
  });

  it("le jour noté est celui de Montréal (un changement noté à 21 h le 31 oct. compte pour le 31)", () => {
    const r = replacementOf(item({ condition: "a_remplacer", condition_at: "2026-11-01T01:00:00Z" }), TODAY);
    expect(r.date).toBe("2026-10-31");
  });
});

describe("planInventory", () => {
  it("calcule le fonds de remplacement sur 3 ans et la liste « cette année »", () => {
    const o = planInventory(
      [
        item({ id: "a", name: "Ballons usés", condition: "a_remplacer", quantity: 8, unit_cost_cents: 2500 }),
        item({ id: "b", name: "Dossards", category: "dossards", purchased_on: "2024-12-01", quantity: 30, unit_cost_cents: 400 }),
        item({ id: "c", name: "Cônes", category: "cones", purchased_on: "2025-06-01", quantity: 50, unit_cost_cents: null }),
        item({ id: "d", name: "Ballons neufs", purchased_on: "2026-10-01", quantity: 20, unit_cost_cents: 3000, location: "Terrebonne", assigned_to: "Will" }),
        item({ id: "e", name: "Vide", condition: "a_remplacer", quantity: 0 })
      ],
      TODAY
    );
    expect(o.thisYear.items.map((p) => p.item.id)).toEqual(["a", "b"]);
    expect(o.thisYear.costCents).toBe(8 * 2500 + 30 * 400);
    expect(o.dueNow.map((p) => p.item.id)).toEqual(["a"]);
    expect(o.fund[1]).toMatchObject({ year: 2027, costCents: 20 * 3000, unknownCost: 0 });
    expect(o.fund[2]).toMatchObject({ year: 2028, costCents: 0, unknownCost: 1 });
    expect(o.units).toBe(108);
    expect(o.valueCents).toBe(8 * 2500 + 30 * 400 + 20 * 3000);
    expect(o.locations).toEqual(["Chambéry", "Terrebonne"]);
    expect(o.assignees).toEqual(["Will"]);
    expect(lotCost(item({ quantity: 3, unit_cost_cents: null }))).toBeNull();

    const [line] = inventoryTodayItems(o.dueNow);
    expect(line).toMatchObject({ title: "Remplacer 8 × Ballons usés", meta: "200 $", href: "/admin/inventaire#i-a" });
  });
});
