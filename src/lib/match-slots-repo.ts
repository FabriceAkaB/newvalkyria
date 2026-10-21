import { checkEligibility, expandDoubles, type CategoryRule, type SlotGender, type TeamGender } from "@/lib/match-slots-core";
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
  /** Acompte payé en ligne pour réserver la plage. */
  price_cents: number;
  /** Solde payable le jour du match. */
  balance_due_cents: number;
  match_format: string | null;
  /** Adversaire annoncé (ex. « New Valkyria U12 féminin (2014) »). */
  opponent: string | null;
  allowed_gender: SlotGender;
  birth_year_min: number | null;
  birth_year_max: number | null;
  restriction_note: string | null;
  /** Catégories admises (genre + années) ; remplace les colonnes simples quand elle est remplie. */
  allowed_categories: CategoryRule[] | null;
  /** Précision positive (p. ex. « Équipe 2014 recherchée »). */
  preferred_note: string | null;
  /** Les équipes non admissibles d'office peuvent faire une demande à approuver. */
  allow_requests: boolean;
  /** Deux plages (ou plus) partageant ce code forment une double cédule, réservée en bloc. */
  double_group: string | null;
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
  balance_due_cents: number;
  balance_paid_at: string | null;
  team_gender: TeamGender | null;
  team_birth_year: number | null;
  team_birth_year_to: number | null;
  team_level: string | null;
  team_players: number | null;
  team_profile_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  reservation_expires_at: string | null;
  confirmation_sent_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
}

export { TEAM_LEVELS } from "@/lib/match-slots-core";

export interface MatchTeamProfile {
  id: string;
  org_name: string;
  org_key: string;
  team_label: string;
  team_gender: TeamGender;
  team_birth_year: number;
  /** Groupe de deux années (ex. 2014-2015) : année la plus récente ; nul = une seule année. */
  team_birth_year_to: number | null;
  team_level: string;
  team_players: number | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string | null;
  /** Lien personnel : /prive/matchs?equipe=<access_token> — l'équipe n'a pas à refaire le formulaire. */
  access_token: string;
  created_at: string;
}

export interface TeamProfileInput {
  orgName: string;
  teamLabel: string;
  teamGender: TeamGender;
  teamBirthYear: number;
  teamBirthYearTo: number | null;
  teamLevel: string;
  teamPlayers: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string | null;
}

/** Enregistre (ou met à jour) le formulaire « Votre équipe » : étape obligatoire avant de choisir une plage. */
export async function saveTeamProfile(input: TeamProfileInput): Promise<MatchTeamProfile> {
  const key = orgKey(input.orgName);
  if (!key) throw new MatchConflictError("Nom d'organisation invalide.");
  const email = input.contactEmail.trim();
  const { data: existing } = await db()
    .from("match_team_profiles")
    .select("id")
    .ilike("contact_email", email)
    .eq("org_key", key)
    .eq("team_gender", input.teamGender)
    .eq("team_birth_year", input.teamBirthYear)
    .eq("team_birth_year_to", input.teamBirthYearTo ?? input.teamBirthYear)
    .ilike("team_label", input.teamLabel.trim())
    .maybeSingle();
  const row = {
    org_name: input.orgName,
    org_key: key,
    team_label: input.teamLabel,
    team_gender: input.teamGender,
    team_birth_year: input.teamBirthYear,
    team_birth_year_to: input.teamBirthYearTo ?? input.teamBirthYear,
    team_level: input.teamLevel,
    team_players: input.teamPlayers,
    contact_name: input.contactName,
    contact_email: email,
    contact_phone: input.contactPhone,
    notes: input.notes,
    updated_at: new Date().toISOString()
  };
  const q = existing?.id ? db().from("match_team_profiles").update(row).eq("id", existing.id) : db().from("match_team_profiles").insert(row);
  const { data, error } = await q.select("*").single();
  if (error) throw new Error(error.message);
  return data as MatchTeamProfile;
}

export async function getTeamProfileByToken(token: string): Promise<MatchTeamProfile | null> {
  if (!/^[a-f0-9]{30,64}$/i.test(token)) return null;
  const { data } = await db().from("match_team_profiles").select("*").eq("access_token", token).maybeSingle();
  return (data as MatchTeamProfile | null) ?? null;
}

