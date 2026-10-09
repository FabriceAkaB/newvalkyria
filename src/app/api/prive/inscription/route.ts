import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { findOrCreatePlayer } from "@/lib/players-repo";
import { getParentUserId } from "@/lib/parent-auth";
import { getParentAccount } from "@/lib/parent-repo";
import { computePrice, formatMoney, isBirthYearEligible } from "@/lib/private-programs";
import {
  createPrivateRegistration,
  findDuplicateRegistration,
  getPrivateProgram,
  isWithinCapacity,
  PRIVATE_RESERVATION_MINUTES,
  countHeldPlaces,
  setRegistrationStatus
} from "@/lib/private-programs-repo";
import { addLedgerEntry, createProgramReferral, getCreditBalance, normalizeEmail, resolveReferral } from "@/lib/referrals-repo";
import { getRequestOrigin } from "@/lib/request-origin";
import { createPaymentPlan, deletePaymentPlan, setRegistrationCheckoutSession } from "@/lib/session-programs-repo";
import { getStripeClient } from "@/lib/stripe";
import { privateProgramRegistrationSchema } from "@/lib/validations";

/** Inscription + paiement d'un programme garçons privé (non répertorié).
 *  Le serveur recalcule TOUT (prix, rabais, supplément, crédit) — le client
 *  n'envoie jamais de montant. */
