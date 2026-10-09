import { describe, expect, it } from "vitest";

import { isSlotFree, slotsForDate, slotsForWindow, weekdayOf, type RentalWindow } from "@/lib/terrain-rentals-core";

const base: RentalWindow = {
  id: "w1",
  terrain_id: "t1",
  weekday: 6,
  specific_date: null,
  start_time: "09:00",
  end_time: "12:00",
  slot_minutes: 90,
  price_cents: 12000,
  valid_from: null,
  valid_until: null,
  active: true
};

describe("location de terrains — créneaux", () => {
  it("découpe 09:00–12:00 en deux créneaux de 90 minutes", () => {
    const slots = slotsForWindow(base);
    expect(slots.map((s) => `${s.start}-${s.end}`)).toEqual(["09:00-10:30", "10:30-12:00"]);
  });

  it("ignore un reste trop court", () => {
    const slots = slotsForWindow({ ...base, end_time: "11:30" });
    expect(slots).toHaveLength(1);
  });

  it("applique une plage récurrente le bon jour de semaine (samedi)", () => {
    expect(weekdayOf("2026-10-10")).toBe(6);
    expect(slotsForDate([base], "2026-10-10")).toHaveLength(2);
    expect(slotsForDate([base], "2026-10-11")).toHaveLength(0);
  });

  it("respecte la période de validité et le statut actif", () => {
    expect(slotsForDate([{ ...base, valid_until: "2026-10-01" }], "2026-10-10")).toHaveLength(0);
    expect(slotsForDate([{ ...base, active: false }], "2026-10-10")).toHaveLength(0);
  });

  it("une plage à date précise ne s'applique qu'à ce jour", () => {
    const w = { ...base, weekday: null, specific_date: "2026-10-17" };
    expect(slotsForDate([w], "2026-10-17")).toHaveLength(2);
    expect(slotsForDate([w], "2026-10-24")).toHaveLength(0);
  });

  it("détecte les chevauchements (double réservation)", () => {
    const [first, second] = slotsForWindow(base);
    expect(isSlotFree(first, [{ startMinute: 570, endMinute: 600 }])).toBe(false); // 09:30–10:00
    expect(isSlotFree(second, [{ startMinute: 540, endMinute: 630 }])).toBe(true); // finit à 10:30 pile
  });
});
