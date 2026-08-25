import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getStripeClient } from "@/lib/stripe";

/** Crée un produit + prix Stripe ponctuel (ex. une offre qui n'a pas sa
 *  propre section dans le site) et, en option, un Payment Link Stripe
 *  réutilisable pour l'envoyer directement à des clients. Admin uniquement —
 *  ce n'est pas relié au tunnel d'inscription normal ni suivi dans notre
 *  base de données (les inscrits pour ce genre d'offre ponctuelle sont à
 *  suivre manuellement dans le Dashboard Stripe). */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string;
    amountCents?: number;
    createPaymentLink?: boolean;
  } | null;

  if (!body?.name?.trim() || !body.amountCents || body.amountCents < 1) {
    return jsonError("Nom et montant requis", 400);
  }

  const stripe = getStripeClient();

  const product = await stripe.products.create({
    name: body.name.trim(),
    description: body.description?.trim() || undefined
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: body.amountCents,
    currency: "cad"
  });

  let paymentLinkUrl: string | null = null;
  if (body.createPaymentLink) {
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }]
    });
    paymentLinkUrl = link.url;
  }

  return NextResponse.json({ productId: product.id, priceId: price.id, paymentLinkUrl });
}
