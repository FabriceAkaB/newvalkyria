import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { getInstallmentWithContext } from "@/lib/season-admin-repo";
import { PROGRAMS, type ProgramCode } from "@/lib/season-2027";
import { getStripeClient } from "@/lib/stripe";

/** Génère un lien de paiement Stripe pour UN versement précis d'un plan
 *  échelonné — utilisé quand la carte enregistrée d'une famille a échoué
 *  (versement en "failed"/"failed_final") et que le parent veut payer avec
 *  une autre carte. Contrairement à /api/admin/inscription/lien-direct, ceci
 *  ne crée AUCUNE nouvelle inscription : le versement existant est marqué
 *  payé par le webhook, et la nouvelle carte remplace l'ancienne sur le plan
 *  pour que les versements suivants soient prélevés dessus. */
export async function POST(_request: Request, { params }: { params: Promise<{ installmentId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { installmentId } = await params;

  const installment = await getInstallmentWithContext(installmentId);
  if (!installment) return jsonError("Versement introuvable", 404);
  if (installment.status === "paid") return jsonError("Ce versement est déjà payé.", 409);

  const programName = installment.programId ? PROGRAMS[installment.programId as ProgramCode]?.name ?? installment.programId : "programme";
  const playerName = [installment.playerFirstName, installment.playerLastName].filter(Boolean).join(" ") || "la joueuse";

  try {
    const stripe = getStripeClient();
    const baseUrl = getRequestOrigin(_request);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: installment.parentEmail,
      payment_method_types: ["card"],
      customer_creation: "always",
      payment_intent_data: { setup_future_usage: "off_session" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            product_data: { name: `${programName} — ${playerName} — Versement ${installment.sequenceNo}/${installment.installmentCount}` },
            unit_amount: installment.amountCents
          }
        }
      ],
      metadata: {
        checkoutType: "installment-retry",
        installmentId: installment.id,
        planId: installment.planId,
        registrationId: installment.registrationId
      },
      success_url: `${baseUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`
    });

    if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
