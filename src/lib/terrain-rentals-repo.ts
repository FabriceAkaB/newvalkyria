import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isSlotFree,
  minutesToTime,
  slotsForDate,
  timeToMinutes,
  type BusyRange,
  type RentalSlot,
  type RentalWindow
} from "@/lib/terrain-rentals-core";

function db() {
  return getSupabaseAdminClient() as any;
}

export const RENTAL_RESERVATION_MINUTES = 30;

export interface RentableTerrain {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  rentable: boolean;
  rental_description: string | null;
}

export interface TerrainRental {
  id: string;
  terrain_id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  start_minute: number;
  end_minute: number;
  price_cents: number;
  status: "pending" | "paid" | "cancelled";
  organization_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  reservation_expires_at: string | null;
  confirmation_sent_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot extends RentalSlot {
  available: boolean;
}

/** Date et minute courantes à Montréal — jamais de réservation dans le passé. */
export function nowInToronto(): { date: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minute: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10) };
}

export async function getRentableTerrains(): Promise<RentableTerrain[]> {
  const { data, error } = await db().from("terrains").select("*").eq("active", true).eq("rentable", true).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as RentableTerrain[];
}

export async function getAllTerrainsForRental(): Promise<RentableTerrain[]> {
  const { data, error } = await db().from("terrains").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as RentableTerrain[];
}

export async function getWindows(terrainId?: string): Promise<RentalWindow[]> {
  let q = db().from("terrain_rental_windows").select("*").order("created_at");
  if (terrainId) q = q.eq("terrain_id", terrainId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as RentalWindow[];
}

export interface RentalBlock {
  id: string;
  terrain_id: string;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export async function getBlocks(terrainId?: string): Promise<RentalBlock[]> {
  let q = db().from("terrain_rental_blocks").select("*").order("block_date");
  if (terrainId) q = q.eq("terrain_id", terrainId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as RentalBlock[];
}

/** Réservations qui occupent un créneau : payées, ou en cours de paiement avec une réservation valide. */
async function getActiveRentals(terrainId: string, from: string, to: string): Promise<TerrainRental[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("terrain_rentals")
    .select("*")
    .eq("terrain_id", terrainId)
    .gte("rental_date", from)
    .lte("rental_date", to)
    .or(`status.eq.paid,and(status.eq.pending,reservation_expires_at.gt.${nowIso})`);
  if (error) throw new Error(error.message);
  return (data ?? []) as TerrainRental[];
}

/** Créneaux d'un terrain sur une période, avec leur disponibilité réelle :
 *  plages configurées − dates bloquées − réservations − activités internes. */
export async function getAvailability(terrainId: string, from: string, to: string): Promise<Record<string, AvailabilitySlot[]>> {
  const supabase = db();
  const [windows, blocks, rentals, activities] = await Promise.all([
    getWindows(terrainId),
    getBlocks(terrainId),
    getActiveRentals(terrainId, from, to),
    supabase.from("coach_activities").select("activity_date, start_time, end_time").eq("terrain_id", terrainId).gte("activity_date", from).lte("activity_date", to)
  ]);

  const now = nowInToronto();
  const out: Record<string, AvailabilitySlot[]> = {};
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);

  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (date < now.date) continue;
    const slots = slotsForDate(windows, date);
    if (slots.length === 0) continue;

    const busy: BusyRange[] = [];
    for (const b of blocks.filter((x) => x.block_date === date)) {
      busy.push(b.start_time && b.end_time ? { startMinute: timeToMinutes(b.start_time), endMinute: timeToMinutes(b.end_time) } : { startMinute: 0, endMinute: 24 * 60 });
    }
    for (const r of rentals.filter((x) => x.rental_date === date)) busy.push({ startMinute: r.start_minute, endMinute: r.end_minute });
    for (const a of (activities.data ?? []).filter((x: any) => x.activity_date === date)) {
      if (a.start_time && a.end_time) busy.push({ startMinute: timeToMinutes(a.start_time), endMinute: timeToMinutes(a.end_time) });
    }

    out[date] = slots.map((s) => ({
      ...s,
      available: isSlotFree(s, busy) && !(date === now.date && s.startMinute <= now.minute + 60)
    }));
  }
  return out;
}

export interface CreateRentalInput {
  terrainId: string;
  date: string;
  start: string;
  end: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string | null;
}

export class RentalConflictError extends Error {}

/** Valide le créneau contre la configuration réelle puis le réserve. La
 *  contrainte d'exclusion en base garantit qu'aucune double réservation
 *  n'est possible même si deux organisations cliquent en même temps. */
export async function createRental(input: CreateRentalInput): Promise<TerrainRental> {
  const availability = await getAvailability(input.terrainId, input.date, input.date);
  const slot = (availability[input.date] ?? []).find((s) => s.start === input.start && s.end === input.end);
  if (!slot) throw new RentalConflictError("Ce créneau n'existe pas ou n'est plus offert.");
  if (!slot.available) throw new RentalConflictError("Ce créneau n'est plus disponible.");

  const { data, error } = await db()
    .from("terrain_rentals")
    .insert({
      terrain_id: input.terrainId,
      rental_date: input.date,
      start_time: slot.start,
      end_time: slot.end,
      start_minute: slot.startMinute,
      end_minute: slot.endMinute,
      price_cents: slot.priceCents,
      status: "pending",
      organization_name: input.organizationName,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      notes: input.notes,
      reservation_expires_at: new Date(Date.now() + RENTAL_RESERVATION_MINUTES * 60_000).toISOString()
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23P01" || error.code === "23505") throw new RentalConflictError("Ce créneau vient d'être réservé par quelqu'un d'autre.");
    throw new Error(error.message);
  }
  return data as TerrainRental;
}

export async function setRentalCheckoutSession(id: string, sessionId: string): Promise<void> {
  const { error } = await db().from("terrain_rentals").update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markRentalPaid(sessionId: string, paymentIntentId: string | undefined): Promise<TerrainRental | null> {
  const { data, error } = await db()
    .from("terrain_rentals")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId ?? null, reservation_expires_at: null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", sessionId)
    .neq("status", "cancelled")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TerrainRental | null;
}

export async function cancelRental(id: string, reason: string): Promise<void> {
  const { error } = await db()
    .from("terrain_rentals")
    .update({ status: "cancelled", cancelled_reason: reason, reservation_expires_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function releaseRentalBySession(sessionId: string): Promise<void> {
  const { error } = await db()
    .from("terrain_rentals")
    .update({ status: "cancelled", cancelled_reason: "Paiement non complété (session expirée)", reservation_expires_at: null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function getRentalById(id: string): Promise<TerrainRental | null> {
  const { data, error } = await db().from("terrain_rentals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as TerrainRental | null;
}

export async function getRentals(): Promise<(TerrainRental & { terrain_name: string })[]> {
  const { data, error } = await db().from("terrain_rentals").select("*, terrain:terrains(name)").order("rental_date", { ascending: false }).order("start_minute");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ ...r, terrain_name: r.terrain?.name ?? "—" }));
}

export { minutesToTime };
