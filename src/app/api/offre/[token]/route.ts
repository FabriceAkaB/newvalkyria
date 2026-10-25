import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { fullGroupsForOffer, getOfferByToken, isOfferExpired } from "@/lib/special-offers";
import { getStripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Ouvre le paiement Stripe d'une offre spéciale, seulement si elle n'est ni expirée ni déjà payée. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await getOfferByToken(token);
  if (!offer) return jsonError("Offre introuvable.", 404);
  if (offer.paid_at) return jsonError("Cette offre a déjà été payée. Merci !", 409);
  if (isOfferExpired(offer)) return jsonError("Cette offre est expirée.", 410);
  const full = await fullGroupsForOffer(offer);
  if (full.length) return jsonError(`Désolé, ce groupe est maintenant complet (${full.join(", ")}). Écrivez-nous à info@newvalkyria.com : nous vous proposerons une autre option.`, 409);

  const origin = getRequestOrigin(request);
  // Une session Stripe vit au plus 24 h (minimum 30 min) : elle ne dépasse jamais l'expiration de l'offre.
  const nowSec = Math.floor(Date.now() / 1000);
  const offerEnd = Math.floor(new Date(offer.expires_at).getTime() / 1000);
  const expiresAt = Math.max(nowSec + 31 * 60, Math.min(offerEnd, nowSec + 23 * 3600));

  const session = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: offer.parent_email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: offer.amount_cents,
          product_data: { name: offer.title, description: offer.registrations.map((r) => `${r.playerName} : ${r.groupLabel}`).join(" · ") }
        }
      }
    ],
    metadata: { checkoutType: "special-offer", offerToken: offer.token },
    expires_at: expiresAt,
    success_url: `${origin}/offre/${offer.token}?merci=1`,
    cancel_url: `${origin}/offre/${offer.token}`
  });
  return NextResponse.json({ url: session.url });
}
