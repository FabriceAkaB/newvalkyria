import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { cancelOrder, createOrder, getProduct, getUniformBundleProducts, setOrderCheckoutSession } from "@/lib/shop-repo";
import { getStripeClient } from "@/lib/stripe";
import { shopCheckoutSchema } from "@/lib/validations";

interface ResolvedItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  unitPriceCents: number;
  quantity: number;
}

/** Offre "2e uniforme" — quand le panier contient au moins 1 chandail + 1 short
 *  + 1 paire de bas (produits marqués comme rôles du bundle), une paire de bas
 *  par combo devient gratuite. Recalculé côté serveur, jamais fait confiance au client. */
async function applyUniformBundleDiscount(items: ResolvedItem[]): Promise<ResolvedItem[]> {
  const { jersey, short, socks } = await getUniformBundleProducts();
  if (!jersey || !short || !socks) return items;

  const qtyFor = (productId: string) => items.filter((i) => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0);
  let freeRemaining = Math.min(qtyFor(jersey.id), qtyFor(short.id), qtyFor(socks.id));
  if (freeRemaining <= 0) return items;

  const result: ResolvedItem[] = [];
  for (const item of items) {
    if (item.productId === socks.id && freeRemaining > 0) {
      const freeQty = Math.min(freeRemaining, item.quantity);
      const paidQty = item.quantity - freeQty;
      freeRemaining -= freeQty;
      if (freeQty > 0) result.push({ ...item, quantity: freeQty, unitPriceCents: 0, variantLabel: "Offert — 2e uniforme" });
      if (paidQty > 0) result.push({ ...item, quantity: paidQty });
    } else {
      result.push(item);
    }
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const payload = shopCheckoutSchema.parse(await request.json());

    // ── Les prix et l'inventaire viennent toujours du serveur, jamais du client ──
    const resolvedItems: ResolvedItem[] = [];
    for (const cartItem of payload.items) {
      const product = await getProduct(cartItem.productId);
      if (!product || !product.active) return jsonError("Un des articles du panier n'est plus disponible.", 409);

      let variant = null;
      if (cartItem.variantId) {
        variant = product.variants.find((v) => v.id === cartItem.variantId) ?? null;
        if (!variant || !variant.active) return jsonError("Une des variantes choisies n'est plus disponible.", 409);
        if (variant.inventory_count < cartItem.quantity) {
          return jsonError(`Il ne reste plus assez de "${product.name} — ${variant.label}" en stock.`, 409);
        }
      } else if (product.inventory_count < cartItem.quantity) {
        return jsonError(`Il ne reste plus assez de "${product.name}" en stock.`, 409);
      }

      resolvedItems.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        productName: product.name,
        variantLabel: variant?.label ?? null,
        unitPriceCents: product.price_cents,
        quantity: cartItem.quantity
      });
    }

    const finalItems = await applyUniformBundleDiscount(resolvedItems);

    const { orderId, totalCents } = await createOrder({
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone || null,
      shippingAddress: payload.shippingAddress || null,
      shippingCity: payload.shippingCity || null,
      shippingPostalCode: payload.shippingPostalCode || null,
      items: finalItems
    });

    try {
      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payload.customerEmail,
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        line_items: finalItems.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "cad",
            product_data: { name: item.variantLabel ? `${item.productName} — ${item.variantLabel}` : item.productName },
            unit_amount: item.unitPriceCents
          }
        })),
        metadata: { checkoutType: "shop-order", orderId },
        success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/boutique?cancelled=1`
      });

      if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");

      await setOrderCheckoutSession(orderId, session.id);

      return NextResponse.json({ checkoutUrl: session.url, totalCents });
    } catch (stripeError) {
      await cancelOrder(orderId).catch(() => {});
      throw stripeError;
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
