import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getIntensifInstallmentPlan, INTENSIF_3X_SURCHARGE_CENTS } from "@/lib/payment-plan";
import { findOrCreatePlayer } from "@/lib/players-repo";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  cancelRegistration,
  countActiveRegistrations,
  createPaymentPlan,
  createRegistration,
  deletePaymentPlan,
  getProgram,
  setRegistrationCheckoutSession
} from "@/lib/session-programs-repo";
import { getStripeClient } from "@/lib/stripe";
import { sessionProgramRegistrationSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const payload = sessionProgramRegistrationSchema.parse(await request.json());
    const program = await getProgram(payload.programSlug);
    if (!program || !program.active) return jsonError("Programme introuvable ou inactif.", 404);

    const count = await countActiveRegistrations(payload.programSlug);
    if (count >= program.max_capacity) {
      return jsonError(`${program.name} est complet pour le moment.`, 409);
    }

    // Le paiement en plusieurs fois n'est offert que sur le Programme Intensif.
    const installments = payload.programSlug === "intensif-garcons" ? (payload.installments ?? 1) : 1;
    const totalCents = program.price_cents + (installments === 3 ? INTENSIF_3X_SURCHARGE_CENTS : 0);
    const installmentPlan = installments > 1 ? getIntensifInstallmentPlan(installments as 2 | 3, new Date(), totalCents) : null;

    const playerId = await findOrCreatePlayer({
      firstName: payload.playerFirstName,
      lastName: payload.playerLastName,
      dob: payload.playerDob || null,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone
    });

    const registrationId = await createRegistration({
      programSlug: payload.programSlug,
      playerId,
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob || null,
      parentName: payload.parentName,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone,
      city: payload.city || null,
      comments: payload.comments || null,
      termsAccepted: payload.termsAccepted,
      priceCents: totalCents
    });

    let paymentPlanId: string | null = null;
    if (installmentPlan) {
      paymentPlanId = await createPaymentPlan({
        registrationId,
        totalAmountCents: totalCents,
        installments: installmentPlan.dueDates.map((date, i) => ({
          sequenceNo: i + 1,
          amountCents: installmentPlan.amountsCents[i],
          dueDate: date.toISOString().slice(0, 10)
        }))
      });
    }

    try {
      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);

      const lineItemName = installmentPlan ? `${program.name} (1er versement sur ${installments})` : program.name;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payload.parentEmail,
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: { currency: "cad", product_data: { name: lineItemName }, unit_amount: installmentPlan ? installmentPlan.amountsCents[0] : totalCents }
          }
        ],
        ...(installmentPlan ? { customer_creation: "always" as const, payment_intent_data: { setup_future_usage: "off_session" as const } } : {}),
        metadata: {
          checkoutType: "sessionprogram",
          registrationId,
          programSlug: payload.programSlug,
          ...(paymentPlanId ? { paymentPlanId } : {})
        },
        success_url: `${baseUrl}/programmes/${payload.programSlug}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/programmes/${payload.programSlug}?cancelled=1`
      });

      if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");

      await setRegistrationCheckoutSession(registrationId, session.id);
      return NextResponse.json({ ok: true, registrationId, checkoutUrl: session.url });
    } catch (stripeError) {
      await cancelRegistration(registrationId).catch(() => {});
      if (paymentPlanId) await deletePaymentPlan(paymentPlanId).catch(() => {});
      throw stripeError;
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
