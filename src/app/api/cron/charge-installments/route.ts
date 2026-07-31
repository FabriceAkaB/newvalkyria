import { NextResponse } from "next/server";

import { sendInstallmentReceiptEmail, sendPaymentPlanFailedEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getDueInstallments, markInstallmentFailed, markInstallmentPaid } from "@/lib/season-admin-repo";
import { getStripeClient } from "@/lib/stripe";

/** Prélève automatiquement les versements échus (2e et 3e versement d'un
 *  paiement échelonné) sur la carte enregistrée à l'inscription. Déclenché
 *  quotidiennement par Vercel Cron (voir vercel.json) ; peut aussi être
 *  appelé manuellement pour vérification, avec le bon secret. */
export async function GET(request: Request) {
  if (!env.cronSecret) return jsonError("CRON_SECRET manquant", 500);

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret}`) return jsonError("Non autorisé", 401);

  const due = await getDueInstallments();
  const stripe = getStripeClient();

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const inst of due) {
    if (!inst.stripe_customer_id || !inst.stripe_payment_method_id) {
      console.error("Installment missing customer/payment method, skipping", inst.id);
      skipped++;
      continue;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: inst.amount_cents,
        currency: "cad",
        customer: inst.stripe_customer_id,
        payment_method: inst.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: { installmentId: inst.id, sequenceNo: String(inst.sequence_no) }
      });

      if (paymentIntent.status !== "succeeded") {
        throw new Error(`Statut PaymentIntent inattendu : ${paymentIntent.status}`);
      }

      await markInstallmentPaid(inst.id, paymentIntent.id);
      succeeded++;

      void sendInstallmentReceiptEmail({
        to: inst.parent_email,
        parentName: inst.parent_name,
        amountCents: inst.amount_cents,
        installmentNumber: inst.sequence_no,
        installmentCount: inst.installment_count
      }).catch((err) => console.error("Unable to send installment receipt email", err));
    } catch (err) {
      failed++;
      console.error("Installment charge failed", inst.id, err);

      const { attemptCount, isFinal, wasFirstFailure } = await markInstallmentFailed(inst.id, inst.attempt_count);
      if (wasFirstFailure || isFinal) {
        void sendPaymentPlanFailedEmail({
          parentName: inst.parent_name,
          parentEmail: inst.parent_email,
          amountCents: inst.amount_cents,
          installmentNumber: inst.sequence_no,
          installmentCount: inst.installment_count,
          attemptNumber: attemptCount,
          finalAttempt: isFinal
        }).catch((emailErr) => console.error("Unable to send payment plan failed email", emailErr));
      }
    }
  }

  return NextResponse.json({ processed: due.length, succeeded, failed, skipped });
}
