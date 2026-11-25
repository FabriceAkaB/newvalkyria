import { describe, expect, it } from "vitest";

import { allInStock, checkPickupChoice, ordersForActivity, pickupOptions, pickupSummary, pickupWindow, type PickupPracticeInput } from "@/lib/shop-pickup-core";

const p = (over: Partial<PickupPracticeInput>): PickupPracticeInput => ({
  key: "k",
  date: "2026-11-25",
  start: "18:00",
  end: "19:25",
  group: "Filles 2016",
  location: "Gymnase A",
  source: "saison",
  organization: null,
  activityId: null,
  activityType: "Pratique",
  ...over
});

describe("remise boutique à la séance choisie", () => {
  it("propose cette semaine et la suivante (jusqu'au dimanche)", () => {
    expect(pickupWindow("2026-11-25")).toEqual({ from: "2026-11-25", to: "2026-12-06" }); // mercredi → dimanche suivant
    expect(pickupWindow("2026-11-29")).toEqual({ from: "2026-11-29", to: "2026-12-06" }); // dimanche → dimanche suivant
    expect(pickupWindow("2026-11-30")).toEqual({ from: "2026-11-30", to: "2026-12-13" }); // lundi
  });

  it("en stock seulement si chaque article a assez de stock", () => {
    expect(allInStock([{ quantity: 1, available: 3 }, { quantity: 2, available: 2 }])).toBe(true);
    expect(allInStock([{ quantity: 1, available: 3 }, { quantity: 2, available: 1 }])).toBe(false);
    expect(allInStock([])).toBe(false);
  });

  it("garde les pratiques de l'académie, une heure d'avance, sans matchs ni pratiques hors Académie", () => {
    const now = { date: "2026-11-25", time: "17:30" };
    const opts = pickupOptions(
      [
        p({ key: "trop-tot", start: "18:00" }),
        p({ key: "ok-soir", start: "19:30", group: "Filles 2014" }),
        p({ key: "jumeau", start: "19:30", group: "Filles 2015" }),
        p({ key: "match", date: "2026-11-28", activityType: "Match" }),
        p({ key: "jp", date: "2026-11-28", organization: "FC Atlantic" }),
        p({ key: "trop-loin", date: "2026-12-07" }),
        p({ key: "programme", date: "2026-11-28", start: "10:00", source: "programme", group: "Camp", activityId: "a1" }),
        p({ key: "solo", date: "2026-11-28", start: "13:40", source: "activite", group: "Pratique solo (45 min) – Niko" }),
        p({ key: "equipe", date: "2026-11-29", start: "16:30", source: "activite", group: "Équipe 2016-2017 AV et INT" })
      ],
      now
    );
    expect(opts.map((o) => o.key)).toEqual(["ok-soir", "programme", "equipe"]);
    expect(opts[0].group).toBe("Filles 2014 et Filles 2015");
  });

  it("refuse une séance hors liste ou une commande déjà remise", () => {
    const options = pickupOptions([p({ key: "x", date: "2026-11-27" })], { date: "2026-11-25", time: "10:00" });
    const order = { status: "paid", distribution_status: "pret_a_remettre", in_stock: true };
    expect(checkPickupChoice(order, options, "x").ok).toBe(true);
    expect(checkPickupChoice(order, options, "y").ok).toBe(false);
    expect(checkPickupChoice({ ...order, distribution_status: "remis" }, options, "x").ok).toBe(false);
    expect(checkPickupChoice({ ...order, in_stock: false }, options, "x").ok).toBe(false);
  });

  it("résume la séance et la mention cadeau pour JP", () => {
    expect(pickupSummary({ pickup_date: "2026-11-30", pickup_start: "18:00", pickup_location: "Gymnase A", pickup_group: "Filles 2016", is_gift: true })).toBe(
      "lundi 30 novembre, 18 h · Filles 2016 · Gymnase A · cadeau (remise discrète au parent)"
    );
    expect(pickupSummary({ pickup_date: null, pickup_start: null, pickup_location: null, pickup_group: null, is_gift: false })).toBeNull();
  });

  it("retrouve les colis d'une activité par son id, sinon par la date et l'heure", () => {
    const orders = [
      { id: "1", pickup_activity_id: "act", pickup_date: "2026-11-30", pickup_start: "18:00" },
      { id: "2", pickup_activity_id: null, pickup_date: "2026-11-30", pickup_start: "18:10" },
      { id: "3", pickup_activity_id: null, pickup_date: "2026-11-30", pickup_start: "19:30" },
      { id: "4", pickup_activity_id: "autre", pickup_date: "2026-11-30", pickup_start: "18:00" }
    ];
    expect(ordersForActivity(orders, { id: "act", activity_date: "2026-11-30", start_time: "18:00:00" }).map((o) => o.id)).toEqual(["1", "2"]);
  });
});
