import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export type SessionKind = "diagnostic_gratuit" | "seance_payante" | "diagnostic_final";
export type RegistrationOption = "diagnostic_only" | "full_program";
export type RegistrationStatus = "pending" | "confirmed" | "paid" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "justified_absent" | "to_confirm";
export type NotePhase = "initial" | "final";

export interface SportEtudesSession {
  id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  terrain_id: string | null;
  kind: SessionKind;
  label: string;
  is_time_tbd: boolean;
  display_order: number;
  active: boolean;
  admin_warning: string | null;
  created_at: string;
  updated_at: string;
}

export async function getActiveSessions(): Promise<SportEtudesSession[]> {
  const { data, error } = await db().from("sport_etudes_sessions").select("*").eq("active", true).order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as SportEtudesSession[];
}

export async function getAllSessions(): Promise<SportEtudesSession[]> {
  const { data, error } = await db().from("sport_etudes_sessions").select("*").order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as SportEtudesSession[];
}

export async function updateSession(
  id: string,
  patch: Partial<{
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    location: string;
    terrainId: string | null;
    label: string;
    isTimeTbd: boolean;
    active: boolean;
    adminWarning: string | null;
  }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.sessionDate !== undefined) columnPatch.session_date = patch.sessionDate;
  if (patch.startTime !== undefined) columnPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) columnPatch.end_time = patch.endTime;
  if (patch.location !== undefined) columnPatch.location = patch.location;
  if (patch.terrainId !== undefined) columnPatch.terrain_id = patch.terrainId;
  if (patch.label !== undefined) columnPatch.label = patch.label;
  if (patch.isTimeTbd !== undefined) columnPatch.is_time_tbd = patch.isTimeTbd;
  if (patch.active !== undefined) columnPatch.active = patch.active;
  if (patch.adminWarning !== undefined) columnPatch.admin_warning = patch.adminWarning;
  const { error } = await db().from("sport_etudes_sessions").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface SportEtudesSettings {
  max_capacity: number;
}

export async function getSettings(): Promise<SportEtudesSettings> {
  const { data, error } = await db().from("sport_etudes_settings").select("max_capacity").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return { max_capacity: (data?.max_capacity as number) ?? 30 };
}

