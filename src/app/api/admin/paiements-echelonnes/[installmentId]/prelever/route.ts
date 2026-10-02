import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { sendInstallmentReceiptEmail, sendPaymentPlanFailedEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { getInstallmentWithContext, markInstallmentFailed, markInstallmentPaid } from "@/lib/season-admin-repo";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Prélève MAINTENANT un versement précis sur la carte actuellement
 *  enregistrée au plan (ex. après qu'une famille a payé un versement en
 *  retard via un lien de remplacement, qui a mis à jour la carte du plan —
 *  voir /lien-paiement) — sans attendre le prochain passage du cron ni
 *  retoucher aux autres versements d'autres familles. */
export async function POST(_request: Request, { params }: { params: Promise<{ installmentId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { installmentId } = await params;

  const installment = await getInstallmentWithContext(installmentId);
  if (!installment) return jsonError("Versement introuvable", 404);
  if (installment.status === "paid") return jsonError("Ce versement est déjà payé.", 409);

  const db = getSupabaseAdminClient() as any;
  const { data: plan } = await db.from("registration_payment_plans").select("stripe_customer_id, stripe_payment_method_id, installment_count").eq("id", installment.planId).maybeSingle();
  if (!plan?.stripe_customer_id || !plan?.stripe_payment_method_id) {
    return jsonError("Aucune carte enregistrée sur ce plan.", 409);
  }
  const { data: raw } = await db.from("registration_payment_plan_installments").select("attempt_count").eq("id", installmentId).maybeSingle();
  const currentAttemptCount = raw?.attempt_count ?? 0;

  const stripe = getStripeClient();

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: installment.amountCents,
      currency: "cad",
      customer: plan.stripe_customer_id,
      payment_method: plan.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: { installmentId: installment.id, sequenceNo: String(installment.sequenceNo) }
    });

    if (paymentIntent.status !== "succeeded") throw new Error(`Statut PaymentIntent inattendu : ${paymentIntent.status}`);

    await markInstallmentPaid(installment.id, paymentIntent.id);

    void sendInstallmentReceiptEmail({
      to: installment.parentEmail,
      parentName: installment.parentName,
      amountCents: installment.amountCents,
      installmentNumber: installment.sequenceNo,
      installmentCount: plan.installment_count
    }).catch((err) => console.error("Unable to send installment receipt email", err));

    return NextResponse.json({ ok: true, status: "paid" });
  } catch (error) {
    const { attemptCount, isFinal, wasFirstFailure } = await markInstallmentFailed(installmentId, currentAttemptCount);
    if (wasFirstFailure || isFinal) {
      void sendPaymentPlanFailedEmail({
        parentName: installment.parentName,
        parentEmail: installment.parentEmail,
        amountCents: installment.amountCents,
        installmentNumber: installment.sequenceNo,
        installmentCount: plan.installment_count,
        attemptNumber: attemptCount,
        finalAttempt: isFinal
      }).catch((emailErr) => console.error("Unable to send payment plan failed email", emailErr));
    }
    const message = error instanceof Error ? error.message : "Erreur de prélèvement";
    return jsonError(message, 422);
  }
}
