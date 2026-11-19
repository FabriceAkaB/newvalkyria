import { logAudit } from "@/lib/audit-repo";
import { markInstallmentPaid as markSeasonPaid } from "@/lib/season-admin-repo";
import { PROGRAMS, type ProgramCode } from "@/lib/season-2027";
import { markInstallmentPaid as markSessionProgramPaid } from "@/lib/session-programs-repo";
import { markInstallmentPaid as markSportEtudesPaid } from "@/lib/sport-etudes-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";
import type { InstallmentSource } from "@/lib/installment-pay";

/** Un versement à payer par la famille (saison filles, programmes à dates fixes, Sport-Études) : même structure de
 *  tables pour les trois. */

function db() {
  return getSupabaseAdminClient() as any;
}

const TABLES: Record<InstallmentSource, { inst: string; plan: string; reg: string }> = {
  season: { inst: "registration_payment_plan_installments", plan: "registration_payment_plans", reg: "registrations" },
  sessionprogram: { inst: "session_program_payment_plan_installments", plan: "session_program_payment_plans", reg: "session_program_registrations" },
  sportetudes: { inst: "sport_etudes_payment_plan_installments", plan: "sport_etudes_payment_plans", reg: "sport_etudes_registrations" }
};

export interface PayableInstallment {
  source: InstallmentSource;
  id: string;
  planId: string;
  registrationId: string;
  sequenceNo: number;
  installmentCount: number;
  amountCents: number;
  dueDate: string;
  status: string;
  stripeCustomerId: string | null;
  parentName: string;
  parentEmail: string;
  playerName: string;
  programName: string;
}

export async function getPayableInstallment(source: InstallmentSource, id: string): Promise<PayableInstallment | null> {
  const t = TABLES[source];
  const { data: inst } = await db().from(t.inst).select("*").eq("id", id).maybeSingle();
  if (!inst) return null;
  const { data: plan } = await db().from(t.plan).select("*").eq("id", inst.plan_id).maybeSingle();
  if (!plan) return null;
  const { data: reg } = await db().from(t.reg).select("*").eq("id", plan.registration_id).maybeSingle();
  if (!reg) return null;
  let programName = "Sport-Études New Valkyria";
  if (source === "season") programName = PROGRAMS[reg.program_id as ProgramCode]?.name ?? "Saison New Valkyria";
  if (source === "sessionprogram") {
    const { data: prog } = await db().from("session_programs").select("name").eq("slug", reg.program_slug).maybeSingle();
    programName = prog?.name ?? reg.program_slug ?? "Programme New Valkyria";
  }
  const parentName = (reg.parent_name ?? `${reg.parent_first_name ?? ""} ${reg.parent_last_name ?? ""}`).trim();
  return {
    source,
    id: inst.id,
    planId: plan.id,
    registrationId: plan.registration_id,
    sequenceNo: inst.sequence_no,
    installmentCount: plan.installment_count,
    amountCents: inst.amount_cents,
    dueDate: String(inst.due_date).slice(0, 10),
    status: inst.status,
    stripeCustomerId: plan.stripe_customer_id ?? null,
    parentName,
    parentEmail: String(reg.parent_email ?? "").trim(),
    playerName: `${reg.player_first_name ?? ""} ${reg.player_last_name ?? ""}`.trim() || "votre enfant",
    programName
  };
}

/** Paiement reçu par le lien (webhook, checkoutType « installment-retry ») : versement payé, et la carte utilisée
 *  devient celle des versements suivants. Un versement déjà payé autrement (prélèvement passé entre-temps) n'est
 *  pas touché : JP reçoit une tâche pour rembourser le doublon. */
export async function applyInstallmentPayment(input: { source: InstallmentSource; installmentId: string; planId?: string | null; paymentIntentId: string; customerId?: string | null; paymentMethodId?: string | null }): Promise<void> {
  const t = TABLES[input.source];
  const { data: inst } = await db().from(t.inst).select("id, status, stripe_payment_intent_id, amount_cents").eq("id", input.installmentId).maybeSingle();
  if (!inst) return;
  if (inst.status === "paid") {
    if (inst.stripe_payment_intent_id && inst.stripe_payment_intent_id !== input.paymentIntentId) {
      await syncRefTask(`double-paiement:${input.paymentIntentId}`, {
        title: `Rembourser un versement payé deux fois (${(inst.amount_cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })})`,
        details: `Le versement ${input.installmentId} (${input.source}) était déjà payé (${inst.stripe_payment_intent_id}) quand la famille l'a payé par son lien (${input.paymentIntentId}). Rembourser ${input.paymentIntentId} dans Stripe (skill paiement).`
      }).catch(() => null);
    }
    return;
  }
  if (input.source === "season") await markSeasonPaid(input.installmentId, input.paymentIntentId);
  else if (input.source === "sessionprogram") await markSessionProgramPaid(input.installmentId, input.paymentIntentId);
  else await markSportEtudesPaid(input.installmentId, input.paymentIntentId);
  if (input.planId && input.customerId && input.paymentMethodId) {
    await db().from(t.plan).update({ stripe_customer_id: input.customerId, stripe_payment_method_id: input.paymentMethodId }).eq("id", input.planId);
  }
  await logAudit({ actorRole: "system", actorLabel: "Stripe", action: "installment_paid_by_link", entityType: t.inst, entityId: input.installmentId, after: { paymentIntentId: input.paymentIntentId } }).catch(() => null);
}
