import { sendPrivateProgramConfirmationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import {
  getPrivateProgram,
  getPrivateRegistrationById,
  getPrivateRegistrationByPaymentIntent,
  getPrivateRegistrationBySession,
  setRegistrationStatus,
  type PrivateRegistration
} from "@/lib/private-programs-repo";
import { addLedgerEntry, logReferralAudit, onReferredRegistrationPaid } from "@/lib/referrals-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/** Appelé par le webhook Stripe quand le 1er paiement d'une inscription à un
 *  programme privé est confirmé : valide la recommandation, crée la
 *  récompense du référent et envoie la confirmation détaillée. */
export async function onPrivateRegistrationPaid(registration: PrivateRegistration): Promise<void> {
  const program = await getPrivateProgram(registration.program_slug);
  if (!program) return;

  try {
    await onReferredRegistrationPaid(registration.id);
  } catch (error) {
    console.error("Unable to validate referral", error);
  }

  try {
    const { data: plan } = await db().from("session_program_payment_plans").select("id").eq("registration_id", registration.id).maybeSingle();
    let next: { due_date: string; amount_cents: number } | null = null;
    let paidCents = registration.total_due_cents ?? registration.price_cents ?? 0;
    if (plan) {
      const { data: insts } = await db().from("session_program_payment_plan_installments").select("sequence_no, amount_cents, due_date").eq("plan_id", plan.id).order("sequence_no");
      const first = (insts ?? [])[0];
      paidCents = first?.amount_cents ?? paidCents;
      const second = (insts ?? [])[1];
      if (second) next = { due_date: second.due_date, amount_cents: second.amount_cents };
    }

    await sendPrivateProgramConfirmationEmail({
      to: registration.parent_email,
      parentName: registration.parent_name,
      playerName: `${registration.player_first_name} ${registration.player_last_name}`.trim(),
      programName: program.name,
      practices: program.practices_count,
      matches: program.matches_count,
      listPriceCents: registration.list_price_cents ?? program.price_cents,
      referralDiscountCents: registration.referral_discount_cents,
      creditAppliedCents: registration.credit_applied_cents,
      installmentFeeCents: registration.installment_fee_cents,
      totalCents: registration.total_due_cents ?? registration.price_cents ?? 0,
      paidCents,
      nextInstallmentDate: next?.due_date ?? null,
      nextInstallmentCents: next?.amount_cents ?? null,
      accountUrl: `${env.siteUrl}/compte/recommandations`
    });
  } catch (error) {
    console.error("Unable to send private program confirmation email", error);
  }
}

/** Libère la place, annule les versements à venir, remet le crédit utilisé et
 *  annule la recommandation/récompense liée (annulation, expiration, remboursement). */
export async function releasePrivateRegistration(
  registrationId: string,
  options: { actor: string; reason: string; newStatus?: "cancelled" }
): Promise<void> {
  const supabase = db();
  const registration = await getPrivateRegistrationById(registrationId);
  if (!registration) return;

  await setRegistrationStatus(registrationId, options.newStatus ?? "cancelled");

  // Versements à venir : on les retire du plan pour qu'ils ne soient plus prélevés.
  const { data: plan } = await supabase.from("session_program_payment_plans").select("id").eq("registration_id", registrationId).maybeSingle();
  if (plan) {
    await supabase
      .from("session_program_payment_plan_installments")
      .delete()
      .eq("plan_id", plan.id)
      .in("status", ["pending", "failed"]);
  }

  // Crédit utilisé à l'inscription : remis au registre (une seule fois).
  if (registration.credit_applied_cents > 0) {
    const { data: already } = await supabase
      .from("family_credit_ledger")
      .select("id")
      .eq("registration_id", registrationId)
      .eq("kind", "annulation_utilisation")
      .maybeSingle();
    if (!already) {
      await addLedgerEntry({
        email: registration.parent_email,
        deltaCents: registration.credit_applied_cents,
        kind: "annulation_utilisation",
        registrationId,
        note: `${options.reason} — crédit remis`,
        createdBy: options.actor
      });
    }
  }

  // Recommandation liée : annulée, et récompense déjà créditée → reprise au registre.
  const { data: ref } = await supabase.from("program_referrals").select("*").eq("registration_id", registrationId).maybeSingle();
  if (ref && ref.status !== "annule") {
    await supabase
      .from("program_referrals")
      .update({
        status: "annule",
        reward_status: ref.reward_status === "sac_remis" ? ref.reward_status : "annulee",
        notes: [ref.notes, `${options.reason} (${new Date().toLocaleDateString("fr-CA")})`].filter(Boolean).join(" · "),
        updated_at: new Date().toISOString()
      })
      .eq("id", ref.id);
    if (ref.reward_status === "credit_accorde" && ref.referrer_email) {
      await addLedgerEntry({
        email: ref.referrer_email,
        deltaCents: -5000,
        kind: "correction",
        referralId: ref.id,
        registrationId,
        note: `Recommandation annulée — ${options.reason}`,
        createdBy: options.actor
      });
    }
    await logReferralAudit(ref.id, "recommandation_annulee", options.actor, { reason: options.reason, registrationId });
  }
}

/** checkout.session.expired : la réservation expire, la place est libérée. */
export async function onPrivateCheckoutExpired(sessionId: string): Promise<void> {
  const registration = await getPrivateRegistrationBySession(sessionId);
  if (!registration || registration.status !== "pending") return;
  await releasePrivateRegistration(registration.id, { actor: "systeme", reason: "Paiement non complété (session expirée)" });
}

/** charge.refunded : un remboursement déclenche une vérification des récompenses. */
export async function onPrivateRefund(paymentIntentId: string): Promise<void> {
  const registration = await getPrivateRegistrationByPaymentIntent(paymentIntentId);
  if (!registration) return;
  const supabase = db();
  const { data: ref } = await supabase.from("program_referrals").select("*").eq("registration_id", registration.id).maybeSingle();
  if (!ref || ref.status === "annule") return;
  await supabase
    .from("program_referrals")
    .update({
      status: "a_verifier",
      notes: [ref.notes, `Remboursement détecté le ${new Date().toLocaleDateString("fr-CA")} — récompense à vérifier`].filter(Boolean).join(" · "),
      updated_at: new Date().toISOString()
    })
    .eq("id", ref.id);
  await logReferralAudit(ref.id, "remboursement_detecte", "stripe", { paymentIntentId, registrationId: registration.id });
}
