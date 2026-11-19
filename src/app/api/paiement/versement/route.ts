import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { checkInstallmentPayKey, installmentPayPath } from "@/lib/installment-pay";
import { getPayableInstallment } from "@/lib/installment-pay-repo";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";

/** La famille paie son versement refusé : ouvre un paiement Stripe valable 30 minutes, seulement si le versement
 *  n'est pas déjà payé (le prélèvement automatique a pu passer entre-temps). La carte est gardée pour la suite. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { source?: string; id?: string; cle?: string } | null;
  if (!body || !checkInstallmentPayKey(body.source, body.id, body.cle)) return jsonError("Lien invalide", 404);
  const source = body.source as Parameters<typeof installmentPayPath>[0];
  const inst = await getPayableInstallment(source, body.id!);
  if (!inst) return jsonError("Versement introuvable", 404);
  if (inst.status === "paid") return jsonError("Ce versement est déjà payé. Merci !", 409);
  const back = `${env.publicSiteUrl}${installmentPayPath(source, inst.id)}`;
  try {
    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      ...(inst.stripeCustomerId ? { customer: inst.stripeCustomerId } : { customer_creation: "always" as const, customer_email: inst.parentEmail || undefined }),
      line_items: [
        {
          quantity: 1,
          price_data: { currency: "cad", unit_amount: inst.amountCents, product_data: { name: `${inst.programName} : ${inst.playerName}, versement ${inst.sequenceNo}/${inst.installmentCount}` } }
        }
      ],
      payment_intent_data: { setup_future_usage: "off_session", metadata: { installmentId: inst.id, source } },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${back}&paye=1`,
      cancel_url: back,
      metadata: { checkoutType: "installment-retry", source, installmentId: inst.id, planId: inst.planId, registrationId: inst.registrationId }
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Paiement impossible pour le moment", 422);
  }
}
