import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

const PUBLIC_DURATION_MIN = 60;
const ADMIN_DURATION_MIN = 90;

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type SlotStatus = "open" | "booked" | "closed";
export type BookingStatus = "reserved" | "cancelled" | "completed";

export interface PrivateSessionSlot {
  id: string;
  slot_date: string;
  public_start_time: string;
  public_end_time: string;
  admin_start_time: string;
  admin_end_time: string;
  location: string | null;
  terrain_id: string | null;
  status: SlotStatus;
  closed_reason: string | null;
  coach_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivateSessionBooking {
  id: string;
  slot_id: string;
  player_id: string | null;
  parent_user_id: string | null;
  child_id: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string | null;
  status: BookingStatus;
  payment_status: "none" | "paid" | "n/a";
  price_cents: number | null;
  notes: string | null;
  created_by_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlotConflict {
  slotId: string;
  adminStartTime: string;
  adminEndTime: string;
}

/** Chevauchement du bloc admin (1h30) contre les autres créneaux non fermés
 *  de la même date — même motif que findTerrainConflicts (terrains-repo.ts). */
async function findSlotConflicts(input: {
  slotDate: string;
  adminStartTime: string;
  adminEndTime: string;
  excludeSlotId?: string;
}): Promise<SlotConflict[]> {
  let query = db()
    .from("private_session_slots")
    .select("id, admin_start_time, admin_end_time")
    .eq("slot_date", input.slotDate)
    .neq("status", "closed")
    .lt("admin_start_time", input.adminEndTime)
    .gt("admin_end_time", input.adminStartTime);
  if (input.excludeSlotId) query = query.neq("id", input.excludeSlotId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ slotId: r.id, adminStartTime: r.admin_start_time, adminEndTime: r.admin_end_time }));
}

