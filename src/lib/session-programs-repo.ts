import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export type SessionProgramSlug = "privilege-valkyria" | "intensif-garcons";
export type RegistrationStatus = "pending" | "confirmed" | "paid" | "waitlist" | "cancelled";

export interface SessionProgram {
  slug: SessionProgramSlug;
  name: string;
  gender: "filles" | "garcons";
  birth_years: string;
  price_cents: number;
  max_capacity: number;
  description: string | null;
  active: boolean;
}

export interface SessionProgramDate {
  id: string;
  program_slug: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
  display_order: number;
}

export async function getProgram(slug: SessionProgramSlug): Promise<SessionProgram | null> {
  const { data, error } = await db().from("session_programs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SessionProgram | null;
}

export async function getProgramDates(slug: SessionProgramSlug): Promise<SessionProgramDate[]> {
  const { data, error } = await db().from("session_program_dates").select("*").eq("program_slug", slug).order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionProgramDate[];
}

export async function countActiveRegistrations(slug: SessionProgramSlug): Promise<number> {
  const { count, error } = await db()
    .from("session_program_registrations")
    .select("id", { count: "exact", head: true })
    .eq("program_slug", slug)
    .in("status", ["confirmed", "paid"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface CreateSessionProgramRegistrationInput {
  programSlug: SessionProgramSlug;
  playerId: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDob: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  city: string | null;
  comments: string | null;
  termsAccepted: boolean;
  priceCents: number;
}

export interface SessionProgramRegistration {
  id: string;
  program_slug: string;
  player_id: string | null;
  player_first_name: string;
  player_last_name: string;
  player_dob: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  city: string | null;
  comments: string | null;
  terms_accepted: boolean;
  status: RegistrationStatus;
  price_cents: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function createRegistration(input: CreateSessionProgramRegistrationInput): Promise<string> {
  const { data, error } = await db()
    .from("session_program_registrations")
    .insert({
      program_slug: input.programSlug,
      player_id: input.playerId,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      player_dob: input.playerDob,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      parent_phone: input.parentPhone,
      city: input.city,
      comments: input.comments,
      terms_accepted: input.termsAccepted,
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
    .from("session_program_registrations")
    .update({ stripe_checkout_session_id: checkoutSessionId, updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
}

export async function cancelRegistration(registrationId: string): Promise<void> {
  const { error } = await db()
    .from("session_program_registrations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) throw new Error(error.message);
}

export async function getRegistrationById(id: string): Promise<SessionProgramRegistration | null> {
  const { data, error } = await db().from("session_program_registrations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SessionProgramRegistration | null;
}

export async function updateRegistrationStatus(id: string, status: RegistrationStatus): Promise<void> {
  const { error } = await db()
    .from("session_program_registrations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRegistration(id: string): Promise<void> {
  const { error } = await db().from("session_program_registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markRegistrationPaidByCheckoutSession(
  checkoutSessionId: string,
  paymentIntentId: string | undefined
): Promise<SessionProgramRegistration | null> {
  const { data, error } = await db()
    .from("session_program_registrations")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId ?? null, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as SessionProgramRegistration | null;
}

/** Inscrit une joueuse/un joueur à toutes les dates fixes du programme —
 *  il n'existe qu'une seule option (pas de diagnostic/programme complet
 *  comme Sport-Études), donc toujours "toutes les dates". */
export async function enrollInAllDates(registrationId: string, programSlug: SessionProgramSlug): Promise<void> {
  const dates = await getProgramDates(programSlug);
  if (dates.length === 0) return;
  const { error } = await db()
    .from("session_program_enrollments")
    .insert(dates.map((d) => ({ registration_id: registrationId, date_id: d.id })));
  if (error) throw new Error(error.message);
}

export interface RegistrationWithProgram extends SessionProgramRegistration {
  program: SessionProgram | null;
}

export async function getAllRegistrations(slug: SessionProgramSlug): Promise<SessionProgramRegistration[]> {
  const { data, error } = await db()
    .from("session_program_registrations")
    .select("*")
    .eq("program_slug", slug)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionProgramRegistration[];
}

/* ── Paiement en 1, 2 ou 3 fois (Programme Intensif) ──────────────────── */

export interface CreatePaymentPlanInstallmentInput {
  sequenceNo: number;
  amountCents: number;
  dueDate: string;
}

export interface CreatePaymentPlanInput {
  registrationId: string;
  totalAmountCents: number;
  installments: CreatePaymentPlanInstallmentInput[];
}

export async function createPaymentPlan(input: CreatePaymentPlanInput): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("session_program_payment_plans")
    .insert({ registration_id: input.registrationId, total_amount_cents: input.totalAmountCents, installment_count: input.installments.length })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const planId = data.id as string;

  const { error: instError } = await supabase.from("session_program_payment_plan_installments").insert(
    input.installments.map((inst) => ({ plan_id: planId, sequence_no: inst.sequenceNo, amount_cents: inst.amountCents, due_date: inst.dueDate }))
  );
  if (instError) throw new Error(instError.message);

  return planId;
}

export async function deletePaymentPlan(planId: string): Promise<void> {
  await db().from("session_program_payment_plans").delete().eq("id", planId);
}

export async function activatePaymentPlan(
  planId: string,
  input: { stripeCustomerId: string; stripePaymentMethodId: string; firstInstallmentPaymentIntentId: string | undefined }
): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("session_program_payment_plans")
    .update({ stripe_customer_id: input.stripeCustomerId, stripe_payment_method_id: input.stripePaymentMethodId })
    .eq("id", planId);
  if (error) throw new Error(error.message);

  const { error: instError } = await supabase
    .from("session_program_payment_plan_installments")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: input.firstInstallmentPaymentIntentId ?? null, updated_at: new Date().toISOString() })
    .eq("plan_id", planId)
    .eq("sequence_no", 1);
  if (instError) throw new Error(instError.message);
}

const MAX_INSTALLMENT_ATTEMPTS = 5;

export interface DueInstallment {
  id: string;
  plan_id: string;
  sequence_no: number;
  amount_cents: number;
  attempt_count: number;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  installment_count: number;
  parent_name: string;
  parent_email: string;
}

/** Versements dus (hors 1er, déjà payé au checkout) — utilisé par
 *  /api/cron/charge-installments. */
export async function getDueInstallments(): Promise<DueInstallment[]> {
  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("session_program_payment_plan_installments")
    .select(`
      id, plan_id, sequence_no, amount_cents, attempt_count,
      session_program_payment_plans!inner (
        stripe_customer_id, stripe_payment_method_id, installment_count,
        session_program_registrations!inner ( parent_name, parent_email )
      )
    `)
    .in("status", ["pending", "failed"])
    .gt("sequence_no", 1)
    .lte("due_date", today)
    .lt("attempt_count", MAX_INSTALLMENT_ATTEMPTS);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    plan_id: row.plan_id,
    sequence_no: row.sequence_no,
    amount_cents: row.amount_cents,
    attempt_count: row.attempt_count,
    stripe_customer_id: row.session_program_payment_plans.stripe_customer_id,
    stripe_payment_method_id: row.session_program_payment_plans.stripe_payment_method_id,
    installment_count: row.session_program_payment_plans.installment_count,
    parent_name: row.session_program_payment_plans.session_program_registrations.parent_name,
    parent_email: row.session_program_payment_plans.session_program_registrations.parent_email
  }));
}

export async function markInstallmentPaid(id: string, stripePaymentIntentId: string): Promise<void> {
  const { error } = await db()
    .from("session_program_payment_plan_installments")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: stripePaymentIntentId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markInstallmentFailed(
  id: string,
  currentAttemptCount: number
): Promise<{ attemptCount: number; isFinal: boolean; wasFirstFailure: boolean }> {
  const attemptCount = currentAttemptCount + 1;
  const isFinal = attemptCount >= MAX_INSTALLMENT_ATTEMPTS;
  const wasFirstFailure = currentAttemptCount === 0;
  const { error } = await db()
    .from("session_program_payment_plan_installments")
    .update({ attempt_count: attemptCount, status: isFinal ? "failed_final" : "failed", failure_notified: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { attemptCount, isFinal, wasFirstFailure };
}
