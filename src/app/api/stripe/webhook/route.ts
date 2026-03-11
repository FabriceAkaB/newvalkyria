import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { sendConfirmationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { markLeadPaidInSheet } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { hasProcessedStripeEvent, markLeadAsPaid, recordStripeEvent } from "@/lib/repositories";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    return jsonError("STRIPE_WEBHOOK_SECRET manquant", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Signature Stripe absente", 400);
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch {
    return jsonError("Webhook Stripe invalide", 400);
  }

  if (await hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ received: true, duplicated: true });
  }

  await recordStripeEvent(event.id, event);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const leadId = session.metadata?.leadId;
    const sessionEmail = session.customer_details?.email ?? session.customer_email ?? undefined;
    let emailToNotify = sessionEmail;
    let parentName = "Parent";

    if (leadId) {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const lead = await markLeadAsPaid(leadId, paymentIntentId);

      // Invalide immédiatement le cache de capacité
      revalidateTag("enrollment-capacity", {});

      if (lead.email) {
        emailToNotify = lead.email;
        // Mise à jour du statut dans Google Sheets (fire-and-forget)
        void markLeadPaidInSheet(lead.email, leadId);
      }
      if (lead.parent_name) {
        parentName = lead.parent_name;
      }
    }

    if (emailToNotify) {
      try {
        await sendConfirmationEmail({
          to: emailToNotify,
          parentName
        });
      } catch (error) {
        console.error("Unable to send confirmation email", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