export async function getSlots(filters?: { from?: string; to?: string }): Promise<PrivateSessionSlot[]> {
  let query = db().from("private_session_slots").select("*").order("slot_date").order("public_start_time");
  if (filters?.from) query = query.gte("slot_date", filters.from);
  if (filters?.to) query = query.lte("slot_date", filters.to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PrivateSessionSlot[];
}

export async function getOpenSlots(filters?: { from?: string; to?: string }): Promise<PrivateSessionSlot[]> {
  let query = db().from("private_session_slots").select("*").eq("status", "open").order("slot_date").order("public_start_time");
  if (filters?.from) query = query.gte("slot_date", filters.from);
  if (filters?.to) query = query.lte("slot_date", filters.to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PrivateSessionSlot[];
}

export interface CreateSlotInput {
  slotDate: string;
  publicStartTime: string;
  location: string | null;
  terrainId: string | null;
  coachId: string | null;
  notes: string | null;
}

/** Calcule la fenêtre publique (1h) et le bloc admin (1h30) côté serveur —
 *  jamais fourni par le client, jamais recalculé à la lecture (voir plan §3). */
export async function createSlot(input: CreateSlotInput): Promise<{ id: string } | { error: "conflict"; conflicts: SlotConflict[] }> {
  const adminStartTime = input.publicStartTime;
  const publicEndTime = addMinutes(input.publicStartTime, PUBLIC_DURATION_MIN);
  const adminEndTime = addMinutes(input.publicStartTime, ADMIN_DURATION_MIN);

  const conflicts = await findSlotConflicts({ slotDate: input.slotDate, adminStartTime, adminEndTime });
  if (conflicts.length > 0) return { error: "conflict", conflicts };

  const { data, error } = await db()
    .from("private_session_slots")
    .insert({
      slot_date: input.slotDate,
      public_start_time: input.publicStartTime,
      public_end_time: publicEndTime,
      admin_start_time: adminStartTime,
      admin_end_time: adminEndTime,
      location: input.location,
      terrain_id: input.terrainId,
      coach_id: input.coachId,
      notes: input.notes
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string };
}

export async function updateSlot(
  id: string,
  patch: Partial<{ location: string | null; terrainId: string | null; coachId: string | null; notes: string | null }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.location !== undefined) columnPatch.location = patch.location;
  if (patch.terrainId !== undefined) columnPatch.terrain_id = patch.terrainId;
  if (patch.coachId !== undefined) columnPatch.coach_id = patch.coachId;
  if (patch.notes !== undefined) columnPatch.notes = patch.notes;
  const { error } = await db().from("private_session_slots").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function closeSlot(id: string, reason: string | null): Promise<void> {
  const { error } = await db()
    .from("private_session_slots")
    .update({ status: "closed", closed_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reopenSlot(id: string): Promise<void> {
  const { error } = await db()
    .from("private_session_slots")
    .update({ status: "open", closed_reason: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface BookingInput {
  playerId: string | null;
  parentUserId: string | null;
  childId: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
  notes: string | null;
  createdByAdmin: boolean;
}

/** Réclamation atomique du créneau : un seul UPDATE conditionnel
 *  (status='open' -> 'booked'), sûr sous concurrence car Postgres sérialise
 *  les UPDATE sur une même ligne — voir plan §3 pour le détail. */
export async function bookSlotAtomically(
  slotId: string,
  booking: BookingInput
): Promise<{ bookingId: string } | { error: "slot_taken" }> {
  const supabase = db();
  const { data: claimed, error: claimError } = await supabase
    .from("private_session_slots")
    .update({ status: "booked", updated_at: new Date().toISOString() })
    .eq("id", slotId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { error: "slot_taken" };

  const { data: bookingRow, error: insertErr } = await supabase
    .from("private_session_bookings")
    .insert({
      slot_id: slotId,
      player_id: booking.playerId,
      parent_user_id: booking.parentUserId,
      child_id: booking.childId,
      parent_name: booking.parentName,
      parent_email: booking.parentEmail,
      parent_phone: booking.parentPhone,
      notes: booking.notes,
      created_by_admin: booking.createdByAdmin
    })
    .select("id")
    .single();
  if (insertErr) {
    await supabase.from("private_session_slots").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", slotId);
    throw new Error(insertErr.message);
  }
  return { bookingId: bookingRow.id as string };
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = db();
  const { data: booking, error } = await supabase
    .from("private_session_bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .select("slot_id")
    .single();
  if (error) throw new Error(error.message);

  const { error: slotError } = await supabase
    .from("private_session_slots")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", booking.slot_id)
    .eq("status", "booked");
  if (slotError) throw new Error(slotError.message);
}

export async function moveBooking(bookingId: string, newSlotId: string): Promise<{ ok: true } | { error: "slot_taken" }> {
  const supabase = db();
  const { data: existing, error: fetchErr } = await supabase
    .from("private_session_bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const claim = await bookSlotAtomically(newSlotId, {
    playerId: existing.player_id,
    parentUserId: existing.parent_user_id,
    childId: existing.child_id,
    parentName: existing.parent_name,
    parentEmail: existing.parent_email,
    parentPhone: existing.parent_phone,
    notes: existing.notes,
    createdByAdmin: existing.created_by_admin
  });
  if ("error" in claim) return claim;

  await cancelBooking(bookingId);
  return { ok: true };
}

export interface BookingWithSlot extends PrivateSessionBooking {
  slot: PrivateSessionSlot;
}

export async function listBookings(filters?: { from?: string; to?: string }): Promise<BookingWithSlot[]> {
  const { data, error } = await db()
    .from("private_session_bookings")
    .select("*, slot:private_session_slots(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as BookingWithSlot[];
  if (filters?.from) rows = rows.filter((r) => r.slot.slot_date >= filters.from!);
  if (filters?.to) rows = rows.filter((r) => r.slot.slot_date <= filters.to!);
  return rows;
}

/** "Actuellement inscrit à l'Académie" au sens des séances privées :
 *  inscription Automne/Hiver+ confirmée ou payée, hors essai seul — voir
 *  plan §4 pour le raisonnement (ni leads Été, ni Sport-Études ne comptent). */
export async function isPlayerCurrentlyEnrolled(playerId: string): Promise<boolean> {
  const { count, error } = await db()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .in("status", ["confirmed", "paid"])
    .eq("is_trial", false);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
