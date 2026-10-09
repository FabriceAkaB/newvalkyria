import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PrivateProgram {
  slug: string;
  name: string;
  gender: string;
  birth_years: string;
  price_cents: number;
  max_capacity: number;
  min_capacity: number | null;
  description: string | null;
  active: boolean;
  is_private: boolean;
  practices_count: number | null;
  matches_count: number | null;
  installment_fee_cents: number;
  referral_discount_cents: number;
  eligible_birth_years: string[] | null;
  second_installment_date: string | null;
  presentation: Record<string, unknown> | null;
  program_kind: string;
  published: boolean;
  cost_per_session_cents: number;
  fixed_costs_cents: number;
}

export interface PrivateRegistration {
  id: string;
  program_slug: string;
  player_id: string | null;
  player_first_name: string;
  player_last_name: string;
  player_dob: string | null;
  birth_year: number | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  city: string | null;
  comments: string | null;
  status: "pending" | "confirmed" | "paid" | "waitlist" | "cancelled";
  payment_option: "full" | "two_installments" | null;
  list_price_cents: number | null;
  referral_discount_cents: number;
  credit_applied_cents: number;
  installment_fee_cents: number;
  total_due_cents: number | null;
  price_cents: number | null;
  auto_debit_consent: boolean;
  reservation_expires_at: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

export const PRIVATE_RESERVATION_MINUTES = 30;

export async function getPrivateProgram(slug: string): Promise<PrivateProgram | null> {
  const { data, error } = await db().from("session_programs").select("*").eq("slug", slug).eq("is_private", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PrivateProgram | null;
}

export async function getAllPrivatePrograms(): Promise<PrivateProgram[]> {
  const { data, error } = await db().from("session_programs").select("*").eq("is_private", true).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as PrivateProgram[];
}

export async function updatePrivateProgram(
  slug: string,
  patch: Partial<{
    maxCapacity: number;
    minCapacity: number | null;
    priceCents: number;
    installmentFeeCents: number;
    referralDiscountCents: number;
    secondInstallmentDate: string | null;
    active: boolean;
    published: boolean;
    costPerSessionCents: number;
    fixedCostsCents: number;
    presentation: Record<string, unknown>;
  }>
): Promise<void> {
  const columns: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.maxCapacity !== undefined) columns.max_capacity = patch.maxCapacity;
  if (patch.minCapacity !== undefined) columns.min_capacity = patch.minCapacity;
  if (patch.priceCents !== undefined) columns.price_cents = patch.priceCents;
  if (patch.installmentFeeCents !== undefined) columns.installment_fee_cents = patch.installmentFeeCents;
  if (patch.referralDiscountCents !== undefined) columns.referral_discount_cents = patch.referralDiscountCents;
  if (patch.secondInstallmentDate !== undefined) columns.second_installment_date = patch.secondInstallmentDate;
  if (patch.active !== undefined) columns.active = patch.active;
  if (patch.published !== undefined) columns.published = patch.published;
  if (patch.costPerSessionCents !== undefined) columns.cost_per_session_cents = patch.costPerSessionCents;
  if (patch.fixedCostsCents !== undefined) columns.fixed_costs_cents = patch.fixedCostsCents;
  if (patch.presentation !== undefined) columns.presentation = patch.presentation;
  const { error } = await db().from("session_programs").update(columns).eq("slug", slug).eq("is_private", true);
  if (error) throw new Error(error.message);
}

/** Inscriptions qui occupent une place : payées/confirmées, ou en cours de
 *  paiement avec une réservation encore valide (jamais un blocage permanent). */
export async function getHeldRegistrations(slug: string): Promise<PrivateRegistration[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("session_program_registrations")
    .select("*")
    .eq("program_slug", slug)
    .or(`status.in.(paid,confirmed),and(status.eq.pending,reservation_expires_at.gt.${nowIso})`)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PrivateRegistration[];
}

export async function countHeldPlaces(slug: string): Promise<number> {
  return (await getHeldRegistrations(slug)).length;
}

export async function countPaidPlaces(slug: string): Promise<number> {
  const { count, error } = await db()
    .from("session_program_registrations")
    .select("id", { count: "exact", head: true })
    .eq("program_slug", slug)
    .in("status", ["paid", "confirmed"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getWaitlistCount(slug: string): Promise<number> {
  const { count, error } = await db()
    .from("session_program_registrations")
    .select("id", { count: "exact", head: true })
    .eq("program_slug", slug)
    .eq("status", "waitlist");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Inscription déjà active (payée, en attente valide ou liste d'attente) pour le
 *  même joueur et le même courriel de parent dans ce programme. */
export async function findDuplicateRegistration(slug: string, parentEmail: string, first: string, last: string): Promise<PrivateRegistration | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("session_program_registrations")
    .select("*")
    .eq("program_slug", slug)
    .ilike("parent_email", parentEmail.trim())
    .or(`status.in.(paid,confirmed,waitlist),and(status.eq.pending,reservation_expires_at.gt.${nowIso})`);
  if (error) throw new Error(error.message);
  const key = `${normalizeName(first)} ${normalizeName(last)}`;
  return ((data ?? []) as PrivateRegistration[]).find((r) => `${normalizeName(r.player_first_name)} ${normalizeName(r.player_last_name)}` === key) ?? null;
}

export interface CreatePrivateRegistrationInput {
  programSlug: string;
  playerId: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDob: string | null;
  birthYear: number | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  city: string | null;
  comments: string | null;
  status: "pending" | "waitlist";
  paymentOption: "full" | "two_installments" | null;
  listPriceCents: number;
  referralDiscountCents: number;
  creditAppliedCents: number;
  installmentFeeCents: number;
  totalDueCents: number;
  autoDebitConsent: boolean;
}

export async function createPrivateRegistration(input: CreatePrivateRegistrationInput): Promise<string> {
  const reservation = input.status === "pending" ? new Date(Date.now() + PRIVATE_RESERVATION_MINUTES * 60_000).toISOString() : null;
  const { data, error } = await db()
    .from("session_program_registrations")
    .insert({
      program_slug: input.programSlug,
      player_id: input.playerId,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      player_dob: input.playerDob,
      birth_year: input.birthYear,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      parent_phone: input.parentPhone,
      city: input.city,
      comments: input.comments,
      terms_accepted: true,
      status: input.status,
      payment_option: input.paymentOption,
      list_price_cents: input.listPriceCents,
      referral_discount_cents: input.referralDiscountCents,
      credit_applied_cents: input.creditAppliedCents,
      installment_fee_cents: input.installmentFeeCents,
      total_due_cents: input.totalDueCents,
      price_cents: input.totalDueCents,
      auto_debit_consent: input.autoDebitConsent,
      reservation_expires_at: reservation
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Après insertion : vérifie, de façon déterministe (ordre d'arrivée), que
 *  l'inscription est bien dans les N premières places — protège contre deux
 *  parents qui prennent la dernière place en même temps. */
export async function isWithinCapacity(slug: string, registrationId: string, capacity: number): Promise<boolean> {
  const held = await getHeldRegistrations(slug);
  const index = held.findIndex((r) => r.id === registrationId);
  return index !== -1 && index < capacity;
}

export async function setRegistrationStatus(id: string, status: PrivateRegistration["status"]): Promise<void> {
  const { error } = await db()
    .from("session_program_registrations")
    .update({ status, reservation_expires_at: status === "pending" ? undefined : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getPrivateRegistrationById(id: string): Promise<PrivateRegistration | null> {
  const { data, error } = await db().from("session_program_registrations").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PrivateRegistration | null;
}

export async function getPrivateRegistrationBySession(sessionId: string): Promise<PrivateRegistration | null> {
  const { data, error } = await db().from("session_program_registrations").select("*").eq("stripe_checkout_session_id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PrivateRegistration | null;
}

export async function getPrivateRegistrationByPaymentIntent(paymentIntentId: string): Promise<PrivateRegistration | null> {
  const { data, error } = await db().from("session_program_registrations").select("*").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PrivateRegistration | null;
}

export interface PrivateRegistrationRow extends PrivateRegistration {
  referral: {
    id: string;
    referrer_name: string | null;
    referrer_email: string | null;
    status: string;
    reward_status: string;
    reward_choice: string | null;
  } | null;
  installments: { sequence_no: number; amount_cents: number; due_date: string; status: string; paid_at: string | null }[];
  paid_cents: number;
}

/** Inscriptions des programmes privés avec référent, versements et montant
 *  payé/restant — alimente le tableau administratif (bloc 5.1). */
export async function getPrivateRegistrationRows(slug?: string): Promise<PrivateRegistrationRow[]> {
  const supabase = db();
  let query = supabase
    .from("session_program_registrations")
    .select("*")
    .in("program_slug", slug ? [slug] : (await getAllPrivatePrograms()).map((p) => p.slug))
    .order("created_at", { ascending: false });
  const { data: regs, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (regs ?? []) as PrivateRegistration[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [{ data: refs }, { data: plans }] = await Promise.all([
    supabase.from("program_referrals").select("id, registration_id, referrer_name, referrer_email, status, reward_status, reward_choice").in("registration_id", ids),
    supabase.from("session_program_payment_plans").select("id, registration_id").in("registration_id", ids)
  ]);
  const planIds = (plans ?? []).map((p: any) => p.id);
  const { data: insts } = planIds.length
    ? await supabase.from("session_program_payment_plan_installments").select("plan_id, sequence_no, amount_cents, due_date, status, paid_at").in("plan_id", planIds).order("sequence_no")
    : { data: [] as any[] };

  const planByReg = new Map<string, string>((plans ?? []).map((p: any) => [p.registration_id, p.id]));
  return rows.map((r) => {
    const planId = planByReg.get(r.id);
    const installments = (insts ?? []).filter((i: any) => i.plan_id === planId);
    const paidCents = installments.length
      ? installments.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount_cents, 0)
      : r.status === "paid" || r.status === "confirmed"
        ? r.total_due_cents ?? r.price_cents ?? 0
        : 0;
    return {
      ...r,
      referral: ((refs ?? []).find((x: any) => x.registration_id === r.id) as any) ?? null,
      installments,
      paid_cents: paidCents
    };
  });
}

export interface ReminderInstallment {
  id: string;
  amount_cents: number;
  due_date: string;
  parent_name: string;
  parent_email: string;
  player_name: string;
  program_name: string;
}

/** Versements des programmes privés prélevés dans les 3 prochains jours et pas
 *  encore rappelés à la famille. */
export async function getInstallmentsNeedingReminder(): Promise<ReminderInstallment[]> {
  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("session_program_payment_plan_installments")
    .select("id, amount_cents, due_date, session_program_payment_plans!inner(session_program_registrations!inner(parent_name, parent_email, player_first_name, player_last_name, program_slug, status))")
    .eq("status", "pending")
    .gt("sequence_no", 1)
    .is("reminder_sent_at", null)
    .gte("due_date", today)
    .lte("due_date", horizon);
  if (error) throw new Error(error.message);

  const slugs = new Set<string>();
  const rows = (data ?? []).filter((r: any) => {
    const reg = r.session_program_payment_plans.session_program_registrations;
    if (reg.status === "cancelled") return false;
    slugs.add(reg.program_slug);
    return true;
  });
  const { data: programs } = await supabase.from("session_programs").select("slug, name, is_private").in("slug", Array.from(slugs)).eq("is_private", true);
  const names = new Map<string, string>((programs ?? []).map((p: any) => [p.slug, p.name]));

  return rows
    .filter((r: any) => names.has(r.session_program_payment_plans.session_program_registrations.program_slug))
    .map((r: any) => {
      const reg = r.session_program_payment_plans.session_program_registrations;
      return {
        id: r.id,
        amount_cents: r.amount_cents,
        due_date: r.due_date,
        parent_name: reg.parent_name,
        parent_email: reg.parent_email,
        player_name: `${reg.player_first_name} ${reg.player_last_name}`.trim(),
        program_name: names.get(reg.program_slug) as string
      };
    });
}

export async function markInstallmentReminderSent(id: string): Promise<void> {
  await db().from("session_program_payment_plan_installments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", id);
}