export async function getTeamProfile(id: string): Promise<MatchTeamProfile | null> {
  const { data } = await db().from("match_team_profiles").select("*").eq("id", id).maybeSingle();
  return (data as MatchTeamProfile | null) ?? null;
}

export async function getAllTeamProfiles(): Promise<MatchTeamProfile[]> {
  const { data, error } = await db().from("match_team_profiles").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchTeamProfile[];
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
  teamGender: TeamGender;
  teamBirthYear: number;
  teamBirthYearTo?: number | null;
  /** Formulaire « Votre équipe » rempli au préalable (obligatoire). */
  profileId: string;
  notes: string | null;
}

/** Réserve 1 ou 2 plages d'un coup (une double cédule se réserve toujours en bloc).
 *  Toutes les règles sont vérifiées côté serveur : plage existante/active/libre,
 *  admissibilité de la catégorie de l'équipe, 2 plages maximum par équipe, jamais de doublon. */
export async function reserveSlots(input: ReserveInput): Promise<{ bookings: MatchBooking[]; slots: MatchSlot[]; totalCents: number; depositCents: number; balanceCents: number }> {
  let slotIds = Array.from(new Set(input.slotIds));
  if (slotIds.length === 0) throw new MatchConflictError("Choisissez au moins une plage.");

  // Le formulaire de l'équipe doit exister et correspondre à la catégorie/au contact de la demande.
  const profile = await getTeamProfile(input.profileId);
  if (
    !profile ||
    profile.team_gender !== input.teamGender ||
    profile.team_birth_year !== input.teamBirthYear ||
    (profile.team_birth_year_to ?? profile.team_birth_year) !== (input.teamBirthYearTo ?? input.teamBirthYear) ||
    profile.contact_email.trim().toLowerCase() !== input.contactEmail.trim().toLowerCase()
  ) {
    throw new MatchConflictError("Remplissez d'abord le formulaire de votre équipe avant de choisir une plage.");
  }

  // Double cédule : on ajoute automatiquement l'autre moitié du bloc.
  {
    const { data: picked, error: pickErr } = await db().from("match_slots").select("id, double_group").in("id", slotIds);
    if (pickErr) throw new Error(pickErr.message);
    const groups = Array.from(new Set((picked ?? []).map((p: any) => p.double_group).filter(Boolean)));
    if (groups.length > 0) {
      const { data: siblings } = await db().from("match_slots").select("id, double_group").in("double_group", groups);
      slotIds = expandDoubles(slotIds, [...(picked ?? []), ...(siblings ?? [])]);
    }
  }
  if (slotIds.length > MAX_SLOTS_PER_TEAM) throw new MatchConflictError(`Une équipe ne peut réserver que ${MAX_SLOTS_PER_TEAM} plages (une double cédule compte pour 2).`);

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

  const { data: approvedReqs } = await db().from("match_slot_requests").select("slot_id").eq("profile_id", profile.id).eq("status", "approved");
  const approvedSlotIds = new Set<string>((approvedReqs ?? []).map((r: any) => r.slot_id));
  const { data: slots, error } = await db().from("match_slots").select("*").in("id", slotIds);
  if (error) throw new Error(error.message);
  const today = new Date().toISOString().slice(0, 10);
  if ((slots ?? []).length !== slotIds.length) throw new MatchConflictError("Une des plages n'existe plus.");
  for (const s of slots as MatchSlot[]) {
    if (!s.active || s.slot_date < today) throw new MatchConflictError("Une des plages n'est plus offerte.");
    const elig = checkEligibility(s, { gender: input.teamGender, birthYear: input.teamBirthYear, birthYearTo: input.teamBirthYearTo ?? input.teamBirthYear, level: profile.team_level });
    // Une équipe non admissible d'office peut réserver si sa demande pour cette plage a été approuvée.
    if (!elig.ok && approvedSlotIds.has(s.id)) continue;
    if (!elig.ok) throw new MatchConflictError(`${new Date(s.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}, ${s.start_time} : ${elig.reason}`);
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
        balance_due_cents: s.balance_due_cents,
        team_gender: input.teamGender,
        team_birth_year: input.teamBirthYear,
        team_birth_year_to: input.teamBirthYearTo ?? input.teamBirthYear,
        team_level: profile.team_level,
        team_players: profile.team_players,
        team_profile_id: profile.id,
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

  const depositCents = created.reduce((n, b) => n + b.price_cents, 0);
  const balanceCents = created.reduce((n, b) => n + b.balance_due_cents, 0);
  return { bookings: created, slots: slots as MatchSlot[], totalCents: depositCents, depositCents, balanceCents };
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

/** Données du courriel de confirmation à partir de réservations (avec leur plage). */
export function toEmailSlots(bookings: (MatchBooking & { slot: MatchSlot })[]) {
  return bookings.map((b) => ({
    date: b.slot.slot_date,
    start: b.slot.start_time,
    end: b.slot.end_time,
    location: b.slot.location,
    format: b.slot.match_format,
    opponent: b.slot.opponent,
    double: Boolean(b.slot.double_group),
    depositCents: b.price_cents,
    balanceCents: b.balance_due_cents
  }));
}

/* ── Demandes de match (équipes non admissibles d'office) ── */

export interface MatchSlotRequest {
  id: string;
  slot_id: string;
  profile_id: string;
  status: "pending" | "approved" | "declined";
  message: string | null;
  decided_at: string | null;
  created_at: string;
}

export async function getRequestsForProfile(profileId: string): Promise<MatchSlotRequest[]> {
  const { data } = await db().from("match_slot_requests").select("*").eq("profile_id", profileId);
  return (data ?? []) as MatchSlotRequest[];
}

/** Crée (ou relance) la demande d'une équipe pour une plage — une double cédule = toutes ses plages. */
export async function createSlotRequests(profileId: string, slotIds: string[], message: string | null): Promise<MatchSlot[]> {
  const { data: picked } = await db().from("match_slots").select("*").in("id", slotIds);
  const groups = Array.from(new Set((picked ?? []).map((p: any) => p.double_group).filter(Boolean)));
  let all = (picked ?? []) as MatchSlot[];
  if (groups.length) {
    const { data: siblings } = await db().from("match_slots").select("*").in("double_group", groups);
    all = [...all, ...((siblings ?? []) as MatchSlot[])];
  }
  const unique = Array.from(new Map(all.map((s) => [s.id, s])).values());
  for (const s of unique) {
    if (!s.active) throw new MatchConflictError("Une des plages n'est plus offerte.");
    if (!s.allow_requests) throw new MatchConflictError("Cette plage n'accepte pas de demande : elle est réservée à une catégorie précise.");
  }
  for (const s of unique) {
    const { data: existing } = await db().from("match_slot_requests").select("id, status").eq("slot_id", s.id).eq("profile_id", profileId).maybeSingle();
    if (existing?.status === "approved") continue;
    if (existing) await db().from("match_slot_requests").update({ status: "pending", message, decided_at: null, created_at: new Date().toISOString() }).eq("id", existing.id);
    else await db().from("match_slot_requests").insert({ slot_id: s.id, profile_id: profileId, message });
  }
  return unique;
}

export async function getAllSlotRequests(): Promise<(MatchSlotRequest & { slot: MatchSlot; profile: MatchTeamProfile })[]> {
  const { data, error } = await db().from("match_slot_requests").select("*, slot:match_slots(*), profile:match_team_profiles(*)").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as (MatchSlotRequest & { slot: MatchSlot; profile: MatchTeamProfile })[];
}

/** Approuve ou refuse une demande (toutes les plages d'une même double cédule ensemble). */
export async function decideSlotRequest(requestId: string, status: "approved" | "declined"): Promise<(MatchSlotRequest & { slot: MatchSlot; profile: MatchTeamProfile })[]> {
  const { data: req } = await db().from("match_slot_requests").select("*, slot:match_slots(*)").eq("id", requestId).maybeSingle();
  if (!req) throw new Error("Demande introuvable.");
  let slotIds = [req.slot_id];
  if (req.slot?.double_group) {
    const { data: siblings } = await db().from("match_slots").select("id").eq("double_group", req.slot.double_group);
    slotIds = (siblings ?? []).map((s: any) => s.id);
  }
  const { data } = await db()
    .from("match_slot_requests")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("profile_id", req.profile_id)
    .in("slot_id", slotIds)
    .select("*, slot:match_slots(*), profile:match_team_profiles(*)");
  return (data ?? []) as (MatchSlotRequest & { slot: MatchSlot; profile: MatchTeamProfile })[];
}
