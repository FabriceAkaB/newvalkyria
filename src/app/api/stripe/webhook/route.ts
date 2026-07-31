import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { sendConfirmationEmail, sendShopOrderConfirmationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { markLeadPaidInSheet } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { hasProcessedStripeEvent, markLeadAsPaid, recordStripeEvent } from "@/lib/repositories";
import { activatePaymentPlan, markRegistrationPaidByCheckoutSession } from "@/lib/season-admin-repo";
import { markOrderPaidByCheckoutSession } from "@/lib/shop-repo";
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
    const checkoutType = session.metadata?.checkoutType ?? (session.mode === "setup" ? "trial" : "elite");

    // ── Saison Automne/Hiver 2026 — inscriptions en base de données ──
    if (checkoutType === "season-registration") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const registration = await markRegistrationPaidByCheckoutSession(session.id, paymentIntentId);
      if (registration) {
        try {
          await sendConfirmationEmail({ to: registration.parent_email, parentName: registration.parent_name });
        } catch (error) {
          console.error("Unable to send season confirmation email", error);
        }
      }

      // Paiement échelonné — enregistre la carte (client + méthode) sur le
      // plan pour permettre les prélèvements automatiques des versements
      // suivants, et marque le 1er versement comme payé.
      const paymentPlanId = session.metadata?.paymentPlanId;
      if (paymentPlanId && paymentIntentId) {
        try {
          const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
          const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId);
          const stripePaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : undefined;
          if (stripeCustomerId && stripePaymentMethodId) {
            await activatePaymentPlan(paymentPlanId, {
              stripeCustomerId,
              stripePaymentMethodId,
              firstInstallmentPaymentIntentId: paymentIntentId
            });
          } else {
            console.error("Payment plan activation missing customer or payment method", { paymentPlanId, stripeCustomerId, stripePaymentMethodId });
          }
        } catch (error) {
          console.error("Unable to activate payment plan", error);
        }
      }

      // Sac offert/ajouté en option (même session Stripe) — même appel que la boutique,
      // décrémente l'inventaire automatiquement ; pas de courriel séparé pour éviter le doublon.
      await markOrderPaidByCheckoutSession(session.id, paymentIntentId).catch((error) => {
        console.error("Unable to mark signup-bonus bag order as paid", error);
      });
      return NextResponse.json({ received: true });
    }

    // ── Boutique — commande en base de données ──
    if (checkoutType === "shop-order") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const order = await markOrderPaidByCheckoutSession(session.id, paymentIntentId);
      if (order) {
        try {
          await sendShopOrderConfirmationEmail({
            to: order.customer_email,
            customerName: order.customer_name,
            items: order.items.map((item) => ({
              productName: item.product_name,
              variantLabel: item.variant_label,
              unitPriceCents: item.unit_price_cents,
              quantity: item.quantity
            })),
            totalCents: order.total_cents
          });
        } catch (error) {
          console.error("Unable to send shop order confirmation email", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    const leadId = session.metadata?.leadId;
    const sessionEmail = session.customer_details?.email ?? session.customer_email ?? undefined;
    let emailToNotify = sessionEmail;
    let parentName = "Parent";

    if (leadId && checkoutType !== "trial") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const lead = await markLeadAsPaid(leadId, paymentIntentId);

      // Invalide immédiatement le cache de capacité
      revalidateTag("enrollment-capacity", "max");

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
