import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStripeClient } from "@/lib/stripe";

const OFFER_LABEL = "New Valkyria - Programme saison (15 séances)";
const OFFER_AMOUNT_CENTS = 55000;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const stripe = getStripeClient();
    const baseUrl = getRequestOrigin(request);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: body.email,
      payment_method_types: ["card"],
      line_items: env.stripePriceId
        ? [
            {
              price: env.stripePriceId,
              quantity: 1
            }
          ]
        : [
            {
              quantity: 1,
              price_data: {
                currency: "cad",
                product_data: {
                  name: OFFER_LABEL,
                  description: "15 séances semi-privées + routine maison + suivi"
                },
                unit_amount: OFFER_AMOUNT_CENTS
              }
            }
          ],
      metadata: {
        checkoutType: "direct"
      },
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/inscription?cancelled=1`
    });

    if (!session.url) {
      return jsonError("Stripe n'a pas retourné d'URL de paiement.", 500);
    }

    return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 422);
    }

    return jsonError("Erreur serveur", 500);
  }
}
