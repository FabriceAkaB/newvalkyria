import { NextResponse } from "next/server";

import { sendTrialConfirmationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { setLeadCheckoutSession } from "@/lib/repositories";
import { getStripeClient } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations";
import type { AddonId } from "@/types/contracts";

const BASE_LABEL = "New Valkyria - Programme Académique (15 séances)";
const BASE_AMOUNT_CENTS = 55000;

const HALF_SEASON_LABEL = "New Valkyria - Demi-saison (7 séances)";
const HALF_SEASON_AMOUNT_CENTS = 27500;

const ADDONS: Record<AddonId, { label: string; amount: number }> = {
  tir:     { label: "New Valkyria - Programme Tir (7 séances)", amount: 17000 },
  dribble: { label: "New Valkyria - Programme Dribble (7 séances)", amount: 17000 },
  analyse: { label: "New Valkyria - Analyse de match en club", amount: 7500 }
};

export async function POST(request: Request) {
  try {
    const payload = checkoutSchema.parse(await request.json());
    const checkoutType = payload.checkoutType ?? "elite";
    const cancelPath = payload.cancelPath ?? "/inscription?cancelled=1";

    // ── Garde de capacité — retourne waitlistUrl si complet (race condition) ──
    if (checkoutType === "elite" || checkoutType === "half-season") {
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

    if (checkoutType === "trial") {
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        currency: "cad",
        customer_creation: "always",
        customer_email: payload.email,
        payment_method_types: ["card"],
        custom_text: {
          submit: {
            message: "**0 $ CAD aujourd'hui.** Nous validons seulement la carte pour réserver l'essai gratuit."
          },
          after_submit: {
            message: "Aucun prélèvement ne sera effectué maintenant. La carte sert uniquement à confirmer la réservation de l'essai."
          }
        },
        metadata: {
          leadId: payload.leadId,
          checkoutType,
          trialYear: payload.trialYear!,
          ...(payload.timeSlot ? { timeSlot: payload.timeSlot } : {})
        },
        setup_intent_data: {
          metadata: {
            leadId: payload.leadId,
            checkoutType,
            trialYear: payload.trialYear!,
            ...(payload.timeSlot ? { timeSlot: payload.timeSlot } : {})
          }
        },
        success_url: `${baseUrl}/confirmation?trial=true&year=${payload.trialYear}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}${cancelPath}`
      });

      await setLeadCheckoutSession(payload.leadId, session.id);

      if (!session.url) {
        throw new Error("Stripe n'a pas retourné d'URL de validation.");
      }

      // Fire-and-forget — envoie l'email de confirmation d'essai gratuit
      void sendTrialConfirmationEmail({
        to: payload.email,
        parentName: payload.parentName ?? "",
        childName: payload.childName,
        trialYear: payload.trialYear!
      }).catch((err) => console.error("Trial email error:", err));

      return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url });
    }

    // Build base line item — elite vs half-season
    const isHalfSeason = checkoutType === "half-season";

    const baseItem = isHalfSeason
      ? {
          quantity: 1 as const,
          price_data: {
            currency: "cad",
            product_data: {
              name: HALF_SEASON_LABEL,
              description: "7 séances semi-privées · Demi-saison New Valkyria"
            },
            unit_amount: HALF_SEASON_AMOUNT_CENTS
          }
        }
      : env.stripePriceId
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

    // Build add-on line items (always use price_data) — only for elite
    const addonItems = isHalfSeason
      ? []
      : (payload.addons ?? []).map((id) => ({
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
        checkoutType,
        addons: isHalfSeason ? "" : (payload.addons ?? []).join(","),
        ...(payload.category ? { category: payload.category } : {}),
        ...(payload.timeSlot ? { timeSlot: payload.timeSlot } : {})
      },
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`
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
