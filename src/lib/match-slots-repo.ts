import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/** Nombre maximal de plages qu'une même équipe peut réserver (règle automatique). */
export const MAX_SLOTS_PER_TEAM = 2;
export const MATCH_RESERVATION_MINUTES = 30;

export interface MatchSlot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  location: string;
  field_label: string | null;
  price_cents: number;
  active: boolean;
  notes: string | null;
}

export interface MatchBooking {
  id: string;
  slot_id: string;
  org_name: string;
  org_key: string;
  team_label: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string | null;
  status: "pending" | "paid" | "cancelled";
  price_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  reservation_expires_at: string | null;
  confirmation_sent_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
}

export function orgKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(academie|academy|club|soccer|football|fc|de|du|des|la|le|les|u\d+)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/** Libère les réservations dont le délai de paiement est dépassé. */
async function expireStale(): Promise<void> {
  await db()
    .from("match_slot_bookings")
    .update({ status: "cancelled", cancelled_reason: "Paiement non complété (délai dépassé)", reservation_expires_at: null, updated_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("reservation_expires_at", new Date().toISOString());
}

export async function getSlotsWithAvailability(options: { includeInactive?: boolean; includePast?: boolean } = {}): Promise<(MatchSlot & { available: boolean })[]> {
  await expireStale();
  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from("match_slots").select("*").order("slot_date").order("start_time");
  if (!options.includeInactive) q = q.eq("active", true);
  if (!options.includePast) q = q.gte("slot_date", today);
  const { data: slots, error } = await q;
  if (error) throw new Error(error.message);
  const { data: taken } = await supabase.from("match_slot_bookings").select("slot_id").in("status", ["pending", "paid"]);
  const takenSet = new Set((taken ?? []).map((t: any) => t.slot_id));
  return ((slots ?? []) as MatchSlot[]).map((s) => ({ ...s, available: !takenSet.has(s.id) }));
}

/** Plages déjà actives (payées ou en cours de paiement) pour une équipe : même nom
 *  d'organisation OU même courriel de contact — impossible de contourner la règle. */
export async function countActiveForTeam(key: string, email: string): Promise<number> {
  await expireStale();
  const { data, error } = await db()
    .from("match_slot_bookings")
    .select("id, org_key, contact_email")
    .in("status", ["pending", "paid"])
    .or(`org_key.eq.${key},contact_email.ilike.${email.trim()}`);
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export class MatchConflictError extends Error {}

export interface ReserveInput {
  slotIds: string[];
  orgName: string;
  teamLabel: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string | null;
}

/** Réserve 1 ou 2 plages d'un coup. Toutes les règles sont vérifiées côté serveur :
 *  plage existante/active/libre, 2 plages maximum par équipe, jamais de doublon. */
export async function reserveSlots(input: ReserveInput): Promise<{ bookings: MatchBooking[]; slots: MatchSlot[]; totalCents: number }> {
  const slotIds = Array.from(new Set(input.slotIds));
  if (slotIds.length === 0) throw new MatchConflictError("Choisissez au moins une plage.");
  if (slotIds.length > MAX_SLOTS_PER_TEAM) throw new MatchConflictError(`Une équipe ne peut réserver que ${MAX_SLOTS_PER_TEAM} plages.`);

  const key = orgKey(input.orgName);
  if (!key) throw new MatchConflictError("Nom d'organisation invalide.");
  const already = await countActiveForTeam(key, input.contactEmail);
  if (already + slotIds.length > MAX_SLOTS_PER_TEAM) {
    throw new MatchConflictError(
      already === 0
        ? `Une équipe ne peut réserver que ${MAX_SLOTS_PER_TEAM} plages.`
        : `Votre équipe a déjà ${already} plage${already > 1 ? "s" : ""} réservée${already > 1 ? "s" : ""} : la limite est de ${MAX_SLOTS_PER_TEAM} par équipe.`
    );
  }

  const { data: slots, error } = await db().from("match_slots").select("*").in("id", slotIds);
  if (error) throw new Error(error.message);
  const today = new Date().toISOString().slice(0, 10);
  if ((slots ?? []).length !== slotIds.length) throw new MatchConflictError("Une des plages n'existe plus.");
  for (const s of slots as MatchSlot[]) {
    if (!s.active || s.slot_date < today) throw new MatchConflictError("Une des plages n'est plus offerte.");
  }

  const created: MatchBooking[] = [];
  const expires = new Date(Date.now() + MATCH_RESERVATION_MINUTES * 60_000).toISOString();
  for (const s of slots as MatchSlot[]) {
    const { data, error: insErr } = await db()
      .from("match_slot_bookings")
      .insert({
        slot_id: s.id,
        org_name: input.orgName,
        org_key: key,
        team_label: input.teamLabel,
        contact_name: input.contactName,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        notes: input.notes,
        status: "pending",
        price_cents: s.price_cents,
        reservation_expires_at: expires
      })
      .select("*")
      .single();
    if (insErr) {
      // Conflit : quelqu'un vient de prendre la plage — on libère celles déjà prises dans ce lot.
      if (created.length) await db().from("match_slot_bookings").update({ status: "cancelled", cancelled_reason: "Lot annulé (conflit)" }).in("id", created.map((b) => b.id));
      if (insErr.code === "23505") throw new MatchConflictError("Une des plages vient d'être réservée par une autre équipe.");
      throw new Error(insErr.message);
    }
    created.push(data as MatchBooking);
  }

  // Course entre deux demandes de la même équipe : on revérifie après insertion.
  const after = await countActiveForTeam(key, input.contactEmail);
  if (after > MAX_SLOTS_PER_TEAM) {
    await db().from("match_slot_bookings").update({ status: "cancelled", cancelled_reason: "Limite de plages par équipe dépassée" }).in("id", created.map((b) => b.id));
    throw new MatchConflictError(`Une équipe ne peut réserver que ${MAX_SLOTS_PER_TEAM} plages.`);
  }

  return { bookings: created, slots: slots as MatchSlot[], totalCents: created.reduce((s, b) => s + b.price_cents, 0) };
}

export async function setBookingsCheckoutSession(ids: string[], sessionId: string): Promise<void> {
  const { error } = await db().from("match_slot_bookings").update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() }).in("id", ids);
  if (error) throw new Error(error.message);
}

export async function cancelBookings(ids: string[], reason: string): Promise<void> {
  await db()
    .from("match_slot_bookings")
    .update({ status: "cancelled", cancelled_reason: reason, reservation_expires_at: null, updated_at: new Date().toISOString() })
    .in("id", ids);
}

export async function markBookingsPaid(sessionId: string, paymentIntentId: string | undefined): Promise<(MatchBooking & { slot: MatchSlot })[]> {
  const { data, error } = await db()
    .from("match_slot_bookings")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId ?? null, reservation_expires_at: null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", sessionId)
    .neq("status", "cancelled")
    .select("*, slot:match_slots(*)");
  if (error) throw new Error(error.message);
  return (data ?? []) as (MatchBooking & { slot: MatchSlot })[];
}

export async function releaseBySession(sessionId: string): Promise<void> {
  await db()
    .from("match_slot_bookings")
    .update({ status: "cancelled", cancelled_reason: "Paiement non complété (session expirée)", reservation_expires_at: null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("status", "pending");
}

export async function getAllBookings(): Promise<(MatchBooking & { slot: MatchSlot })[]> {
  const { data, error } = await db().from("match_slot_bookings").select("*, slot:match_slots(*)").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as (MatchBooking & { slot: MatchSlot })[];
}

export async function getBookingsByIds(ids: string[]): Promise<(MatchBooking & { slot: MatchSlot })[]> {
  const { data, error } = await db().from("match_slot_bookings").select("*, slot:match_slots(*)").in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as (MatchBooking & { slot: MatchSlot })[];
}
