import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getInstallmentPlan } from "@/lib/payment-plan";
import { getRequestOrigin } from "@/lib/request-origin";
import { PROGRAMS, type ProgramCode } from "@/lib/season-2027";
import { SEASON_DB_ID, SLOT_DB_ID } from "@/lib/season-2027-db-map";
import {
  cancelRegistration,
  countActiveRegistrations,
  createPaymentPlan,
  createRegistration,
  deletePaymentPlan,
  getSeasonProgramCategories,
  getSeasonPrograms,
  getSeasonSlots,
  setRegistrationCheckoutSession
} from "@/lib/season-admin-repo";
import { getStripeClient } from "@/lib/stripe";

/** Génère un vrai lien checkout.stripe.com sans connaître l'identité du
 *  client à l'avance — le parent saisit son nom, courriel, téléphone et le
 *  nom de la joueuse DIRECTEMENT sur la page Stripe (custom_fields +
 *  collecte native email/téléphone). L'inscription est créée avec des
 *  valeurs "à compléter" et complétée par le webhook une fois le paiement
 *  reçu (voir completeDirectLinkRegistration). Réservé à l'admin — jamais
 *  exposé publiquement, car il saute la validation/anti-abus du tunnel
 *  normal. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    programCode?: ProgramCode;
    year?: "2017" | "2016" | "2015" | "2014-2013";
    slotId?: string;
    paymentPlan?: "full" | "installments";
  } | null;

  if (!body?.programCode || !body.year) return jsonError("Programme et année requis", 400);

  const [programs, programCategories, slots] = await Promise.all([
    getSeasonPrograms(SEASON_DB_ID),
    getSeasonProgramCategories(SEASON_DB_ID),
    getSeasonSlots(SEASON_DB_ID)
  ]);

  const program = programs.find((p) => p.id === body.programCode);
  if (!program) return jsonError("Programme introuvable", 404);

  const eligibleYears = PROGRAMS[body.programCode]?.eligibleYears;
  if (eligibleYears && !eligibleYears.includes(body.year)) {
    return jsonError("Ce programme n'est pas disponible pour cette catégorie.", 409);
  }

  const installmentPlan = body.paymentPlan === "installments" ? getInstallmentPlan(new Date(), program.price_cents) : null;
  if (body.paymentPlan === "installments" && !installmentPlan) {
    return jsonError("Le paiement en plusieurs fois n'est plus disponible pour ce mois.", 409);
  }

  const capacity = programCategories.find((pc) => pc.program_id === body.programCode && pc.category_id === body.year);
  if (capacity) {
    const taken = await countActiveRegistrations(SEASON_DB_ID, { programId: body.programCode, categoryId: body.year });
    if (taken >= capacity.max_places) return jsonError("Ce programme est complet pour cette catégorie.", 409);
  }

  const dbSlotId = body.slotId ? SLOT_DB_ID[body.slotId] : undefined;
  if (body.slotId && !dbSlotId) return jsonError("Plage horaire introuvable", 404);
  if (dbSlotId) {
    const slot = slots.find((s) => s.id === dbSlotId);
    if (slot) {
      const taken = await countActiveRegistrations(SEASON_DB_ID, { timeSlotTemplateId: dbSlotId });
      if (taken >= slot.max_places) return jsonError("Cette plage horaire vient d'être complétée.", 409);
    }
  }

  // Placeholders — jamais affichés au parent, remplacés par le webhook dès
  // que Stripe a collecté les vraies infos. playerFirstName/LastName restent
  // null pour que createRegistration ne crée pas de joueuse fantôme.
  const registrationId = await createRegistration({
    seasonId: SEASON_DB_ID,
    programId: body.programCode,
    categoryId: body.year,
    timeSlotTemplateId: dbSlotId ?? null,
    parentName: "(à compléter — lien direct)",
    parentEmail: "en-attente@newvalkyria.temp",
    parentPhone: "",
    city: null,
    playerFirstName: null,
    playerLastName: null,
    playerDob: null,
    advancedGroup: false,
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

  try {
    const stripe = getStripeClient();
    const baseUrl = getRequestOrigin(request);

    const customFields: Stripe.Checkout.SessionCreateParams.CustomField[] = [
      { key: "parent_name", label: { type: "custom", custom: "Nom complet du parent" }, type: "text" },
      { key: "player_name", label: { type: "custom", custom: "Nom complet de la joueuse" }, type: "text" }
    ];

    const programLineItemName = installmentPlan
      ? `${program.name} — Saison Automne/Hiver 2026 (1er versement sur ${installmentPlan.dueDates.length})`
      : `${program.name} — Saison Automne/Hiver 2026`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      phone_number_collection: { enabled: true },
      custom_fields: customFields,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            product_data: { name: programLineItemName },
            unit_amount: installmentPlan ? installmentPlan.amountsCents[0] : program.price_cents
          }
        }
      ],
      ...(installmentPlan
        ? { customer_creation: "always" as const, payment_intent_data: { setup_future_usage: "off_session" as const } }
        : {}),
      metadata: {
        checkoutType: "season-registration",
        seasonId: SEASON_DB_ID,
        registrationId,
        isDirectLink: "true",
        ...(paymentPlanId ? { paymentPlanId } : {})
      },
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/inscription?cancelled=1`
    });

    if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");

    await setRegistrationCheckoutSession(registrationId, session.id);

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    await cancelRegistration(registrationId).catch(() => {});
    if (paymentPlanId) await deletePaymentPlan(paymentPlanId).catch(() => {});
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
