/** Logique pure de la location de terrains (créneaux, jours, prix) —
 *  testable sans base de données ni réseau. */

export interface RentalWindow {
  id: string;
  terrain_id: string;
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  price_cents: number;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
}

export interface RentalSlot {
  windowId: string;
  start: string;
  end: string;
  startMinute: number;
  endMinute: number;
  priceCents: number;
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Jour de semaine (0 = dimanche) d'une date AAAA-MM-JJ, sans dérive de fuseau. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function windowAppliesToDate(w: RentalWindow, date: string): boolean {
  if (!w.active) return false;
  if (w.valid_from && date < w.valid_from) return false;
  if (w.valid_until && date > w.valid_until) return false;
  if (w.specific_date) return w.specific_date === date;
  return w.weekday === weekdayOf(date);
}

/** Découpe une plage en créneaux consécutifs de `slot_minutes` (le reste trop court est ignoré). */
export function slotsForWindow(w: RentalWindow): RentalSlot[] {
  const start = timeToMinutes(w.start_time);
  const end = timeToMinutes(w.end_time);
  const out: RentalSlot[] = [];
  for (let s = start; s + w.slot_minutes <= end; s += w.slot_minutes) {
    out.push({
      windowId: w.id,
      start: minutesToTime(s),
      end: minutesToTime(s + w.slot_minutes),
      startMinute: s,
      endMinute: s + w.slot_minutes,
      priceCents: w.price_cents
    });
  }
  return out;
}

export function slotsForDate(windows: RentalWindow[], date: string): RentalSlot[] {
  return windows
    .filter((w) => windowAppliesToDate(w, date))
    .flatMap(slotsForWindow)
    .sort((a, b) => a.startMinute - b.startMinute);
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface BusyRange {
  startMinute: number;
  endMinute: number;
}

export function isSlotFree(slot: RentalSlot, busy: BusyRange[]): boolean {
  return !busy.some((b) => overlaps(slot.startMinute, slot.endMinute, b.startMinute, b.endMinute));
}