export async function POST(request: Request) {
  try {
    const payload = privateProgramRegistrationSchema.parse(await request.json());
    const program = await getPrivateProgram(payload.programSlug);
    if (!program || !program.active || !program.published) return jsonError("Ce programme est introuvable ou fermé.", 404);

    // ── Admissibilité par année de naissance ──
    if (!isBirthYearEligible(payload.birthYear, program.eligible_birth_years)) {
      return NextResponse.json(
        {
          error: `Ce programme est réservé aux garçons nés en ${program.eligible_birth_years?.join(" et ")}. L'année de naissance ${payload.birthYear} n'est pas admissible.`,
          code: "birth_year_ineligible"
        },
        { status: 409 }
      );
    }

    const parentEmail = payload.parentEmail.trim();
    const parentName = `${payload.parentFirstName} ${payload.parentLastName}`.trim();

    // ── Double inscription accidentelle ──
    const duplicate = await findDuplicateRegistration(program.slug, parentEmail, payload.playerFirstName, payload.playerLastName);
    if (duplicate) {
      if (duplicate.status === "pending") {
        // Un paiement déjà commencé : on libère l'ancienne réservation, la nouvelle la remplace.
        await setRegistrationStatus(duplicate.id, "cancelled");
      } else {
        const msg = duplicate.status === "waitlist" ? "Ce joueur est déjà sur la liste d'attente." : "Ce joueur est déjà inscrit à ce programme.";
        return NextResponse.json({ error: msg, code: "duplicate" }, { status: 409 });
      }
    }

    if (payload.paymentOption === "two_installments" && !payload.autoDebitConsent) {
      return jsonError("Pour payer en 2 versements, vous devez autoriser le prélèvement du deuxième versement sur votre carte.", 422);
    }

    const playerId = await findOrCreatePlayer({
      firstName: payload.playerFirstName,
      lastName: payload.playerLastName,
      dob: payload.playerDob || null,
      parentEmail,
      parentPhone: payload.parentPhone
    });

    // ── Programme complet → liste d'attente (aucun paiement) ──
    const held = await countHeldPlaces(program.slug);
    if (held >= program.max_capacity) {
      const waitId = await createPrivateRegistration({
        programSlug: program.slug,
        playerId,
        playerFirstName: payload.playerFirstName,
        playerLastName: payload.playerLastName,
        playerDob: payload.playerDob || null,
        birthYear: payload.birthYear,
        parentName,
        parentEmail,
        parentPhone: payload.parentPhone,
        city: payload.city || null,
        comments: payload.comments || null,
        status: "waitlist",
        paymentOption: payload.paymentOption,
        listPriceCents: program.price_cents,
        referralDiscountCents: 0,
        creditAppliedCents: 0,
        installmentFeeCents: 0,
        totalDueCents: program.price_cents,
        autoDebitConsent: false
      });
      return NextResponse.json({ ok: true, waitlisted: true, registrationId: waitId });
    }

    // ── Référencement ──
    let referralDiscountCents = 0;
    let resolution: Awaited<ReturnType<typeof resolveReferral>> | null = null;
    const wantsReferral = payload.referral?.answer === "oui";
    if (wantsReferral) {
      resolution = await resolveReferral({
        codeOrEmail: payload.referral?.codeOrEmail,
        referrerName: payload.referral?.referrerName,
        parentEmail,
        parentName
      });
      if (resolution.selfReferral) {
        return jsonError("Une famille ne peut pas se recommander elle-même.", 422);
      }
      if (resolution.discountEligible) referralDiscountCents = program.referral_discount_cents;
    }

    // ── Crédit familial (seulement pour un parent connecté avec ce courriel) ──
    let creditCents = 0;
    if (payload.useCredit) {
      const userId = await getParentUserId();
      const account = userId ? await getParentAccount(userId) : null;
      if (account && normalizeEmail(account.email) === normalizeEmail(parentEmail)) {
        const balance = await getCreditBalance(parentEmail);
        creditCents = Math.max(0, Math.min(balance, program.price_cents - referralDiscountCents));
      }
    }

    const price = computePrice({
      listCents: program.price_cents,
      option: payload.paymentOption,
      installmentFeeCents: program.installment_fee_cents,
      referralDiscountCents,
      creditCents
    });

    const registrationId = await createPrivateRegistration({
      programSlug: program.slug,
      playerId,
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob || null,
      birthYear: payload.birthYear,
      parentName,
      parentEmail,
      parentPhone: payload.parentPhone,
      city: payload.city || null,
      comments: payload.comments || null,
      status: "pending",
      paymentOption: payload.paymentOption,
      listPriceCents: price.listCents,
      referralDiscountCents: price.referralDiscountCents,
      creditAppliedCents: price.creditCents,
      installmentFeeCents: price.installmentFeeCents,
      totalDueCents: price.totalCents,
      autoDebitConsent: Boolean(payload.autoDebitConsent)
    });

    // Deux parents sur la dernière place : l'ordre d'arrivée décide.
    if (!(await isWithinCapacity(program.slug, registrationId, program.max_capacity))) {
      await setRegistrationStatus(registrationId, "waitlist");
      return NextResponse.json({ ok: true, waitlisted: true, registrationId });
    }

    let paymentPlanId: string | null = null;
    let referralId: string | null = null;

    try {
      if (wantsReferral && resolution) {
        referralId = await createProgramReferral({
          registrationId,
          programSlug: program.slug,
          resolution,
          claimedReferrerName: payload.referral?.referrerName?.trim() || null,
          claimedPlayerName: payload.referral?.referrerPlayer?.trim() || null,
          claimedContact: payload.referral?.codeOrEmail?.trim() || null,
          discountCents: price.referralDiscountCents
        });
      }

      if (price.creditCents > 0) {
        await addLedgerEntry({ email: parentEmail, deltaCents: -price.creditCents, kind: "utilisation", registrationId, referralId, note: `Crédit utilisé — ${program.name}`, createdBy: "parent" });
      }

      if (payload.paymentOption === "two_installments") {
        const secondDue = program.second_installment_date
          ? new Date(`${program.second_installment_date}T12:00:00-04:00`)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        paymentPlanId = await createPaymentPlan({
          registrationId,
          totalAmountCents: price.totalCents,
          installments: [
            { sequenceNo: 1, amountCents: price.paymentsCents[0], dueDate: new Date().toISOString().slice(0, 10) },
            { sequenceNo: 2, amountCents: price.paymentsCents[1], dueDate: secondDue.toISOString().slice(0, 10) }
          ]
        });
      }

      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);
      const lineName = payload.paymentOption === "two_installments" ? `${program.name} — 1er versement sur 2` : program.name;
      const description =
        [
          `Prix du programme : ${formatMoney(price.listCents)}`,
          price.referralDiscountCents > 0 ? `Rabais de référencement : -${formatMoney(price.referralDiscountCents)}` : null,
          price.creditCents > 0 ? `Crédit familial : -${formatMoney(price.creditCents)}` : null,
          price.installmentFeeCents > 0 ? `Supplément 2 versements : +${formatMoney(price.installmentFeeCents)}` : null,
          `Total : ${formatMoney(price.totalCents)}`
        ]
          .filter(Boolean)
          .join(" · ") || undefined;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: parentEmail,
        payment_method_types: ["card"],
        expires_at: Math.floor(Date.now() / 1000) + PRIVATE_RESERVATION_MINUTES * 60,
        line_items: [
          {
            quantity: 1,
            price_data: { currency: "cad", product_data: { name: lineName, description }, unit_amount: price.paymentsCents[0] }
          }
        ],
        ...(payload.paymentOption === "two_installments"
          ? { customer_creation: "always" as const, payment_intent_data: { setup_future_usage: "off_session" as const } }
          : {}),
        metadata: {
          checkoutType: "sessionprogram",
          registrationId,
          programSlug: program.slug,
          privateProgram: "true",
          ...(paymentPlanId ? { paymentPlanId } : {})
        },
        success_url: `${baseUrl}/prive/${program.slug}/confirmation?registrationId=${registrationId}`,
        cancel_url: `${baseUrl}/prive/${program.slug}?cancelled=1`
      });
      if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");

      await setRegistrationCheckoutSession(registrationId, session.id);
      return NextResponse.json({ ok: true, registrationId, checkoutUrl: session.url, price });
    } catch (error) {
      // Rien ne doit rester réservé si le paiement n'a pas pu démarrer.
      await setRegistrationStatus(registrationId, "cancelled").catch(() => {});
      if (paymentPlanId) await deletePaymentPlan(paymentPlanId).catch(() => {});
      if (price.creditCents > 0) {
        await addLedgerEntry({ email: parentEmail, deltaCents: price.creditCents, kind: "annulation_utilisation", registrationId, referralId, note: "Paiement non démarré", createdBy: "systeme" }).catch(() => {});
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
