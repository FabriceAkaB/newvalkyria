import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { setLeadCheckoutSession } from "@/lib/repositories";
import { getStripeClient } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations";
import type { AddonId } from "@/types/contracts";

const BASE_LABEL = "New Valkyria - Programme Académique (15 séances)";
const BASE_AMOUNT_CENTS = 55000;

const ADDONS: Record<AddonId, { label: string; amount: number }> = {
  tir:     { label: "New Valkyria - Programme Tir (7 séances)", amount: 17000 },
  dribble: { label: "New Valkyria - Programme Dribble (7 séances)", amount: 17000 },
  analyse: { label: "New Valkyria - Analyse de match en club", amount: 7500 }
};

export async function POST(request: Request) {
  try {
    const payload = checkoutSchema.parse(await request.json());

    // ── Garde de capacité — retourne waitlistUrl si complet (race condition) ──
    {
      const { getCapacityData } = await import("@/lib/capacity");
      const capacity = await getCapacityData();
      const isCatFull = payload.category
        ? capacity.byCategory[payload.category]?.isFull
        : capacity.total.isFull;

      if (isCatFull) {
        // Catégorie pleine → pas de Stripe, confirmation liste d'attente directe
        return NextResponse.json({ waitlistUrl: "/confirmation?waitlist=true" });
      }
    }

    const stripe = getStripeClient();
    const baseUrl = getRequestOrigin(request);

    // Build base line item
    const baseItem = env.stripePriceId
      ? { price: env.stripePriceId, quantity: 1 as const }
      : {
          quantity: 1 as const,
          price_data: {
            currency: "cad",
            product_data: {
              name: BASE_LABEL,
              description: "15 séances semi-privées + routine maison + suivi individualisé"
            },
            unit_amount: BASE_AMOUNT_CENTS
          }
        };

    // Build add-on line items (always use price_data)
    const addonItems = (payload.addons ?? []).map((id) => ({
      quantity: 1 as const,
      price_data: {
        currency: "cad",
        product_data: { name: ADDONS[id].label },
        unit_amount: ADDONS[id].amount
      }
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: payload.email,
      payment_method_types: ["card"],
      line_items: [baseItem, ...addonItems],
      metadata: {
        leadId: payload.leadId,
        addons: (payload.addons ?? []).join(","),
        ...(payload.category ? { category: payload.category } : {})
      },
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/inscription?cancelled=1`
    });

    await setLeadCheckoutSession(payload.leadId, session.id);

    if (!session.url) {
      throw new Error("Stripe n'a pas retourné d'URL de paiement.");
    }

    return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    if (error instanceof Error) {
      return jsonError(error.message, 422);
    }

    return jsonError("Erreur serveur", 500);
  }
}
