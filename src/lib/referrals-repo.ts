import { normalizeName } from "@/lib/private-programs-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const REFERRAL_CREDIT_CENTS = 5000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter les erreurs de lecture

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function isRealEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  return Boolean(e) && e.includes("@") && !e.endsWith("@newvalkyria.temp");
}

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

/* ── Codes de référencement ─────────────────────────────────────── */

export interface ReferralCode {
  code: string;
  family_email: string;
  family_name: string | null;
  created_at: string;
}

/** Un code unique et permanent par famille (clé = courriel du parent). */
export async function getOrCreateReferralCode(email: string, familyName?: string | null): Promise<ReferralCode> {
  const supabase = db();
  const key = normalizeEmail(email);
  if (!isRealEmail(key)) throw new Error("Courriel invalide pour le code de référencement.");

  const { data: existing } = await supabase.from("referral_codes").select("*").eq("family_email", key).maybeSingle();
  if (existing) {
    if (!existing.family_name && familyName) await supabase.from("referral_codes").update({ family_name: familyName }).eq("code", existing.code);
    return existing as ReferralCode;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const { data, error } = await supabase.from("referral_codes").insert({ code, family_email: key, family_name: familyName ?? null }).select("*").single();
    if (!error) return data as ReferralCode;
    if (error.code === "23505") {
      // Soit le code existe déjà (on réessaie), soit une autre requête vient de créer la famille.
      const { data: raced } = await supabase.from("referral_codes").select("*").eq("family_email", key).maybeSingle();
      if (raced) return raced as ReferralCode;
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error("Impossible de générer un code de référencement.");
}

export async function findCode(code: string): Promise<ReferralCode | null> {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const { data, error } = await db().from("referral_codes").select("*").eq("code", clean).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ReferralCode | null;
}

/* ── Recherche de familles existantes ───────────────────────────── */

export interface FamilyMatch {
  email: string;
  name: string;
}

/** Une famille existe si ce courriel apparaît dans une inscription connue. */
export async function findFamilyByEmail(email: string): Promise<FamilyMatch | null> {
  const supabase = db();
  const key = normalizeEmail(email);
  if (!isRealEmail(key)) return null;

  const code = await supabase.from("referral_codes").select("family_email, family_name").eq("family_email", key).maybeSingle();
  if (code.data) return { email: key, name: code.data.family_name ?? key };

  const [reg, spr, se, lead] = await Promise.all([
    supabase.from("registrations").select("parent_name").ilike("parent_email", key).limit(1),
    supabase.from("session_program_registrations").select("parent_name").ilike("parent_email", key).limit(1),
    supabase.from("sport_etudes_registrations").select("parent_first_name, parent_last_name").ilike("parent_email", key).limit(1),
    supabase.from("leads").select("parent_name").ilike("email", key).limit(1)
  ]);
  const name =
    reg.data?.[0]?.parent_name ??
    spr.data?.[0]?.parent_name ??
    (se.data?.[0] ? `${se.data[0].parent_first_name} ${se.data[0].parent_last_name}` : null) ??
    lead.data?.[0]?.parent_name ??
    null;
  return name ? { email: key, name: String(name).trim() } : null;
}

/** Familles dont le nom de parent correspond (sans tenir compte des accents ni de l'ordre). */
export async function findFamiliesByName(fullName: string): Promise<FamilyMatch[]> {
  const tokens = normalizeName(fullName).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  const supabase = db();
  const pattern = `%${longest}%`;

  const [reg, spr, se, lead, codes] = await Promise.all([
    supabase.from("registrations").select("parent_name, parent_email").ilike("parent_name", pattern).neq("status", "cancelled").limit(200),
    supabase.from("session_program_registrations").select("parent_name, parent_email").ilike("parent_name", pattern).neq("status", "cancelled").limit(200),
    supabase.from("sport_etudes_registrations").select("parent_first_name, parent_last_name, parent_email").or(`parent_first_name.ilike.${pattern},parent_last_name.ilike.${pattern}`).neq("status", "cancelled").limit(200),
    supabase.from("leads").select("parent_name, email").ilike("parent_name", pattern).neq("status", "cancelled").limit(200),
    supabase.from("referral_codes").select("family_name, family_email").ilike("family_name", pattern).limit(200)
  ]);

  const rows: { name: string; email: string }[] = [
    ...(reg.data ?? []).map((r: any) => ({ name: r.parent_name, email: r.parent_email })),
    ...(spr.data ?? []).map((r: any) => ({ name: r.parent_name, email: r.parent_email })),
    ...(se.data ?? []).map((r: any) => ({ name: `${r.parent_first_name} ${r.parent_last_name}`, email: r.parent_email })),
    ...(lead.data ?? []).map((r: any) => ({ name: r.parent_name, email: r.email })),
    ...(codes.data ?? []).map((r: any) => ({ name: r.family_name, email: r.family_email }))
  ];

  const want = [...tokens].sort().join(" ");
  const byEmail = new Map<string, FamilyMatch>();
  for (const r of rows) {
    if (!r.name || !isRealEmail(r.email)) continue;
    const got = normalizeName(r.name).split(" ").filter(Boolean).sort().join(" ");
    if (got === want) byEmail.set(normalizeEmail(r.email), { email: normalizeEmail(r.email), name: String(r.name).trim() });
  }
  return Array.from(byEmail.values());
}

/* ── Résolution d'une recommandation ────────────────────────────── */

export type MatchMethod = "code" | "courriel" | "nom" | "ambigu" | "aucune";

export interface ReferralInput {
  /** Valeur saisie ou issue du lien (?ref=) — un code ou un courriel. */
  codeOrEmail?: string | null;
  referrerName?: string | null;
  referrerPlayer?: string | null;
  /** Famille qui s'inscrit (pour refuser l'auto-recommandation). */
  parentEmail: string;
  parentName: string;
}

export interface ReferralResolution {
  matchMethod: MatchMethod;
  referrer: { email: string; name: string; code: string | null } | null;
  /** Le rabais est accordé tout de suite (référent identifié). */
  discountEligible: boolean;
  /** La récompense attend la confirmation d'un administrateur. */
  needsVerification: boolean;
  selfReferral: boolean;
  candidates: FamilyMatch[];
}

export async function resolveReferral(input: ReferralInput): Promise<ReferralResolution> {
  const own = normalizeEmail(input.parentEmail);
  const base: ReferralResolution = { matchMethod: "aucune", referrer: null, discountEligible: false, needsVerification: true, selfReferral: false, candidates: [] };
  const raw = (input.codeOrEmail ?? "").trim();

  // 1) Code de référencement (lien personnel)
  if (raw && !raw.includes("@")) {
    const code = await findCode(raw);
    if (code) {
      if (normalizeEmail(code.family_email) === own) return { ...base, selfReferral: true };
      return {
        matchMethod: "code",
        referrer: { email: code.family_email, name: code.family_name ?? code.family_email, code: code.code },
        discountEligible: true,
        needsVerification: false,
        selfReferral: false,
        candidates: []
      };
    }
  }

  // 2) Courriel du parent référent
  if (raw.includes("@")) {
    const family = await findFamilyByEmail(raw);
    if (family) {
      if (family.email === own) return { ...base, selfReferral: true };
      const code = await getOrCreateReferralCode(family.email, family.name).catch(() => null);
      return { matchMethod: "courriel", referrer: { email: family.email, name: family.name, code: code?.code ?? null }, discountEligible: true, needsVerification: false, selfReferral: false, candidates: [] };
    }
  }

  // 3) Nom du parent référent — jamais confirmé automatiquement
  const name = (input.referrerName ?? "").trim();
  if (name) {
    if (normalizeName(name) === normalizeName(input.parentName)) return { ...base, selfReferral: true };
    const matches = (await findFamiliesByName(name)).filter((m) => m.email !== own);
    if (matches.length === 1) {
      const code = await getOrCreateReferralCode(matches[0].email, matches[0].name).catch(() => null);
      return { matchMethod: "nom", referrer: { ...matches[0], code: code?.code ?? null }, discountEligible: true, needsVerification: true, selfReferral: false, candidates: matches };
    }
    if (matches.length > 1) return { ...base, matchMethod: "ambigu", candidates: matches };
  }

  return base;
}

/* ── Registre de crédits ────────────────────────────────────────── */

export type LedgerKind = "recompense" | "utilisation" | "annulation_utilisation" | "correction" | "rabais_verification";

export interface LedgerEntry {
  id: string;
  family_email: string;
  delta_cents: number;
  kind: LedgerKind;
  referral_id: string | null;
  registration_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export async function getCreditBalance(email: string): Promise<number> {
  const { data, error } = await db().from("family_credit_ledger").select("delta_cents").eq("family_email", normalizeEmail(email));
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum: number, r: { delta_cents: number }) => sum + r.delta_cents, 0);
}

export async function addLedgerEntry(input: {
  email: string;
  deltaCents: number;
  kind: LedgerKind;
  referralId?: string | null;
  registrationId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const { error } = await db().from("family_credit_ledger").insert({
    family_email: normalizeEmail(input.email),
    delta_cents: input.deltaCents,
    kind: input.kind,
    referral_id: input.referralId ?? null,
    registration_id: input.registrationId ?? null,
    note: input.note ?? null,
    created_by: input.createdBy ?? null
  });
  if (error) throw new Error(error.message);
}

export async function getLedgerForFamily(email: string): Promise<LedgerEntry[]> {
  const { data, error } = await db().from("family_credit_ledger").select("*").eq("family_email", normalizeEmail(email)).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerEntry[];
}

export async function logReferralAudit(referralId: string | null, action: string, actor: string | null, detail?: Record<string, unknown>): Promise<void> {
  await db().from("referral_audit").insert({ referral_id: referralId, action, actor, detail: detail ?? null });
}

/* ── Recommandations ────────────────────────────────────────────── */

export interface ProgramReferral {
  id: string;
  registration_id: string;
  program_slug: string;
  referrer_code: string | null;
  referrer_email: string | null;
  referrer_name: string | null;
  claimed_referrer_name: string | null;
  claimed_player_name: string | null;
  claimed_contact: string | null;
  match_method: MatchMethod;
  status: "a_verifier" | "confirme" | "valide" | "rejete" | "annule";
  discount_cents: number;
  reward_status: "aucune" | "a_choisir" | "sac_a_remettre" | "sac_remis" | "credit_accorde" | "annulee";
  reward_choice: "sac" | "credit" | null;
  reward_chosen_at: string | null;
  bag_delivered_at: string | null;
  bag_delivered_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProgramReferral(input: {
  registrationId: string;
  programSlug: string;
  resolution: ReferralResolution;
  claimedReferrerName?: string | null;
  claimedPlayerName?: string | null;
  claimedContact?: string | null;
  discountCents: number;
}): Promise<string> {
  const r = input.resolution;
  const { data, error } = await db()
    .from("program_referrals")
    .insert({
      registration_id: input.registrationId,
      program_slug: input.programSlug,
      referrer_code: r.referrer?.code ?? null,
      referrer_email: r.referrer?.email ?? null,
      referrer_name: r.referrer?.name ?? null,
      claimed_referrer_name: input.claimedReferrerName ?? null,
      claimed_player_name: input.claimedPlayerName ?? null,
      claimed_contact: input.claimedContact ?? null,
      match_method: r.matchMethod,
      status: r.matchMethod === "code" || r.matchMethod === "courriel" ? "confirme" : "a_verifier",
      discount_cents: input.discountCents
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** À appeler quand l'inscription référée est PAYÉE : confirme la
 *  recommandation (si le référent est identifié sans équivoque) et crée la
 *  récompense à choisir. Idempotent — jamais deux récompenses pour une
 *  même inscription. */
export async function onReferredRegistrationPaid(registrationId: string): Promise<{ rewardCreated: boolean }> {
  const supabase = db();
  const { data: ref } = await supabase.from("program_referrals").select("*").eq("registration_id", registrationId).maybeSingle();
  if (!ref) return { rewardCreated: false };
  const referral = ref as ProgramReferral;
  if (referral.status === "annule" || referral.status === "rejete") return { rewardCreated: false };
  if (referral.reward_status !== "aucune") return { rewardCreated: false };
  if (!referral.referrer_email) return { rewardCreated: false };
  if (referral.status !== "confirme") return { rewardCreated: false }; // a_verifier : attend l'administrateur

  const { error } = await supabase
    .from("program_referrals")
    .update({ status: "valide", reward_status: "a_choisir", updated_at: new Date().toISOString() })
    .eq("id", referral.id)
    .eq("reward_status", "aucune");
  if (error) throw new Error(error.message);
  await logReferralAudit(referral.id, "recompense_creee", "systeme", { registrationId });
  return { rewardCreated: true };
}

export type ChooseRewardResult = { ok: true } | { ok: false; error: string };

/** Le parent référent choisit sa récompense — une seule par recommandation. */
export async function chooseReferralReward(referralId: string, referrerEmail: string, choice: "sac" | "credit"): Promise<ChooseRewardResult> {
  const supabase = db();
  const { data: ref, error } = await supabase.from("program_referrals").select("*").eq("id", referralId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!ref) return { ok: false, error: "Recommandation introuvable." };
  const referral = ref as ProgramReferral;
  if (normalizeEmail(referral.referrer_email) !== normalizeEmail(referrerEmail)) return { ok: false, error: "Cette récompense n'appartient pas à votre famille." };
  if (referral.reward_status !== "a_choisir") return { ok: false, error: "Cette récompense a déjà été choisie ou n'est pas disponible." };

  // Mise à jour conditionnelle : empêche le double choix même en cas de double clic.
  const nextStatus = choice === "sac" ? "sac_a_remettre" : "credit_accorde";
  const { data: updated, error: updError } = await supabase
    .from("program_referrals")
    .update({ reward_choice: choice, reward_status: nextStatus, reward_chosen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", referralId)
    .eq("reward_status", "a_choisir")
    .select("id");
  if (updError) return { ok: false, error: updError.message };
  if (!updated || updated.length === 0) return { ok: false, error: "Cette récompense a déjà été choisie." };

  if (choice === "credit") {
    await addLedgerEntry({ email: referral.referrer_email!, deltaCents: REFERRAL_CREDIT_CENTS, kind: "recompense", referralId, registrationId: referral.registration_id, note: "Crédit de recommandation", createdBy: "parent" });
  }
  await logReferralAudit(referralId, `recompense_${choice}`, "parent", { email: referrerEmail });
  return { ok: true };
}

/* ── Vue du parent référent ─────────────────────────────────────── */

export interface ReferrerSummary {
  code: string;
  referralsCount: number;
  validatedCount: number;
  rewardsConfirmed: number;
  rewardsPending: number;
  creditBalanceCents: number;
  items: {
    id: string;
    programSlug: string;
    playerLabel: string;
    status: ProgramReferral["status"];
    rewardStatus: ProgramReferral["reward_status"];
    rewardChoice: ProgramReferral["reward_choice"];
    createdAt: string;
  }[];
}

export async function getReferrerSummary(email: string, familyName?: string | null): Promise<ReferrerSummary> {
  const code = await getOrCreateReferralCode(email, familyName);
  const supabase = db();
  const { data } = await supabase.from("program_referrals").select("*, reg:session_program_registrations(player_first_name, status)").eq("referrer_email", normalizeEmail(email)).order("created_at", { ascending: false });
  const rows = (data ?? []) as (ProgramReferral & { reg?: { player_first_name: string; status: string } })[];
  const active = rows.filter((r) => r.status !== "annule" && r.status !== "rejete");
  return {
    code: code.code,
    referralsCount: active.length,
    validatedCount: active.filter((r) => r.status === "valide").length,
    rewardsConfirmed: active.filter((r) => ["sac_a_remettre", "sac_remis", "credit_accorde"].includes(r.reward_status)).length,
    rewardsPending: active.filter((r) => r.reward_status === "a_choisir").length,
    creditBalanceCents: await getCreditBalance(email),
    items: active.map((r) => ({
      id: r.id,
      programSlug: r.program_slug,
      playerLabel: r.reg?.player_first_name ?? "Nouveau joueur",
      status: r.status,
      rewardStatus: r.reward_status,
      rewardChoice: r.reward_choice,
      createdAt: r.created_at
    }))
  };
}
