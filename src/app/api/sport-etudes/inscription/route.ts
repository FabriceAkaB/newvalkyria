import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getSportEtudesInstallmentPlan } from "@/lib/payment-plan";
import { findOrCreatePlayer } from "@/lib/players-repo";
import { getRequestOrigin } from "@/lib/request-origin";
import {
  cancelRegistration,
  confirmRegistration,
  countFullProgramRegistrations,
  createPaymentPlan,
  createRegistration,
  deletePaymentPlan,
  enrollInDiagnosticOnly,
  getSettings,
  setRegistrationCheckoutSession
} from "@/lib/sport-etudes-repo";
import { getStripeClient } from "@/lib/stripe";
import { sportEtudesRegistrationSchema } from "@/lib/validations";

const FULL_PROGRAM_PRICE_CENTS = 31595;

export async function POST(request: Request) {
  try {
    const payload = sportEtudesRegistrationSchema.parse(await request.json());
    const installmentPlan =
      payload.optionChosen === "full_program" && payload.paymentPlan === "installments"
        ? getSportEtudesInstallmentPlan(new Date(), FULL_PROGRAM_PRICE_CENTS)
        : null;

    if (payload.optionChosen === "full_program") {
      const [settings, count] = await Promise.all([getSettings(), countFullProgramRegistrations()]);
      if (count + settings.manual_reserved_spots >= settings.max_capacity) {
        return jsonError("Le programme Sport-Études est complet pour le moment.", 409);
      }
    }

    const playerId = await findOrCreatePlayer({
      firstName: payload.playerFirstName,
      lastName: payload.playerLastName,
      dob: payload.playerDob || null,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone
    });

    const registrationId = await createRegistration({
      playerId,
      parentUserId: null,
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob || null,
      playerBirthYear: payload.playerBirthYear || null,
      playerLevel: payload.playerLevel || null,
      primaryPosition: payload.primaryPosition || null,
      secondaryPosition: payload.secondaryPosition || null,
      currentTeam: payload.currentTeam || null,
      currentClub: payload.currentClub || null,
      soccerExperience: payload.soccerExperience || null,
      playerGoals: payload.playerGoals || null,
      parentAssessedStrengths: payload.parentAssessedStrengths || null,
      parentAssessedAreasToImprove: payload.parentAssessedAreasToImprove || null,
      parentFirstName: payload.parentFirstName,
      parentLastName: payload.parentLastName,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone,
      parentRelationship: payload.parentRelationship || null,
      sportEtudesExperience: payload.sportEtudesExperience || null,
      priorEvaluationsDone: payload.priorEvaluationsDone || null,
      targetSportEtudesProgram: payload.targetSportEtudesProgram || null,
      comments: payload.comments || null,
      importantCoachInfo: payload.importantCoachInfo || null,
      termsAccepted: payload.termsAccepted,
      optionChosen: payload.optionChosen,
      priceCents: payload.optionChosen === "full_program" ? FULL_PROGRAM_PRICE_CENTS : 0
    });

    if (payload.optionChosen === "diagnostic_only") {
      await enrollInDiagnosticOnly(registrationId);
      await confirmRegistration(registrationId);
      return NextResponse.json({ ok: true, registrationId, checkoutUrl: null });
    }

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

    try {
      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);

      const lineItemName = installmentPlan
        ? "Programme technique de préparation aux évaluations du Sport-Études (1er versement sur 2)"
        : "Programme technique de préparation aux évaluations du Sport-Études";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payload.parentEmail,
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              product_data: { name: lineItemName },
              unit_amount: installmentPlan ? installmentPlan.amountsCents[0] : FULL_PROGRAM_PRICE_CENTS
            }
          }
        ],
        ...(installmentPlan
          ? { customer_creation: "always" as const, payment_intent_data: { setup_future_usage: "off_session" as const } }
          : {}),
        metadata: {
          checkoutType: "sportetudes",
          registrationId,
          ...(paymentPlanId ? { paymentPlanId } : {})
        },
        success_url: `${baseUrl}/sport-etudes/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/sport-etudes?cancelled=1`
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
