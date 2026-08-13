import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { sendLeadNotificationEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { getInstallmentPlan } from "@/lib/payment-plan";
import { PROGRAMS, type ProgramCode } from "@/lib/season-2027";
import { SEASON_DB_ID, SLOT_DB_ID } from "@/lib/season-2027-db-map";
import {
  cancelRegistration,
  countActiveRegistrations,
  countPaidRegistrations,
  createPaymentPlan,
  createRegistration,
  deletePaymentPlan,
  getSeasonPrograms,
  getSeasonProgramCategories,
  getSeasonSlots,
  setRegistrationCheckoutSession
} from "@/lib/season-admin-repo";
import { cancelOrder, createOrder, getSignupBonusProduct, getUniformBundleProducts, setOrderCheckoutSession, type CreateOrderItemInput } from "@/lib/shop-repo";
import { getStripeClient } from "@/lib/stripe";
import { seasonCheckoutSchema } from "@/lib/validations";
import type Stripe from "stripe";

const SIGNUP_BONUS_FREE_THRESHOLD = 30;

export async function POST(request: Request) {
  try {
    const payload = seasonCheckoutSchema.parse(await request.json());

    const [programs, programCategories, slots] = await Promise.all([
      getSeasonPrograms(SEASON_DB_ID),
      getSeasonProgramCategories(SEASON_DB_ID),
      getSeasonSlots(SEASON_DB_ID)
    ]);

    const program = programs.find((p) => p.id === payload.programCode);
    if (!program) return jsonError("Programme introuvable", 404);

    const eligibleYears = PROGRAMS[payload.programCode as ProgramCode]?.eligibleYears;
    if (eligibleYears && !eligibleYears.includes(payload.year)) {
      return jsonError("Ce programme n'est pas disponible pour cette catégorie.", 409);
    }

    // ── Paiement en plusieurs fois — jamais confiance au choix du client,
    // l'éligibilité est recalculée ici à partir de la date serveur. ──
    const installmentPlan = payload.paymentPlan === "installments"
      ? getInstallmentPlan(new Date(), program.price_cents)
      : null;
    if (payload.paymentPlan === "installments" && !installmentPlan) {
      return jsonError("Le paiement en plusieurs fois n'est plus disponible pour ce mois.", 409);
    }

    const capacity = programCategories.find((pc) => pc.program_id === payload.programCode && pc.category_id === payload.year);
    if (capacity) {
      const taken = await countActiveRegistrations(SEASON_DB_ID, { programId: payload.programCode, categoryId: payload.year });
      if (taken >= capacity.max_places) {
        return jsonError("Ce programme est complet pour cette catégorie.", 409);
      }
    }

    const dbSlotId = payload.slotId ? SLOT_DB_ID[payload.slotId] : undefined;
    if (payload.slotId && !dbSlotId) return jsonError("Plage horaire introuvable", 404);

    if (dbSlotId) {
      const slot = slots.find((s) => s.id === dbSlotId);
      if (slot) {
        const taken = await countActiveRegistrations(SEASON_DB_ID, { timeSlotTemplateId: dbSlotId });
        if (taken >= slot.max_places) {
          return jsonError("Cette plage horaire vient d'être complétée.", 409);
        }
      }
    }

    // ── Articles boutique optionnels (sac cadeau + offre "2e uniforme") — un
    // seul bon de commande, combiné dans la même session Stripe que l'inscription ──
    const boutiqueItems: CreateOrderItemInput[] = [];

    if (payload.includeBag) {
      const bagProduct = await getSignupBonusProduct();
      if (bagProduct && bagProduct.inventory_count > 0) {
        const paidCount = await countPaidRegistrations(SEASON_DB_ID);
        const isFree = paidCount < SIGNUP_BONUS_FREE_THRESHOLD;
        boutiqueItems.push({
          productId: bagProduct.id,
          variantId: null,
          productName: bagProduct.name,
          variantLabel: isFree ? "Offert — 30 premiers clients" : null,
          unitPriceCents: isFree ? 0 : bagProduct.price_cents,
          quantity: 1
        });
      }
    }

    if (payload.uniformBundle) {
      const { jersey, short, socks } = await getUniformBundleProducts();
      if (jersey && short && socks) {
        const jerseyVariant = jersey.variants.find((v) => v.id === payload.uniformBundle!.jerseyVariantId);
        const shortVariant = short.variants.find((v) => v.id === payload.uniformBundle!.shortVariantId);
        if (!jerseyVariant || !jerseyVariant.active) return jsonError("Taille de chandail invalide.", 400);
        if (!shortVariant || !shortVariant.active) return jsonError("Taille de short invalide.", 400);
        if (jerseyVariant.inventory_count < 1) return jsonError(`Le chandail — ${jerseyVariant.label} n'est plus en stock.`, 409);
        if (shortVariant.inventory_count < 1) return jsonError(`Le short — ${shortVariant.label} n'est plus en stock.`, 409);
        if (socks.inventory_count < 1) return jsonError("Les bas offerts ne sont plus en stock.", 409);

        boutiqueItems.push(
          { productId: jersey.id, variantId: jerseyVariant.id, productName: jersey.name, variantLabel: jerseyVariant.label, unitPriceCents: jersey.price_cents, quantity: 1 },
          { productId: short.id, variantId: shortVariant.id, productName: short.name, variantLabel: shortVariant.label, unitPriceCents: short.price_cents, quantity: 1 },
          { productId: socks.id, variantId: null, productName: socks.name, variantLabel: "Offert — 2e uniforme", unitPriceCents: 0, quantity: 1 }
        );
      }
    }

    const registrationId = await createRegistration({
      seasonId: SEASON_DB_ID,
      programId: payload.programCode,
      categoryId: payload.year,
      timeSlotTemplateId: dbSlotId ?? null,
      parentName: payload.parentName,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone,
      city: payload.city,
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob ?? null,
      advancedGroup: payload.variant === "advanced",
      isTrial: false
    });

    let paymentPlanId: string | null = null;
    if (installmentPlan) {
      paymentPlanId = await createPaymentPlan({
        registrationId,
        totalAmountCents: installmentPlan.amountsCents.reduce((sum, c) => sum + c, 0),
        installments: installmentPlan.dueDates.map((date, i) => ({
          sequenceNo: i + 1,
          amountCents: installmentPlan.amountsCents[i],
          dueDate: date.toISOString().slice(0, 10)
        }))
      });
    }

    let boutiqueOrderId: string | null = null;
    if (boutiqueItems.length > 0) {
      const { orderId } = await createOrder({
        customerName: payload.parentName,
        customerEmail: payload.parentEmail,
        customerPhone: payload.parentPhone,
        shippingAddress: null,
        shippingCity: payload.city,
        shippingPostalCode: null,
        items: boutiqueItems,
        registrationId,
        seasonKey: SEASON_DB_ID
      });
      boutiqueOrderId = orderId;
    }

    try {
      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);

      const boutiqueLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = boutiqueItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "cad",
          product_data: { name: item.variantLabel ? `${item.productName} — ${item.variantLabel}` : item.productName },
          unit_amount: item.unitPriceCents
        }
      }));

      const programLineItemName = installmentPlan
        ? `${program.name} — Saison Automne/Hiver 2026 (1er versement sur ${installmentPlan.dueDates.length})`
        : `${program.name} — Saison Automne/Hiver 2026`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payload.parentEmail,
        payment_method_types: ["card"],
        // Pas de code promo avec un paiement échelonné : le rabais ne
        // s'appliquerait qu'au 1er versement, pas aux prélèvements
        // automatiques suivants (calculés indépendamment de Stripe).
        ...(installmentPlan ? {} : { allow_promotion_codes: true }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              product_data: { name: programLineItemName },
              unit_amount: installmentPlan ? installmentPlan.amountsCents[0] : program.price_cents
            }
          },
          ...boutiqueLineItems
        ],
        ...(installmentPlan
          ? { customer_creation: "always" as const, payment_intent_data: { setup_future_usage: "off_session" as const } }
          : {}),
        metadata: {
          checkoutType: "season-registration",
          seasonId: SEASON_DB_ID,
          registrationId,
          ...(boutiqueOrderId ? { boutiqueOrderId } : {}),
          ...(paymentPlanId ? { paymentPlanId } : {})
        },
        success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}${payload.cancelPath ?? "/inscription?cancelled=1"}`
      });

      if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");

      await setRegistrationCheckoutSession(registrationId, session.id);
      if (boutiqueOrderId) await setOrderCheckoutSession(boutiqueOrderId, session.id);

      void sendLeadNotificationEmail({
        parent_name: payload.parentName,
        email: payload.parentEmail,
        phone: payload.parentPhone,
        player_age: payload.year,
        player_level: "Intermédiaire",
        city: payload.city,
        goal: `Programme ${program.name} — Automne/Hiver 2026`,
        availability: payload.slotId ?? "Flexible",
        consent: true,
        player_name: `${payload.playerFirstName} ${payload.playerLastName}`.trim()
      }).catch((err) => console.error("Registration admin notification email error:", err));

      return NextResponse.json({ checkoutUrl: session.url });
    } catch (stripeError) {
      await cancelRegistration(registrationId).catch(() => {});
      if (boutiqueOrderId) await cancelOrder(boutiqueOrderId).catch(() => {});
      if (paymentPlanId) await deletePaymentPlan(paymentPlanId).catch(() => {});
      throw stripeError;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const firstMessage = error.issues[0]?.message ?? "Données invalides";
      return jsonError(firstMessage, 422);
    }
    if (error instanceof Error) {
      return jsonError(error.message, 422);
    }
    return jsonError("Erreur serveur", 500);
  }
}
