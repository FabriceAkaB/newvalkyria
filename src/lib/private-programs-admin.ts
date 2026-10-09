import { getAllPrivatePrograms, getPrivateRegistrationById, getPrivateRegistrationRows } from "@/lib/private-programs-repo";
import { releasePrivateRegistration } from "@/lib/private-programs-lifecycle";
import {
  addLedgerEntry,
  getOrCreateReferralCode,
  logReferralAudit,
  normalizeEmail,
  onReferredRegistrationPaid,
  REFERRAL_CREDIT_CENTS,
  type ProgramReferral
} from "@/lib/referrals-repo";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/* ── Tableau des références (5.2) ───────────────────────────────── */

export interface ReferralAdminRow extends ProgramReferral {
  new_family_name: string | null;
  new_family_email: string | null;
  player_name: string | null;
  program_name: string | null;
  registration_status: string | null;
  referrer_credit_cents: number;
}

export async function getReferralAdminRows(): Promise<ReferralAdminRow[]> {
  const supabase = db();
  const { data, error } = await supabase
    .from("program_referrals")
    .select("*, reg:session_program_registrations(parent_name, parent_email, player_first_name, player_last_name, status, program_slug)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const programs = await getAllPrivatePrograms();
  const names = new Map(programs.map((p) => [p.slug, p.name]));
  const emails = Array.from(new Set((data ?? []).map((r: any) => r.referrer_email).filter(Boolean)));
  const { data: ledger } = emails.length ? await supabase.from("family_credit_ledger").select("family_email, delta_cents").in("family_email", emails) : { data: [] as any[] };
  const balance = new Map<string, number>();
  for (const l of ledger ?? []) balance.set(l.family_email, (balance.get(l.family_email) ?? 0) + l.delta_cents);

  return (data ?? []).map((r: any) => ({
    ...r,
    new_family_name: r.reg?.parent_name ?? null,
    new_family_email: r.reg?.parent_email ?? null,
    player_name: r.reg ? `${r.reg.player_first_name} ${r.reg.player_last_name}`.trim() : null,
    program_name: names.get(r.program_slug) ?? r.program_slug,
    registration_status: r.reg?.status ?? null,
    referrer_credit_cents: r.referrer_email ? balance.get(normalizeEmail(r.referrer_email)) ?? 0 : 0
  }));
}

/* ── Crédits (5.3) ──────────────────────────────────────────────── */

export interface CreditFamilyRow {
  email: string;
  name: string | null;
  code: string | null;
  grantedCents: number;
  usedCents: number;
  balanceCents: number;
  entries: { id: string; deltaCents: number; kind: string; note: string | null; createdBy: string | null; createdAt: string }[];
}

export async function getCreditOverview(): Promise<CreditFamilyRow[]> {
  const supabase = db();
  const [{ data: ledger }, { data: codes }] = await Promise.all([
    supabase.from("family_credit_ledger").select("*").order("created_at", { ascending: false }),
    supabase.from("referral_codes").select("code, family_email, family_name")
  ]);
  const byEmail = new Map<string, CreditFamilyRow>();
  const codeBy = new Map<string, { code: string; name: string | null }>((codes ?? []).map((c: any) => [c.family_email, { code: c.code, name: c.family_name }]));
  for (const e of ledger ?? []) {
    const row =
      byEmail.get(e.family_email) ??
      ({ email: e.family_email, name: codeBy.get(e.family_email)?.name ?? null, code: codeBy.get(e.family_email)?.code ?? null, grantedCents: 0, usedCents: 0, balanceCents: 0, entries: [] } as CreditFamilyRow);
    row.balanceCents += e.delta_cents;
    if (e.delta_cents > 0 && e.kind !== "annulation_utilisation") row.grantedCents += e.delta_cents;
    if (e.kind === "utilisation") row.usedCents += -e.delta_cents;
    if (e.kind === "annulation_utilisation") row.usedCents -= e.delta_cents;
    row.entries.push({ id: e.id, deltaCents: e.delta_cents, kind: e.kind, note: e.note, createdBy: e.created_by, createdAt: e.created_at });
    byEmail.set(e.family_email, row);
  }
  return Array.from(byEmail.values()).sort((a, b) => b.balanceCents - a.balanceCents);
}

export async function adjustCredit(input: { email: string; deltaCents: number; note: string; actor: string }): Promise<void> {
  if (!input.note.trim()) throw new Error("Une note est requise pour corriger un crédit.");
  if (!Number.isInteger(input.deltaCents) || input.deltaCents === 0) throw new Error("Montant invalide.");
  await addLedgerEntry({ email: input.email, deltaCents: input.deltaCents, kind: "correction", note: input.note.trim(), createdBy: input.actor });
  await logReferralAudit(null, "credit_corrige", input.actor, { email: input.email, deltaCents: input.deltaCents, note: input.note });
}

/* ── Actions sur une recommandation ─────────────────────────────── */

async function getReferral(id: string): Promise<ProgramReferral> {
  const { data, error } = await db().from("program_referrals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Recommandation introuvable.");
  return data as ProgramReferral;
}

/** Confirme le référent (identité vérifiée par l'administrateur) puis crée la
 *  récompense si l'inscription est déjà payée. */
export async function confirmReferral(id: string, actor: string, referrer?: { email: string; name?: string }): Promise<void> {
  const supabase = db();
  const referral = await getReferral(id);
  const registration = await getPrivateRegistrationById(referral.registration_id);
  if (!registration) throw new Error("Inscription introuvable.");

  let email = referral.referrer_email;
  let name = referral.referrer_name;
  let code = referral.referrer_code;
  if (referrer?.email) {
    email = normalizeEmail(referrer.email);
    name = referrer.name ?? name;
    const c = await getOrCreateReferralCode(email, name);
    code = c.code;
  }
  if (!email) throw new Error("Aucun parent référent identifié : indiquez son courriel.");
  if (normalizeEmail(email) === normalizeEmail(registration.parent_email)) throw new Error("Une famille ne peut pas se recommander elle-même.");

  const hadDiscount = referral.discount_cents > 0;
  await supabase
    .from("program_referrals")
    .update({ referrer_email: email, referrer_name: name, referrer_code: code, status: "confirme", updated_at: new Date().toISOString() })
    .eq("id", id);
  await logReferralAudit(id, "confirmee", actor, { referrerEmail: email });

  // Pas de rabais au paiement (référent inconnu à l'époque) : on le compense en crédit pour la nouvelle famille.
  if (!hadDiscount) {
    const { data: program } = await supabase.from("session_programs").select("referral_discount_cents").eq("slug", referral.program_slug).maybeSingle();
    const amount = program?.referral_discount_cents ?? REFERRAL_CREDIT_CENTS;
    const { data: already } = await supabase.from("family_credit_ledger").select("id").eq("referral_id", id).eq("kind", "rabais_verification").maybeSingle();
    if (!already && amount > 0) {
      await addLedgerEntry({ email: registration.parent_email, deltaCents: amount, kind: "rabais_verification", referralId: id, registrationId: registration.id, note: "Rabais de référencement confirmé après vérification", createdBy: actor });
      await supabase.from("program_referrals").update({ discount_cents: amount }).eq("id", id);
    }
  }

  if (registration.status === "paid" || registration.status === "confirmed") {
    await onReferredRegistrationPaid(registration.id);
  }
}

export async function rejectReferral(id: string, actor: string, note?: string): Promise<void> {
  const referral = await getReferral(id);
  if (referral.reward_status === "credit_accorde" && referral.referrer_email) {
    await addLedgerEntry({ email: referral.referrer_email, deltaCents: -REFERRAL_CREDIT_CENTS, kind: "correction", referralId: id, registrationId: referral.registration_id, note: `Recommandation refusée${note ? ` — ${note}` : ""}`, createdBy: actor });
  }
  await db()
    .from("program_referrals")
    .update({
      status: "rejete",
      reward_status: referral.reward_status === "sac_remis" ? "sac_remis" : "annulee",
      notes: [referral.notes, note].filter(Boolean).join(" · ") || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  await logReferralAudit(id, "rejetee", actor, { note });
}

export async function setBagDelivered(id: string, delivered: boolean, actor: string): Promise<void> {
  const referral = await getReferral(id);
  if (referral.reward_choice !== "sac") throw new Error("Cette récompense n'est pas un sac.");
  await db()
    .from("program_referrals")
    .update({
      reward_status: delivered ? "sac_remis" : "sac_a_remettre",
      bag_delivered_at: delivered ? new Date().toISOString() : null,
      bag_delivered_by: delivered ? actor : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  await logReferralAudit(id, delivered ? "sac_remis" : "sac_a_remettre", actor);
}

/* ── Annulation / remboursement ─────────────────────────────────── */

export interface CancelResult {
  refundedCents: number;
  refunds: number;
}

export async function cancelRegistrationAdmin(registrationId: string, options: { actor: string; refund: boolean; reason: string }): Promise<CancelResult> {
  const supabase = db();
  const registration = await getPrivateRegistrationById(registrationId);
  if (!registration) throw new Error("Inscription introuvable.");
  if (registration.status === "cancelled") throw new Error("Cette inscription est déjà annulée.");

  let refundedCents = 0;
  let refunds = 0;
  if (options.refund) {
    const stripe = getStripeClient();
    const intents: { id: string; amount: number }[] = [];
    const { data: plan } = await supabase.from("session_program_payment_plans").select("id").eq("registration_id", registrationId).maybeSingle();
    if (plan) {
      const { data: insts } = await supabase.from("session_program_payment_plan_installments").select("amount_cents, status, stripe_payment_intent_id").eq("plan_id", plan.id);
      for (const i of insts ?? []) if (i.status === "paid" && i.stripe_payment_intent_id) intents.push({ id: i.stripe_payment_intent_id, amount: i.amount_cents });
    }
    if (intents.length === 0 && registration.stripe_payment_intent_id && (registration.status === "paid" || registration.status === "confirmed")) {
      intents.push({ id: registration.stripe_payment_intent_id, amount: registration.total_due_cents ?? registration.price_cents ?? 0 });
    }
    for (const intent of intents) {
      await stripe.refunds.create({ payment_intent: intent.id });
      refundedCents += intent.amount;
      refunds++;
    }
  }

  await releasePrivateRegistration(registrationId, { actor: options.actor, reason: options.reason });
  return { refundedCents, refunds };
}

/* ── Codes ──────────────────────────────────────────────────────── */

export interface CodeRow {
  code: string;
  family_email: string;
  family_name: string | null;
  created_at: string;
  referralsCount: number;
}

export async function getCodeRows(): Promise<CodeRow[]> {
  const supabase = db();
  const [{ data: codes }, { data: refs }] = await Promise.all([
    supabase.from("referral_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("program_referrals").select("referrer_email, status")
  ]);
  const counts = new Map<string, number>();
  for (const r of refs ?? []) if (r.referrer_email && r.status !== "annule" && r.status !== "rejete") counts.set(r.referrer_email, (counts.get(r.referrer_email) ?? 0) + 1);
  return (codes ?? []).map((c: any) => ({ ...c, referralsCount: counts.get(c.family_email) ?? 0 }));
}

/** Crée un code pour chaque famille connue (inscriptions, leads, Sport-Études,
 *  programmes à dates fixes) qui n'en a pas encore. */
export async function generateCodesForAllFamilies(): Promise<{ created: number; total: number }> {
  const supabase = db();
  const [reg, spr, se, lead, existing] = await Promise.all([
    supabase.from("registrations").select("parent_name, parent_email").neq("status", "cancelled"),
    supabase.from("session_program_registrations").select("parent_name, parent_email").neq("status", "cancelled"),
    supabase.from("sport_etudes_registrations").select("parent_first_name, parent_last_name, parent_email").neq("status", "cancelled"),
    supabase.from("leads").select("parent_name, email").neq("status", "cancelled"),
    supabase.from("referral_codes").select("family_email")
  ]);
  const families = new Map<string, string>();
  const add = (email: string | null, name: string | null) => {
    const e = normalizeEmail(email);
    if (!e || !e.includes("@") || e.endsWith("@newvalkyria.temp")) return;
    if (!families.has(e)) families.set(e, (name ?? "").trim());
  };
  for (const r of reg.data ?? []) add(r.parent_email, r.parent_name);
  for (const r of spr.data ?? []) add(r.parent_email, r.parent_name);
  for (const r of se.data ?? []) add(r.parent_email, `${r.parent_first_name} ${r.parent_last_name}`);
  for (const r of lead.data ?? []) add(r.email, r.parent_name);

  const have = new Set((existing.data ?? []).map((r: any) => r.family_email));
  let created = 0;
  for (const [email, name] of families) {
    if (have.has(email)) continue;
    try {
      await getOrCreateReferralCode(email, name || null);
      created++;
    } catch {
      /* courriel invalide : ignoré */
    }
  }
  return { created, total: families.size };
}

/* ── Tableau financier (5.4) ────────────────────────────────────── */

export interface ProgramFinancials {
  slug: string;
  name: string;
  capacity: number;
  registrations: number;
  waitlist: number;
  fillRate: number;
  grossCents: number;
  referralDiscountCents: number;
  creditUsedCents: number;
  feesCents: number;
  collectedCents: number;
  upcomingCents: number;
  failedCents: number;
  /** Rentabilité : coûts estimés (séances × coût par séance + frais fixes) et marge sur l'encaissé. */
  costCents: number;
  marginCents: number;
  sessions: number;
}

export interface FinancialSummary {
  programs: ProgramFinancials[];
  totals: Omit<ProgramFinancials, "slug" | "name" | "capacity" | "fillRate">;
  creditsGrantedCents: number;
  creditsUsedCents: number;
  referralsConverted: number;
  referralsPending: number;
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const [programs, rows] = await Promise.all([getAllPrivatePrograms(), getPrivateRegistrationRows()]);
  const supabase = db();
  const [{ data: ledger }, { data: refs }] = await Promise.all([
    supabase.from("family_credit_ledger").select("delta_cents, kind"),
    supabase.from("program_referrals").select("status, reward_status")
  ]);

  const { data: dateRows } = await supabase.from("session_program_dates").select("program_slug").in("program_slug", programs.map((p) => p.slug));
  const sessionsBy = new Map<string, number>();
  for (const d of dateRows ?? []) sessionsBy.set(d.program_slug, (sessionsBy.get(d.program_slug) ?? 0) + 1);

  const out: ProgramFinancials[] = programs.map((p) => {
    const regs = rows.filter((r) => r.program_slug === p.slug);
    const sessions = sessionsBy.get(p.slug) ?? p.practices_count ?? 0;
    const costCents = sessions * p.cost_per_session_cents + p.fixed_costs_cents;
    const active = regs.filter((r) => r.status === "paid" || r.status === "confirmed");
    const upcoming = active.reduce((s, r) => s + r.installments.filter((i) => i.status === "pending").reduce((a, i) => a + i.amount_cents, 0), 0);
    const failed = active.reduce((s, r) => s + r.installments.filter((i) => i.status === "failed" || i.status === "failed_final").reduce((a, i) => a + i.amount_cents, 0), 0);
    return {
      slug: p.slug,
      name: p.name,
      capacity: p.max_capacity,
      registrations: active.length,
      waitlist: regs.filter((r) => r.status === "waitlist").length,
      fillRate: p.max_capacity ? active.length / p.max_capacity : 0,
      grossCents: active.reduce((s, r) => s + (r.list_price_cents ?? 0), 0),
      referralDiscountCents: active.reduce((s, r) => s + r.referral_discount_cents, 0),
      creditUsedCents: active.reduce((s, r) => s + r.credit_applied_cents, 0),
      feesCents: active.reduce((s, r) => s + r.installment_fee_cents, 0),
      collectedCents: active.reduce((s, r) => s + r.paid_cents, 0),
      upcomingCents: upcoming,
      failedCents: failed,
      costCents,
      marginCents: active.reduce((s, r) => s + r.paid_cents, 0) - costCents,
      sessions
    };
  });

  const sum = (key: keyof ProgramFinancials) => out.reduce((s, p) => s + (p[key] as number), 0);
  return {
    programs: out,
    totals: {
      registrations: sum("registrations"),
      waitlist: sum("waitlist"),
      grossCents: sum("grossCents"),
      referralDiscountCents: sum("referralDiscountCents"),
      creditUsedCents: sum("creditUsedCents"),
      feesCents: sum("feesCents"),
      collectedCents: sum("collectedCents"),
      upcomingCents: sum("upcomingCents"),
      failedCents: sum("failedCents"),
      costCents: sum("costCents"),
      marginCents: sum("marginCents"),
      sessions: sum("sessions")
    },
    creditsGrantedCents: (ledger ?? []).filter((l: any) => l.delta_cents > 0 && l.kind !== "annulation_utilisation").reduce((s: number, l: any) => s + l.delta_cents, 0),
    creditsUsedCents: (ledger ?? []).reduce((s: number, l: any) => (l.kind === "utilisation" ? s - l.delta_cents : l.kind === "annulation_utilisation" ? s - l.delta_cents : s), 0),
    referralsConverted: (refs ?? []).filter((r: any) => r.status === "valide").length,
    referralsPending: (refs ?? []).filter((r: any) => r.status === "a_verifier" || r.status === "confirme").length
  };
}
