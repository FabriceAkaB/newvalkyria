import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export type CoachStatus = "active" | "inactive";
export type AssignmentStatus = "present" | "absent" | "replaced" | "cancelled";

export interface Coach {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  status: CoachStatus;
  role: string;
  default_hourly_rate_cents: number;
  hired_on: string | null;
  notes: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
}

/** Colonnes sûres à renvoyer côté client — ne JAMAIS inclure password_hash
 *  ici (finirait dans les props envoyées au navigateur). */
const COACH_SAFE_COLUMNS =
  "id, first_name, last_name, phone, email, status, role, default_hourly_rate_cents, hired_on, notes, username, created_at, updated_at";

export interface CoachTypeRate {
  id: string;
  coach_id: string;
  activity_type: string;
  hourly_rate_cents: number;
}

export interface CoachActivity {
  id: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  category: string | null;
  activity_type: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachAssignment {
  id: string;
  activity_id: string;
  coach_id: string;
  status: AssignmentStatus;
  arrival_time: string | null;
  departure_time: string | null;
  hourly_rate_cents: number | null;
  confirmed: boolean;
  paid: boolean;
  paid_on: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const ACTIVITY_TYPES = ["Pratique", "Match", "Tournoi", "Camp", "Évaluation", "Activité privée", "Réunion", "Autre"] as const;
export const COACH_ROLES = ["Entraîneur principal", "Assistant", "Gardien", "Autre"] as const;

/* ── Coaches ───────────────────────────────────────────────────── */

export async function getCoaches(): Promise<Coach[]> {
  const { data, error } = await db().from("coaches").select(COACH_SAFE_COLUMNS).order("first_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Coach[];
}

export async function getCoach(id: string): Promise<Coach | null> {
  const { data, error } = await db().from("coaches").select(COACH_SAFE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Coach | null;
}

export interface CreateCoachInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  role: string;
  defaultHourlyRateCents: number;
  hiredOn: string | null;
  notes: string | null;
}

export async function createCoach(input: CreateCoachInput): Promise<string> {
  const { data, error } = await db()
    .from("coaches")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      email: input.email,
      role: input.role,
      default_hourly_rate_cents: input.defaultHourlyRateCents,
      hired_on: input.hiredOn,
      notes: input.notes
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateCoach(
  id: string,
  patch: Partial<{
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    status: CoachStatus;
    role: string;
    defaultHourlyRateCents: number;
    hiredOn: string | null;
    notes: string | null;
  }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.firstName !== undefined) columnPatch.first_name = patch.firstName;
  if (patch.lastName !== undefined) columnPatch.last_name = patch.lastName;
  if (patch.phone !== undefined) columnPatch.phone = patch.phone;
  if (patch.email !== undefined) columnPatch.email = patch.email;
  if (patch.status !== undefined) columnPatch.status = patch.status;
  if (patch.role !== undefined) columnPatch.role = patch.role;
  if (patch.defaultHourlyRateCents !== undefined) columnPatch.default_hourly_rate_cents = patch.defaultHourlyRateCents;
  if (patch.hiredOn !== undefined) columnPatch.hired_on = patch.hiredOn;
  if (patch.notes !== undefined) columnPatch.notes = patch.notes;

  const { error } = await db().from("coaches").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCoach(id: string): Promise<void> {
  const { error } = await db().from("coaches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Taux par type d'activité ─────────────────────────────────── */

export async function getCoachTypeRates(coachId: string): Promise<CoachTypeRate[]> {
  const { data, error } = await db().from("coach_type_rates").select("*").eq("coach_id", coachId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachTypeRate[];
}

export async function setCoachTypeRate(coachId: string, activityType: string, hourlyRateCents: number): Promise<void> {
  const { error } = await db()
    .from("coach_type_rates")
    .upsert({ coach_id: coachId, activity_type: activityType, hourly_rate_cents: hourlyRateCents }, { onConflict: "coach_id,activity_type" });
  if (error) throw new Error(error.message);
}

export async function deleteCoachTypeRate(id: string): Promise<void> {
  const { error } = await db().from("coach_type_rates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getAllCoachTypeRates(): Promise<CoachTypeRate[]> {
  const { data, error } = await db().from("coach_type_rates").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachTypeRate[];
}

/* ── Activités ────────────────────────────────────────────────── */

export async function getActivities(filters?: { from?: string; to?: string }): Promise<CoachActivity[]> {
  let query = db().from("coach_activities").select("*").order("activity_date", { ascending: false }).order("start_time", { ascending: false });
  if (filters?.from) query = query.gte("activity_date", filters.from);
  if (filters?.to) query = query.lte("activity_date", filters.to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachActivity[];
}

export async function getActivity(id: string): Promise<CoachActivity | null> {
  const { data, error } = await db().from("coach_activities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CoachActivity | null;
}

export interface CreateActivityInput {
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
  category: string | null;
  activityType: string;
  title: string | null;
  notes: string | null;
}

export async function createActivity(input: CreateActivityInput): Promise<string> {
  const { data, error } = await db()
    .from("coach_activities")
    .insert({
      activity_date: input.activityDate,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      category: input.category,
      activity_type: input.activityType,
      title: input.title,
      notes: input.notes
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateActivity(id: string, patch: Partial<CreateActivityInput>): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.activityDate !== undefined) columnPatch.activity_date = patch.activityDate;
  if (patch.startTime !== undefined) columnPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) columnPatch.end_time = patch.endTime;
  if (patch.location !== undefined) columnPatch.location = patch.location;
  if (patch.category !== undefined) columnPatch.category = patch.category;
  if (patch.activityType !== undefined) columnPatch.activity_type = patch.activityType;
  if (patch.title !== undefined) columnPatch.title = patch.title;
  if (patch.notes !== undefined) columnPatch.notes = patch.notes;

  const { error } = await db().from("coach_activities").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await db().from("coach_activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Assignations (présence, heures, taux, paiement) ─────────────── */

export async function getActivityAssignments(activityId: string): Promise<(CoachAssignment & { coach: Coach })[]> {
  const { data, error } = await db()
    .from("coach_assignments")
    .select(`*, coach:coaches(${COACH_SAFE_COLUMNS})`)
    .eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as (CoachAssignment & { coach: Coach })[];
}

export async function getCoachAssignments(coachId: string): Promise<(CoachAssignment & { activity: CoachActivity })[]> {
  const { data, error } = await db()
    .from("coach_assignments")
    .select("*, activity:coach_activities(*)")
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as (CoachAssignment & { activity: CoachActivity })[]).sort(
    (a, b) => b.activity.activity_date.localeCompare(a.activity.activity_date)
  );
}

/** Toutes les assignations, avec entraîneur ET activité joints — utilisé par
 *  le tableau de bord/paie pour agréger sans faire un aller-retour par
 *  activité. */
export async function getAllAssignments(): Promise<(CoachAssignment & { coach: Coach; activity: CoachActivity })[]> {
  const { data, error } = await db()
    .from("coach_assignments")
    .select(`*, coach:coaches(${COACH_SAFE_COLUMNS}), activity:coach_activities(*)`);
  if (error) throw new Error(error.message);
  return (data ?? []) as (CoachAssignment & { coach: Coach; activity: CoachActivity })[];
}

export async function assignCoach(activityId: string, coachId: string, activityStartTime: string, activityEndTime: string): Promise<CoachAssignment> {
  const { data, error } = await db()
    .from("coach_assignments")
    .insert({ activity_id: activityId, coach_id: coachId, arrival_time: activityStartTime, departure_time: activityEndTime })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CoachAssignment;
}

export async function updateAssignment(
  id: string,
  patch: Partial<{
    status: AssignmentStatus;
    arrivalTime: string | null;
    departureTime: string | null;
    hourlyRateCents: number | null;
    confirmed: boolean;
    paid: boolean;
    paidOn: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    paymentNotes: string | null;
  }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) columnPatch.status = patch.status;
  if (patch.arrivalTime !== undefined) columnPatch.arrival_time = patch.arrivalTime;
  if (patch.departureTime !== undefined) columnPatch.departure_time = patch.departureTime;
  if (patch.hourlyRateCents !== undefined) columnPatch.hourly_rate_cents = patch.hourlyRateCents;
  if (patch.confirmed !== undefined) columnPatch.confirmed = patch.confirmed;
  if (patch.paid !== undefined) columnPatch.paid = patch.paid;
  if (patch.paidOn !== undefined) columnPatch.paid_on = patch.paidOn;
  if (patch.paymentMethod !== undefined) columnPatch.payment_method = patch.paymentMethod;
  if (patch.paymentReference !== undefined) columnPatch.payment_reference = patch.paymentReference;
  if (patch.paymentNotes !== undefined) columnPatch.payment_notes = patch.paymentNotes;

  const { error } = await db().from("coach_assignments").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeAssignment(id: string): Promise<void> {
  const { error } = await db().from("coach_assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
