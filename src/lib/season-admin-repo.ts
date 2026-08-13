import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Le client Supabase n'a pas de schéma Database généré (même contournement
 *  que repositories.ts) — les nouvelles tables ne sont donc pas typées côté client. */
function db() {
  return getSupabaseAdminClient() as any;
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface Season {
  id: string;
  label: string;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BirthCategory {
  season_id: string;
  id: string;
  label: string;
  display_order: number;
}

export interface Program {
  season_id: string;
  id: string;
  name: string;
  price_cents: number;
  invitation: boolean;
  tagline: string | null;
  includes: string[];
  tech_count: string | null;
  team_count: string | null;
  solo_count: string | null;
  badge: string | null;
  display_order: number;
  active: boolean;
}

export interface ProgramCategoryCapacity {
  season_id: string;
  program_id: string;
  category_id: string;
  max_places: number;
}

export interface TimeSlotTemplate {
  id: string;
  season_id: string;
  day: string;
  start_time: string;
  end_time: string;
  location: string;
  max_places: number;
  recommended_for_advanced: boolean;
  advanced_only: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  category_ids: string[];
  program_ids: string[];
}

export interface TimeSlotDate {
  id: string;
  time_slot_template_id: string;
  occurs_on: string;
  cancelled: boolean;
  note: string | null;
}

export type RegistrationStatus = "pending" | "confirmed" | "paid" | "waitlist" | "cancelled";

export interface Registration {
  id: string;
  season_id: string;
  program_id: string | null;
  category_id: string | null;
  time_slot_template_id: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  city: string | null;
  player_first_name: string | null;
  player_last_name: string | null;
  player_dob: string | null;
  status: RegistrationStatus;
  is_trial: boolean;
  trial_date: string | null;
  is_half_season: boolean;
  half_season_ends_on: string | null;
  advanced_group: boolean;
  converted_from_id: string | null;
  transferred_from_lead_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Saisons ───────────────────────────────────────────────────── */

export async function getSeasons(): Promise<Season[]> {
  const supabase = db();
  const { data, error } = await supabase.from("seasons").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Season[];
}

export async function getSeason(seasonId: string): Promise<Season | null> {
  const supabase = db();
  const { data, error } = await supabase.from("seasons").select("*").eq("id", seasonId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Season | null;
}

/* ── Catégories & programmes ───────────────────────────────────── */

export async function getSeasonCategories(seasonId: string): Promise<BirthCategory[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("birth_categories")
    .select("*")
    .eq("season_id", seasonId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BirthCategory[];
}

export async function getSeasonPrograms(seasonId: string): Promise<Program[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("season_id", seasonId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Program[];
}

export async function getSeasonProgramCategories(seasonId: string): Promise<ProgramCategoryCapacity[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("program_categories")
    .select("*")
    .eq("season_id", seasonId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProgramCategoryCapacity[];
}

export async function updateProgramCategoryMax(
  seasonId: string,
  programId: string,
  categoryId: string,
  maxPlaces: number
): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("program_categories")
    .update({ max_places: maxPlaces })
    .eq("season_id", seasonId)
    .eq("program_id", programId)
    .eq("category_id", categoryId);
  if (error) throw new Error(error.message);
}

/* ── Plages horaires ───────────────────────────────────────────── */

/** Le jour est stocké en texte ("Lundi", "Mardi"...) — un tri SQL alphabétique
 *  mettrait "Jeudi" avant "Lundi". On trie donc en JS dans l'ordre réel de la
 *  semaine, du lundi au dimanche. */
const DAY_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export async function getSeasonSlots(seasonId: string): Promise<TimeSlotTemplate[]> {
  const supabase = db();
  const { data: slots, error } = await supabase
    .from("time_slot_templates")
    .select("*")
    .eq("season_id", seasonId)
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  if (!slots || slots.length === 0) return [];

  slots.sort((a: { day: string }, b: { day: string }) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  const slotIds = slots.map((s: { id: string }) => s.id);

  const [{ data: cats, error: catErr }, { data: progs, error: progErr }] = await Promise.all([
    supabase.from("time_slot_template_categories").select("time_slot_template_id, category_id").in("time_slot_template_id", slotIds),
    supabase.from("time_slot_template_programs").select("time_slot_template_id, program_id").in("time_slot_template_id", slotIds)
  ]);
  if (catErr) throw new Error(catErr.message);
  if (progErr) throw new Error(progErr.message);

  const catsBySlot = new Map<string, string[]>();
  for (const row of cats ?? []) {
    const list = catsBySlot.get(row.time_slot_template_id as string) ?? [];
    list.push(row.category_id as string);
    catsBySlot.set(row.time_slot_template_id as string, list);
  }
  const progsBySlot = new Map<string, string[]>();
  for (const row of progs ?? []) {
    const list = progsBySlot.get(row.time_slot_template_id as string) ?? [];
    list.push(row.program_id as string);
    progsBySlot.set(row.time_slot_template_id as string, list);
  }

  return slots.map((s: Omit<TimeSlotTemplate, "category_ids" | "program_ids">) => ({
    ...s,
    category_ids: catsBySlot.get(s.id) ?? [],
    program_ids: progsBySlot.get(s.id) ?? []
  }));
}

export async function createSlot(
  seasonId: string,
  input: {
    day: string;
    startTime: string;
    endTime: string;
    location: string;
    maxPlaces: number;
    recommendedForAdvanced: boolean;
    advancedOnly: boolean;
    categoryIds: string[];
    programIds: string[];
  }
): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("time_slot_templates")
    .insert({
      season_id: seasonId,
      day: input.day,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      max_places: input.maxPlaces,
      recommended_for_advanced: input.recommendedForAdvanced,
      advanced_only: input.advancedOnly
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const slotId = data.id as string;

  if (input.categoryIds.length > 0) {
    const { error: catErr } = await supabase
      .from("time_slot_template_categories")
      .insert(input.categoryIds.map((categoryId) => ({ time_slot_template_id: slotId, category_id: categoryId })));
    if (catErr) throw new Error(catErr.message);
  }
  if (input.programIds.length > 0) {
    const { error: progErr } = await supabase
      .from("time_slot_template_programs")
      .insert(input.programIds.map((programId) => ({ time_slot_template_id: slotId, program_id: programId })));
    if (progErr) throw new Error(progErr.message);
  }

  return slotId;
}

export async function updateSlot(
  slotId: string,
  patch: Partial<{
    day: string;
    startTime: string;
    endTime: string;
    location: string;
    maxPlaces: number;
    recommendedForAdvanced: boolean;
    advancedOnly: boolean;
    active: boolean;
    categoryIds: string[];
    programIds: string[];
  }>
): Promise<void> {
  const supabase = db();

  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.day !== undefined) columnPatch.day = patch.day;
  if (patch.startTime !== undefined) columnPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) columnPatch.end_time = patch.endTime;
  if (patch.location !== undefined) columnPatch.location = patch.location;
  if (patch.maxPlaces !== undefined) columnPatch.max_places = patch.maxPlaces;
  if (patch.recommendedForAdvanced !== undefined) columnPatch.recommended_for_advanced = patch.recommendedForAdvanced;
  if (patch.advancedOnly !== undefined) columnPatch.advanced_only = patch.advancedOnly;
  if (patch.active !== undefined) columnPatch.active = patch.active;

  const { error } = await supabase.from("time_slot_templates").update(columnPatch).eq("id", slotId);
  if (error) throw new Error(error.message);

  if (patch.categoryIds !== undefined) {
    const { error: delErr } = await supabase.from("time_slot_template_categories").delete().eq("time_slot_template_id", slotId);
    if (delErr) throw new Error(delErr.message);
    if (patch.categoryIds.length > 0) {
      const { error: insErr } = await supabase
        .from("time_slot_template_categories")
        .insert(patch.categoryIds.map((categoryId) => ({ time_slot_template_id: slotId, category_id: categoryId })));
      if (insErr) throw new Error(insErr.message);
    }
  }

  if (patch.programIds !== undefined) {
    const { error: delErr } = await supabase.from("time_slot_template_programs").delete().eq("time_slot_template_id", slotId);
    if (delErr) throw new Error(delErr.message);
    if (patch.programIds.length > 0) {
      const { error: insErr } = await supabase
        .from("time_slot_template_programs")
        .insert(patch.programIds.map((programId) => ({ time_slot_template_id: slotId, program_id: programId })));
      if (insErr) throw new Error(insErr.message);
    }
  }
}

export async function deleteSlot(slotId: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("time_slot_templates").delete().eq("id", slotId);
  if (error) throw new Error(error.message);
}

/* ── Dates de calendrier ───────────────────────────────────────── */

export async function getSlotDates(slotId: string): Promise<TimeSlotDate[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("time_slot_dates")
    .select("*")
    .eq("time_slot_template_id", slotId)
    .order("occurs_on", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimeSlotDate[];
}

export async function getSeasonSlotDates(seasonId: string): Promise<Record<string, TimeSlotDate[]>> {
  const supabase = db();
  const { data: slots, error: slotErr } = await supabase
    .from("time_slot_templates")
    .select("id")
    .eq("season_id", seasonId);
  if (slotErr) throw new Error(slotErr.message);
  const slotIds = (slots ?? []).map((s: { id: string }) => s.id);
  if (slotIds.length === 0) return {};

  const { data, error } = await supabase
    .from("time_slot_dates")
    .select("*")
    .in("time_slot_template_id", slotIds)
    .order("occurs_on", { ascending: true });
  if (error) throw new Error(error.message);

  const bySlot: Record<string, TimeSlotDate[]> = {};
  for (const row of (data ?? []) as TimeSlotDate[]) {
    const list = bySlot[row.time_slot_template_id] ?? [];
    list.push(row);
    bySlot[row.time_slot_template_id] = list;
  }
  return bySlot;
}

export async function addSlotDate(slotId: string, occursOn: string, note?: string): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("time_slot_dates")
    .insert({ time_slot_template_id: slotId, occurs_on: occursOn, note: note ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function removeSlotDate(dateId: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("time_slot_dates").delete().eq("id", dateId);
  if (error) throw new Error(error.message);
}

export async function toggleSlotDateCancelled(dateId: string, cancelled: boolean): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("time_slot_dates").update({ cancelled }).eq("id", dateId);
  if (error) throw new Error(error.message);
}

/* ── Inscriptions ──────────────────────────────────────────────── */

export async function getSeasonRegistrations(seasonId: string): Promise<Registration[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Registration[];
}

/** Recherche une joueuse par nom (joueuse ou parent), toutes saisons du
 *  système multi-saisons confondues — utilisé pour relier une commande
 *  boutique à une joueuse (module Uniformes). */
export async function searchRegistrations(query: string): Promise<Registration[]> {
  const supabase = db();
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .neq("status", "cancelled")
    .or(`player_first_name.ilike.%${q}%,player_last_name.ilike.%${q}%,parent_name.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Registration[];
}

export async function updateRegistration(
  id: string,
  patch: Partial<{
    programId: string | null;
    categoryId: string | null;
    timeSlotTemplateId: string | null;
    advancedGroup: boolean;
    status: RegistrationStatus;
    isTrial: boolean;
    trialDate: string | null;
    isHalfSeason: boolean;
    halfSeasonEndsOn: string | null;
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    city: string | null;
    playerFirstName: string | null;
    playerLastName: string | null;
    playerDob: string | null;
  }>
): Promise<void> {
  const supabase = db();
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.programId !== undefined) columnPatch.program_id = patch.programId;
  if (patch.categoryId !== undefined) columnPatch.category_id = patch.categoryId;
  if (patch.timeSlotTemplateId !== undefined) columnPatch.time_slot_template_id = patch.timeSlotTemplateId;
  if (patch.advancedGroup !== undefined) columnPatch.advanced_group = patch.advancedGroup;
  if (patch.status !== undefined) columnPatch.status = patch.status;
  if (patch.isTrial !== undefined) columnPatch.is_trial = patch.isTrial;
  if (patch.trialDate !== undefined) columnPatch.trial_date = patch.trialDate;
  if (patch.isHalfSeason !== undefined) columnPatch.is_half_season = patch.isHalfSeason;
  if (patch.halfSeasonEndsOn !== undefined) columnPatch.half_season_ends_on = patch.halfSeasonEndsOn;
  if (patch.parentName !== undefined) columnPatch.parent_name = patch.parentName;
  if (patch.parentEmail !== undefined) columnPatch.parent_email = patch.parentEmail;
  if (patch.parentPhone !== undefined) columnPatch.parent_phone = patch.parentPhone;
  if (patch.city !== undefined) columnPatch.city = patch.city;
  if (patch.playerFirstName !== undefined) columnPatch.player_first_name = patch.playerFirstName;
  if (patch.playerLastName !== undefined) columnPatch.player_last_name = patch.playerLastName;
  if (patch.playerDob !== undefined) columnPatch.player_dob = patch.playerDob;

  const { error } = await supabase.from("registrations").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Suppression définitive (pas un simple statut "cancelled") — utilisée par
 *  l'admin quand une inscription doit être retirée pour de bon. */
export async function deleteRegistration(id: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("registrations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function convertTrialToOfficial(
  id: string,
  patch: { programId: string; categoryId: string; timeSlotTemplateId: string | null }
): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("registrations")
    .update({
      is_trial: false,
      status: "confirmed",
      program_id: patch.programId,
      category_id: patch.categoryId,
      time_slot_template_id: patch.timeSlotTemplateId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Tunnel public — création + suivi de paiement ─────────────────── */

export interface CreateRegistrationInput {
  seasonId: string;
  programId: string | null;
  categoryId: string | null;
  timeSlotTemplateId: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  city: string | null;
  playerFirstName: string | null;
  playerLastName: string | null;
  playerDob: string | null;
  advancedGroup: boolean;
  isTrial: boolean;
  /** Statut initial — "pending" par défaut (voir createRegistration). */
  status?: RegistrationStatus;
  /** Trace la provenance quand cette inscription a été créée en transférant
   *  un lead Été 2026 vers cette saison (voir transferLeadToSeason). */
  transferredFromLeadId?: string | null;
}

export async function createRegistration(input: CreateRegistrationInput): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      season_id: input.seasonId,
      program_id: input.programId,
      category_id: input.categoryId,
      time_slot_template_id: input.timeSlotTemplateId,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      parent_phone: input.parentPhone,
      city: input.city,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      player_dob: input.playerDob,
      advanced_group: input.advancedGroup,
      is_trial: input.isTrial,
      status: input.status ?? "pending",
      transferred_from_lead_id: input.transferredFromLeadId ?? null
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Inscription à la liste d'attente — programme/catégorie complet, aucun
 *  paiement demandé. Le parent est contacté manuellement dès qu'une place
 *  se libère (changement de statut depuis l'admin). */
export async function createWaitlistRegistration(input: CreateRegistrationInput): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      season_id: input.seasonId,
      program_id: input.programId,
      category_id: input.categoryId,
      time_slot_template_id: input.timeSlotTemplateId,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      parent_phone: input.parentPhone,
      city: input.city,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      player_dob: input.playerDob,
      advanced_group: input.advancedGroup,
      is_trial: false,
      status: "waitlist"
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setRegistrationCheckoutSession(id: string, checkoutSessionId: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("registrations")
    .update({ stripe_checkout_session_id: checkoutSessionId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cancelRegistration(id: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("registrations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markRegistrationPaidByCheckoutSession(
  checkoutSessionId: string,
  paymentIntentId: string | undefined
): Promise<Registration | null> {
  const supabase = db();
  const { data, error } = await supabase
    .from("registrations")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Registration | null;
}

/* ── Paiements échelonnés (2-3 fois) ─────────────────────────────
 *  Le 1er versement est payé via la session Stripe Checkout initiale ; les
 *  suivants sont prélevés automatiquement par /api/cron/charge-installments
 *  sur la carte enregistrée (setup_future_usage: "off_session"). Voir
 *  src/lib/payment-plan.ts pour le calcul des dates/montants. */

export interface CreatePaymentPlanInstallmentInput {
  sequenceNo: number;
  amountCents: number;
  dueDate: string; // 'YYYY-MM-DD'
}

export interface CreatePaymentPlanInput {
  registrationId: string;
  totalAmountCents: number;
  installments: CreatePaymentPlanInstallmentInput[];
}

export async function createPaymentPlan(input: CreatePaymentPlanInput): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("registration_payment_plans")
    .insert({
      registration_id: input.registrationId,
      total_amount_cents: input.totalAmountCents,
      installment_count: input.installments.length
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const planId = data.id as string;

  const rows = input.installments.map((inst) => ({
    plan_id: planId,
    sequence_no: inst.sequenceNo,
    amount_cents: inst.amountCents,
    due_date: inst.dueDate
  }));
  const { error: instError } = await supabase.from("registration_payment_plan_installments").insert(rows);
  if (instError) throw new Error(instError.message);

  return planId;
}

/** Supprime un plan créé mais jamais activé (ex. la session Stripe échoue à
 *  se créer) — miroir de cancelRegistration/cancelOrder pour ce cas. */
export async function deletePaymentPlan(planId: string): Promise<void> {
  const supabase = db();
  await supabase.from("registration_payment_plan_installments").delete().eq("plan_id", planId);
  await supabase.from("registration_payment_plans").delete().eq("id", planId);
}

/** Active le plan une fois le 1er versement confirmé par le webhook Stripe :
 *  enregistre la carte (client + méthode de paiement) pour les prélèvements
 *  automatiques futurs, et marque l'installment #1 comme payé. */
export async function activatePaymentPlan(
  planId: string,
  input: { stripeCustomerId: string; stripePaymentMethodId: string; firstInstallmentPaymentIntentId: string | undefined }
): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("registration_payment_plans")
    .update({ stripe_customer_id: input.stripeCustomerId, stripe_payment_method_id: input.stripePaymentMethodId })
    .eq("id", planId);
  if (error) throw new Error(error.message);

  const { error: instError } = await supabase
    .from("registration_payment_plan_installments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: input.firstInstallmentPaymentIntentId ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("plan_id", planId)
    .eq("sequence_no", 1);
  if (instError) throw new Error(instError.message);
}

export interface SeasonPaidInstallment {
  registration_id: string;
  amount_cents: number;
  paid_at: string;
}

/** Chaque versement réellement encaissé (status = 'paid') d'un plan de
 *  paiement échelonné de la saison, avec sa date exacte de prélèvement —
 *  utilisé par le calculateur de revenus, qui compte l'argent en banque
 *  (pas le prix de vente théorique du plan) et le répartit par mois. */
export async function getSeasonPaidInstallments(seasonId: string): Promise<SeasonPaidInstallment[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("registration_payment_plan_installments")
    .select(`
      amount_cents, paid_at, status,
      registration_payment_plans!inner (
        registration_id,
        registrations!inner ( season_id )
      )
    `)
    .eq("status", "paid")
    .eq("registration_payment_plans.registrations.season_id", seasonId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    registration_id: row.registration_payment_plans.registration_id,
    amount_cents: row.amount_cents,
    paid_at: row.paid_at
  }));
}

export interface PaymentPlanInstallmentOverview {
  sequenceNo: number;
  amountCents: number;
  dueDate: string;
  status: "pending" | "paid" | "failed" | "failed_final";
  paidAt: string | null;
}

export interface PaymentPlanOverview {
  planId: string;
  registrationId: string;
  seasonId: string;
  programId: string | null;
  parentName: string;
  parentEmail: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  totalAmountCents: number;
  installmentCount: number;
  createdAt: string;
  installments: PaymentPlanInstallmentOverview[];
}

/** Tous les plans de paiement échelonné (toutes saisons), avec le détail de
 *  chaque versement — pour la vue admin "quel parent a choisi de payer en
 *  plusieurs fois", absente jusqu'ici. Deux requêtes + fusion en mémoire
 *  (plutôt qu'un select imbriqué) pour rester cohérent avec le style du
 *  reste du fichier. */
/** Ne renvoie que les plans réellement activés par un vrai paiement Stripe
 *  (stripe_customer_id posé uniquement par le webhook, jamais à la main) —
 *  exclut les paniers abandonnés avant paiement (inscription annulée,
 *  premier versement jamais prélevé, qui restaient affichés "0/N" pour
 *  toujours). Un plan sans transaction Stripe confirmée n'est pas un
 *  paiement. */
export async function getAllPaymentPlansOverview(): Promise<PaymentPlanOverview[]> {
  const supabase = db();
  const { data: plans, error } = await supabase
    .from("registration_payment_plans")
    .select(`
      id, registration_id, total_amount_cents, installment_count, created_at, stripe_customer_id,
      registrations!inner ( season_id, program_id, parent_name, parent_email, player_first_name, player_last_name )
    `)
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!plans || plans.length === 0) return [];

  const planIds = (plans as any[]).map((p) => p.id);
  const { data: installments, error: instError } = await supabase
    .from("registration_payment_plan_installments")
    .select("plan_id, sequence_no, amount_cents, due_date, status, paid_at")
    .in("plan_id", planIds)
    .order("sequence_no", { ascending: true });
  if (instError) throw new Error(instError.message);

  const installmentsByPlan = new Map<string, PaymentPlanInstallmentOverview[]>();
  for (const inst of (installments ?? []) as any[]) {
    const list = installmentsByPlan.get(inst.plan_id) ?? [];
    list.push({ sequenceNo: inst.sequence_no, amountCents: inst.amount_cents, dueDate: inst.due_date, status: inst.status, paidAt: inst.paid_at });
    installmentsByPlan.set(inst.plan_id, list);
  }

  return (plans as any[]).map((p) => ({
    planId: p.id,
    registrationId: p.registration_id,
    seasonId: p.registrations.season_id,
    programId: p.registrations.program_id,
    parentName: p.registrations.parent_name,
    parentEmail: p.registrations.parent_email,
    playerFirstName: p.registrations.player_first_name,
    playerLastName: p.registrations.player_last_name,
    totalAmountCents: p.total_amount_cents,
    installmentCount: p.installment_count,
    createdAt: p.created_at,
    installments: installmentsByPlan.get(p.id) ?? []
  }));
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

/** Versements dus aujourd'hui (ou en retard), hors 1er versement (déjà payé
 *  via Stripe Checkout à l'inscription) et hors ceux ayant atteint le nombre
 *  maximal de tentatives — utilisé par /api/cron/charge-installments. */
export async function getDueInstallments(): Promise<DueInstallment[]> {
  const supabase = db();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("registration_payment_plan_installments")
    .select(`
      id, plan_id, sequence_no, amount_cents, attempt_count,
      registration_payment_plans!inner (
        stripe_customer_id, stripe_payment_method_id, installment_count,
        registrations!inner ( parent_name, parent_email )
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
    stripe_customer_id: row.registration_payment_plans.stripe_customer_id,
    stripe_payment_method_id: row.registration_payment_plans.stripe_payment_method_id,
    installment_count: row.registration_payment_plans.installment_count,
    parent_name: row.registration_payment_plans.registrations.parent_name,
    parent_email: row.registration_payment_plans.registrations.parent_email
  }));
}

export async function markInstallmentPaid(id: string, stripePaymentIntentId: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("registration_payment_plan_installments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: stripePaymentIntentId,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Incrémente le compteur de tentatives et bascule en `failed_final` au-delà
 *  du maximum. Retourne de quoi décider s'il faut aviser l'académie (premier
 *  échec ou tentative finale seulement — pas à chaque réessai). */
export async function markInstallmentFailed(
  id: string,
  currentAttemptCount: number
): Promise<{ attemptCount: number; isFinal: boolean; wasFirstFailure: boolean }> {
  const supabase = db();
  const attemptCount = currentAttemptCount + 1;
  const isFinal = attemptCount >= MAX_INSTALLMENT_ATTEMPTS;
  const wasFirstFailure = currentAttemptCount === 0;

  const { error } = await supabase
    .from("registration_payment_plan_installments")
    .update({
      attempt_count: attemptCount,
      status: isFinal ? "failed_final" : "failed",
      failure_notified: true,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  return { attemptCount, isFinal, wasFirstFailure };
}

/** Compte les inscriptions actives (hors annulées) pour une combinaison
 *  programme × catégorie, utilisé pour vérifier la capacité avant paiement. */
export async function countActiveRegistrations(
  seasonId: string,
  filter: { programId?: string; categoryId?: string; timeSlotTemplateId?: string }
): Promise<number> {
  const supabase = db();
  let query = supabase.from("registrations").select("id", { count: "exact", head: true }).eq("season_id", seasonId).neq("status", "cancelled");
  if (filter.programId) query = query.eq("program_id", filter.programId);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.timeSlotTemplateId) query = query.eq("time_slot_template_id", filter.timeSlotTemplateId);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Nombre d'inscriptions payées (hors essais) pour une saison — utilisé pour
 *  déterminer si un nouveau client fait partie des N premiers clients éligibles
 *  à une offre de lancement (ex. sac gratuit). */
export async function countPaidRegistrations(seasonId: string): Promise<number> {
  const { count, error } = await db()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId)
    .eq("status", "paid")
    .eq("is_trial", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/* ── Séances individuelles (solo) — programmes SV/SVA ─────────────
 *  Système séparé des plages de pratique technique : rotation de groupes
 *  (ex. 4 joueuses aux 2 semaines) avec calendrier de dates précises. */

export interface SoloGroup {
  id: string;
  season_id: string;
  label: string;
  day: string;
  start_time: string;
  end_time: string;
  location: string;
  max_places: number;
  active: boolean;
  display_order: number;
}

export interface SoloGroupDate {
  id: string;
  solo_group_id: string;
  occurs_on: string;
  cancelled: boolean;
}

export interface SoloGroupMember {
  id: string;
  solo_group_id: string;
  registration_id: string;
  created_at: string;
}

export async function getSoloGroups(seasonId: string): Promise<SoloGroup[]> {
  const { data, error } = await db()
    .from("solo_groups")
    .select("*")
    .eq("season_id", seasonId)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloGroup[];
}

export async function createSoloGroup(
  seasonId: string,
  input: { label: string; day: string; startTime: string; endTime: string; location: string; maxPlaces: number; displayOrder?: number }
): Promise<string> {
  const { data, error } = await db()
    .from("solo_groups")
    .insert({
      season_id: seasonId,
      label: input.label,
      day: input.day,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      max_places: input.maxPlaces,
      display_order: input.displayOrder ?? 0
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateSoloGroup(
  id: string,
  patch: Partial<{ label: string; day: string; startTime: string; endTime: string; location: string; maxPlaces: number; active: boolean; displayOrder: number }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) columnPatch.label = patch.label;
  if (patch.day !== undefined) columnPatch.day = patch.day;
  if (patch.startTime !== undefined) columnPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) columnPatch.end_time = patch.endTime;
  if (patch.location !== undefined) columnPatch.location = patch.location;
  if (patch.maxPlaces !== undefined) columnPatch.max_places = patch.maxPlaces;
  if (patch.active !== undefined) columnPatch.active = patch.active;
  if (patch.displayOrder !== undefined) columnPatch.display_order = patch.displayOrder;

  const { error } = await db().from("solo_groups").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSoloGroup(id: string): Promise<void> {
  const { error } = await db().from("solo_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getSoloGroupDates(groupId: string): Promise<SoloGroupDate[]> {
  const { data, error } = await db()
    .from("solo_group_dates")
    .select("*")
    .eq("solo_group_id", groupId)
    .order("occurs_on", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SoloGroupDate[];
}

export async function getSeasonSoloGroupDates(seasonId: string): Promise<Record<string, SoloGroupDate[]>> {
  const groups = await getSoloGroups(seasonId);
  if (groups.length === 0) return {};
  const { data, error } = await db()
    .from("solo_group_dates")
    .select("*")
    .in("solo_group_id", groups.map((g) => g.id))
    .order("occurs_on", { ascending: true });
  if (error) throw new Error(error.message);
  const byGroup: Record<string, SoloGroupDate[]> = {};
  for (const d of (data ?? []) as SoloGroupDate[]) {
    const list = byGroup[d.solo_group_id] ?? [];
    list.push(d);
    byGroup[d.solo_group_id] = list;
  }
  return byGroup;
}

export async function addSoloGroupDate(groupId: string, occursOn: string): Promise<string> {
  const { data, error } = await db()
    .from("solo_group_dates")
    .insert({ solo_group_id: groupId, occurs_on: occursOn })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function removeSoloGroupDate(dateId: string): Promise<void> {
  const { error } = await db().from("solo_group_dates").delete().eq("id", dateId);
  if (error) throw new Error(error.message);
}

export async function getSoloGroupMembers(seasonId: string): Promise<Record<string, SoloGroupMember[]>> {
  const groups = await getSoloGroups(seasonId);
  if (groups.length === 0) return {};
  const { data, error } = await db()
    .from("solo_group_members")
    .select("*")
    .in("solo_group_id", groups.map((g) => g.id));
  if (error) throw new Error(error.message);
  const byGroup: Record<string, SoloGroupMember[]> = {};
  for (const m of (data ?? []) as SoloGroupMember[]) {
    const list = byGroup[m.solo_group_id] ?? [];
    list.push(m);
    byGroup[m.solo_group_id] = list;
  }
  return byGroup;
}

export async function assignRegistrationToSoloGroup(groupId: string, registrationId: string): Promise<void> {
  const supabase = db();
  await supabase.from("solo_group_members").delete().eq("registration_id", registrationId);
  const { error } = await supabase.from("solo_group_members").insert({ solo_group_id: groupId, registration_id: registrationId });
  if (error) throw new Error(error.message);
}

export async function removeSoloGroupMember(memberId: string): Promise<void> {
  const { error } = await db().from("solo_group_members").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
}

/** Inscriptions SV/SVA actives, sans groupe solo assigné — bassin à répartir. */
export async function getUnassignedSoloEligibleRegistrations(seasonId: string): Promise<Registration[]> {
  const supabase = db();
  const [{ data: registrations, error }, { data: members, error: memberErr }] = await Promise.all([
    supabase
      .from("registrations")
      .select("*")
      .eq("season_id", seasonId)
      .in("program_id", ["SV", "SVA"])
      .neq("status", "cancelled"),
    supabase.from("solo_group_members").select("registration_id")
  ]);
  if (error) throw new Error(error.message);
  if (memberErr) throw new Error(memberErr.message);

  const assignedIds = new Set((members ?? []).map((m: { registration_id: string }) => m.registration_id));
  return ((registrations ?? []) as Registration[]).filter((r) => !assignedIds.has(r.id));
}