export async function updateMaxCapacity(maxCapacity: number): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_settings")
    .update({ max_capacity: maxCapacity, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(error.message);
}

export async function countFullProgramRegistrations(): Promise<number> {
  const { count, error } = await db()
    .from("sport_etudes_registrations")
    .select("id", { count: "exact", head: true })
    .in("status", ["confirmed", "paid"])
    .eq("option_chosen", "full_program");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface CreateRegistrationInput {
  playerId: string | null;
  parentUserId: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDob: string | null;
  playerBirthYear: string | null;
  playerLevel: string | null;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  currentTeam: string | null;
  currentClub: string | null;
  soccerExperience: string | null;
  playerGoals: string | null;
  parentAssessedStrengths: string | null;
  parentAssessedAreasToImprove: string | null;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string | null;
  sportEtudesExperience: string | null;
  priorEvaluationsDone: string | null;
  targetSportEtudesProgram: string | null;
  comments: string | null;
  importantCoachInfo: string | null;
  termsAccepted: boolean;
  optionChosen: RegistrationOption;
  priceCents: number | null;
}

export interface SportEtudesRegistration {
  id: string;
  player_id: string | null;
  parent_user_id: string | null;
  player_first_name: string;
  player_last_name: string;
  player_dob: string | null;
  player_birth_year: string | null;
  player_level: string | null;
  primary_position: string | null;
  secondary_position: string | null;
  current_team: string | null;
  current_club: string | null;
  soccer_experience: string | null;
  player_goals: string | null;
  parent_assessed_strengths: string | null;
  parent_assessed_areas_to_improve: string | null;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  parent_relationship: string | null;
  sport_etudes_experience: string | null;
  prior_evaluations_done: string | null;
  target_sport_etudes_program: string | null;
  comments: string | null;
  important_coach_info: string | null;
  terms_accepted: boolean;
  option_chosen: RegistrationOption;
  status: RegistrationStatus;
  price_cents: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  whatsapp_info: string | null;
  created_at: string;
  updated_at: string;
}

export async function createRegistration(input: CreateRegistrationInput): Promise<string> {
  const { data, error } = await db()
    .from("sport_etudes_registrations")
    .insert({
      player_id: input.playerId,
      parent_user_id: input.parentUserId,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      player_dob: input.playerDob,
      player_birth_year: input.playerBirthYear,
      player_level: input.playerLevel,
      primary_position: input.primaryPosition,
      secondary_position: input.secondaryPosition,
      current_team: input.currentTeam,
      current_club: input.currentClub,
      soccer_experience: input.soccerExperience,
      player_goals: input.playerGoals,
      parent_assessed_strengths: input.parentAssessedStrengths,
      parent_assessed_areas_to_improve: input.parentAssessedAreasToImprove,
      parent_first_name: input.parentFirstName,
      parent_last_name: input.parentLastName,
      parent_email: input.parentEmail,
      parent_phone: input.parentPhone,
      parent_relationship: input.parentRelationship,
      sport_etudes_experience: input.sportEtudesExperience,
      prior_evaluations_done: input.priorEvaluationsDone,
      target_sport_etudes_program: input.targetSportEtudesProgram,
      comments: input.comments,
      important_coach_info: input.importantCoachInfo,
      terms_accepted: input.termsAccepted,
      option_chosen: input.optionChosen,
      status: "pending",
      price_cents: input.priceCents
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setRegistrationCheckoutSession(registrationId: string, checkoutSessionId: string): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_registrations")
    .update({ stripe_checkout_session_id: checkoutSessionId, updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
}

/** Option A (diagnostic seul) — gratuite, aucun paiement à attendre, donc
 *  confirmée immédiatement plutôt que de rester "pending" indéfiniment. */
export async function confirmRegistration(registrationId: string): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_registrations")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
}

export async function cancelRegistration(registrationId: string): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_registrations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
}

export async function getRegistrationById(id: string): Promise<SportEtudesRegistration | null> {
  const { data, error } = await db().from("sport_etudes_registrations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SportEtudesRegistration | null;
}

export async function updateRegistrationStatus(id: string, status: RegistrationStatus): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_registrations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRegistration(id: string): Promise<void> {
  await db().from("sport_etudes_attendance").delete().in(
    "enrollment_id",
    ((await db().from("sport_etudes_enrollments").select("id").eq("registration_id", id)).data ?? []).map((r: { id: string }) => r.id)
  );
  await db().from("sport_etudes_enrollments").delete().eq("registration_id", id);
  await db().from("sport_etudes_technical_notes").delete().eq("registration_id", id);
  const { error } = await db().from("sport_etudes_registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getAllRegistrations(): Promise<SportEtudesRegistration[]> {
  const { data, error } = await db().from("sport_etudes_registrations").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SportEtudesRegistration[];
}

export async function enrollInSession(registrationId: string, sessionId: string): Promise<void> {
  const { error } = await db().from("sport_etudes_enrollments").upsert(
    { registration_id: registrationId, session_id: sessionId },
    { onConflict: "registration_id,session_id" }
  );
  if (error) throw new Error(error.message);
}

/** Option A (diagnostic seul) : une seule ligne d'inscription (la séance
 *  diagnostique). Option B (programme complet) : une ligne par séance
 *  active au moment de l'inscription — source unique de vérité pour "qui
 *  vient à quelle séance" (présence + calendrier global). */
export async function enrollInAllActiveSessions(registrationId: string): Promise<void> {
  const sessions = await getActiveSessions();
  for (const s of sessions) await enrollInSession(registrationId, s.id);
}

export async function enrollInDiagnosticOnly(registrationId: string): Promise<void> {
  const sessions = await getActiveSessions();
  const diagnostic = sessions.find((s) => s.kind === "diagnostic_gratuit");
  if (diagnostic) await enrollInSession(registrationId, diagnostic.id);
}

export async function markRegistrationPaid(checkoutSessionId: string, paymentIntentId?: string): Promise<SportEtudesRegistration | null> {
  const { data, error } = await db()
    .from("sport_etudes_registrations")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId ?? null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SportEtudesRegistration | null;
}

export interface EnrollmentWithSession {
  id: string;
  registration_id: string;
  session_id: string;
  session: SportEtudesSession;
}

export async function getEnrollmentsForRegistration(registrationId: string): Promise<EnrollmentWithSession[]> {
  const { data, error } = await db()
    .from("sport_etudes_enrollments")
    .select("*, session:sport_etudes_sessions(*)")
    .eq("registration_id", registrationId);
  if (error) throw new Error(error.message);
  return (data ?? []) as EnrollmentWithSession[];
}

export interface AttendanceRecord {
  id: string;
  enrollment_id: string;
  status: AttendanceStatus;
  updated_by: string | null;
  notes: string | null;
  updated_at: string;
}

export async function getAttendanceForEnrollments(enrollmentIds: string[]): Promise<AttendanceRecord[]> {
  if (enrollmentIds.length === 0) return [];
  const { data, error } = await db().from("sport_etudes_attendance").select("*").in("enrollment_id", enrollmentIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as AttendanceRecord[];
}

export async function setAttendance(enrollmentId: string, status: AttendanceStatus, updatedBy: string | null, notes: string | null): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_attendance")
    .upsert(
      { enrollment_id: enrollmentId, status, updated_by: updatedBy, notes, updated_at: new Date().toISOString() },
      { onConflict: "enrollment_id" }
    );
  if (error) throw new Error(error.message);
}

export interface TechnicalNotes {
  id: string;
  registration_id: string;
  phase: NotePhase;
  technique: number | null;
  ball_control: number | null;
  passing: number | null;
  first_touch: number | null;
  one_v_one: number | null;
  speed: number | null;
  decision_making: number | null;
  game_understanding: number | null;
  finishing: number | null;
  strengths: string | null;
  areas_to_improve: string | null;
  coach_notes: string | null;
  recorded_by: string | null;
}

export async function getTechnicalNotes(registrationId: string): Promise<TechnicalNotes[]> {
  const { data, error } = await db().from("sport_etudes_technical_notes").select("*").eq("registration_id", registrationId);
  if (error) throw new Error(error.message);
  return (data ?? []) as TechnicalNotes[];
}

export async function setTechnicalNotes(
  registrationId: string,
  phase: NotePhase,
  ratings: Partial<Record<
    "technique" | "ball_control" | "passing" | "first_touch" | "one_v_one" | "speed" | "decision_making" | "game_understanding" | "finishing",
    number | null
  >>,
  strengths: string | null,
  areasToImprove: string | null,
  coachNotes: string | null,
  recordedBy: string | null
): Promise<void> {
  const { error } = await db()
    .from("sport_etudes_technical_notes")
    .upsert(
      {
        registration_id: registrationId,
        phase,
        ...ratings,
        strengths,
        areas_to_improve: areasToImprove,
        coach_notes: coachNotes,
        recorded_by: recordedBy,
        updated_at: new Date().toISOString()
      },
      { onConflict: "registration_id,phase" }
    );
  if (error) throw new Error(error.message);
}
