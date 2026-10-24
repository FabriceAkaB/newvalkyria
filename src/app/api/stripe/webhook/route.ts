import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { programEmailLabel, sendConfirmationEmail, sendMatchSlotsConfirmationEmail, sendPaidRegistrationNotification, sendSponsorshipPaidNotification, sendShopOrderConfirmationEmail, sendTerrainRentalConfirmationEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit-repo";
import { env } from "@/lib/env";
import { markLeadPaidInSheet } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { hasProcessedStripeEvent, markLeadAsPaid, recordStripeEvent } from "@/lib/repositories";
import { PROGRAMS, type ProgramCode } from "@/lib/season-2027";
import {
  activatePaymentPlan,
  completeDirectLinkRegistration,
  markInstallmentPaid,
  markRegistrationPaidByCheckoutSession,
  setRegistrationCheckoutSession,
  updatePaymentPlanCard
} from "@/lib/season-admin-repo";
import { markOrderPaidByCheckoutSession } from "@/lib/shop-repo";
import {
  activatePaymentPlan as activateSessionProgramPaymentPlan,
  enrollInAllDates,
  markRegistrationPaidByCheckoutSession as markSessionProgramRegistrationPaid
} from "@/lib/session-programs-repo";
import {
  activatePaymentPlan as activateSportEtudesPaymentPlan,
  enrollInAllActiveSessions,
  markRegistrationPaid as markSportEtudesRegistrationPaid
} from "@/lib/sport-etudes-repo";
import { onPrivateCheckoutExpired, onPrivateRefund, onPrivateRegistrationPaid } from "@/lib/private-programs-lifecycle";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { markBookingsPaid, releaseBySession as releaseMatchBySession, toEmailSlots } from "@/lib/match-slots-repo";
import { closeOtherOffersForSlot, onPartnershipOptionPaid } from "@/lib/partnership-offers";
import { markRentalPaid, releaseRentalBySession } from "@/lib/terrain-rentals-repo";
import { getOfferByToken, markOfferPaid } from "@/lib/special-offers";

export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    return jsonError("STRIPE_WEBHOOK_SECRET manquant", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Signature Stripe absente", 400);
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch {
    return jsonError("Webhook Stripe invalide", 400);
  }

  if (await hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ received: true, duplicated: true });
  }

  await recordStripeEvent(event.id, event);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutType = session.metadata?.checkoutType ?? (session.mode === "setup" ? "trial" : "elite");

    // ── Saison Automne/Hiver 2026 — inscriptions en base de données ──
    if (checkoutType === "season-registration") {
      // ── Lien direct admin (voir /api/admin/inscription/lien-direct) — le
      // parent a saisi son identité directement sur la page Stripe plutôt
      // que dans notre formulaire ; on la récupère ici avant de marquer payé. ──
      if (session.metadata?.isDirectLink === "true" && session.metadata.registrationId) {
        const customField = (key: string) => session.custom_fields?.find((f) => f.key === key)?.text?.value?.trim();
        const parentName = customField("parent_name") || "Parent (Stripe)";
        const rawPlayerName = customField("player_name") || "";
        const [playerFirstName, ...playerLastParts] = rawPlayerName.split(/\s+/).filter(Boolean);
        const playerLastName = playerLastParts.join(" ");
        try {
          // Un Payment Link n'a pas de session connue à l'avance : on rattache
          // la session Stripe à l'inscription ici, avant de la marquer payée.
          await setRegistrationCheckoutSession(session.metadata.registrationId, session.id);
          await completeDirectLinkRegistration(session.metadata.registrationId, {
            parentName,
            parentEmail: session.customer_details?.email ?? "inconnu@newvalkyria.temp",
            parentPhone: session.customer_details?.phone ?? null,
            playerFirstName: playerFirstName || "Joueuse",
            playerLastName: playerLastName || "(nom à confirmer)"
          });
        } catch (error) {
          console.error("Unable to complete direct-link registration from Stripe data", error);
        }
      }

      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const registration = await markRegistrationPaidByCheckoutSession(session.id, paymentIntentId);
      if (registration) {
        try {
          const programName = registration.program_id ? PROGRAMS[registration.program_id as ProgramCode]?.name : undefined;
          await sendConfirmationEmail({ to: registration.parent_email, parentName: registration.parent_name, programName });
        } catch (error) {
          console.error("Unable to send season confirmation email", error);
        }
        const seasonProgram = registration.program_id ? PROGRAMS[registration.program_id as ProgramCode]?.name : undefined;
        await notifyPaidRegistration(seasonProgram ?? "Saison New Valkyria", registration as any, session, session.metadata?.paymentPlanId ? "Paiement en versements" : undefined);
      }

      // Paiement échelonné — enregistre la carte (client + méthode) sur le
      // plan pour permettre les prélèvements automatiques des versements
      // suivants, et marque le 1er versement comme payé.
      const paymentPlanId = session.metadata?.paymentPlanId;
      if (paymentPlanId && paymentIntentId) {
        try {
          const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
          const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId);
          const stripePaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : undefined;
          if (stripeCustomerId && stripePaymentMethodId) {
            await activatePaymentPlan(paymentPlanId, {
              stripeCustomerId,
              stripePaymentMethodId,
              firstInstallmentPaymentIntentId: paymentIntentId
            });
          } else {
            console.error("Payment plan activation missing customer or payment method", { paymentPlanId, stripeCustomerId, stripePaymentMethodId });
          }
        } catch (error) {
          console.error("Unable to activate payment plan", error);
        }
      }

      // Sac offert/ajouté en option (même session Stripe) — même appel que la boutique,
      // décrémente l'inventaire automatiquement ; pas de courriel séparé pour éviter le doublon.
      await markOrderPaidByCheckoutSession(session.id, paymentIntentId).catch((error) => {
        console.error("Unable to mark signup-bonus bag order as paid", error);
      });
      return NextResponse.json({ received: true });
    }

    // ── Commandite 2027 payée par lien Stripe (programme de partenariat : Titre, Majeur,
    // Signature, Manche, Site). Crée le commanditaire « Payé » dans l'admin et avise l'académie. ──
    if (checkoutType === "sponsorship") {
      try {
        const supabase = getSupabaseAdminClient() as any;
        const field = (key: string) => session.custom_fields?.find((f) => f.key === key)?.text?.value?.trim() || null;
        const company = field("company_name") || session.customer_details?.name || "Entreprise (Stripe)";
        const contactName = field("contact_person") || session.customer_details?.name || null;
        const tier = session.metadata?.tier ?? "";
        const tierLabel = session.metadata?.tierLabel ?? "Commandite";
        const placement = session.metadata?.placement ?? "";
        const amountCents = session.amount_total ?? 0;
        const category = tier === "titre" || tier === "majeur" ? "principal" : tier === "site" ? "evenement" : "equipement";
        const { data: sponsor, error } = await supabase
          .from("sponsors")
          .insert({
            company_name: company,
            contact_name: contactName,
            contact_email: session.customer_details?.email ?? null,
            contact_phone: session.customer_details?.phone ?? null,
            category,
            partnership_type: `${tierLabel} — ${placement} (2027)`,
            proposed_amount_cents: amountCents,
            status: "paye",
            notes: `Payé par lien Stripe (${session.metadata?.slot ?? tier}). Secteur d'activité : ${field("sector") ?? "—"}. Session ${session.id}.`
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        if (session.metadata?.slot) {
          await supabase
            .from("sponsor_slots_2027")
            .update({ status: "sold", sponsor_id: sponsor.id, updated_at: new Date().toISOString() })
            .eq("slot_key", session.metadata.slot);
          // Emplacement vendu : les propositions personnalisées qui le visaient se ferment.
          await closeOtherOffersForSlot(session.metadata.slot, null);
        }
        await supabase.from("sponsor_payments").insert({
          sponsor_id: sponsor.id,
          amount_cents: amountCents,
          paid_at: new Date().toISOString(),
          method: "Stripe",
          note: `Lien de paiement ${session.metadata?.slot ?? tier}`
        });
        await sendSponsorshipPaidNotification({
          company,
          contactName,
          contactEmail: session.customer_details?.email ?? null,
          contactPhone: session.customer_details?.phone ?? null,
          sector: field("sector"),
          tierLabel,
          placement,
          amountCents
        }).catch((error) => console.error("Unable to send sponsorship notification", error));
      } catch (error) {
        console.error("Unable to record sponsorship payment", error);
      }
      return NextResponse.json({ received: true });
    }

    // ── Proposition de partenariat personnalisée (ex. Alowa, Action Sport Physio) : option payée. ──
    if (checkoutType === "partnership-offer") {
      const offerId = session.metadata?.offerId;
      const optionId = session.metadata?.optionId;
      if (offerId && optionId) {
        try {
          const result = await onPartnershipOptionPaid({
            offerId,
            optionId,
            amountCents: session.amount_total ?? 0,
            sessionId: session.id,
            email: session.customer_details?.email ?? null,
            phone: session.customer_details?.phone ?? null
          });
          if (result) {
            await sendSponsorshipPaidNotification({
              company: result.offer.company_name,
              contactName: result.offer.contact_name,
              contactEmail: session.customer_details?.email ?? result.offer.contact_email,
              contactPhone: session.customer_details?.phone ?? null,
              sector: null,
              tierLabel: result.option.label,
              placement: result.option.slot_key ? `chandail (${result.option.slot_key})` : "proposition personnalisée",
              amountCents: session.amount_total ?? 0
            }).catch((error) => console.error("Unable to send partnership notification", error));
          }
        } catch (error) {
          console.error("Unable to record partnership offer payment", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Essai → inscription : lien de paiement direct envoyé après un essai. L'inscription
    // existe déjà (formulaire rempli pour l'essai) : on la convertit en inscription payée,
    // sans redemander le formulaire. ──
    if (checkoutType === "trial-conversion") {
      const registrationId = session.metadata?.registrationId;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      if (registrationId) {
        try {
          const supabase = getSupabaseAdminClient() as any;
          const patch: Record<string, unknown> = {
            status: "paid",
            is_trial: false,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            updated_at: new Date().toISOString()
          };
          if (session.metadata?.programId) patch.program_id = session.metadata.programId;
          if (session.metadata?.timeSlotTemplateId) patch.time_slot_template_id = session.metadata.timeSlotTemplateId;
          const { data: registration } = await supabase.from("registrations").update(patch).eq("id", registrationId).select("*").maybeSingle();
          await logAudit({
            actorRole: "system",
            actorLabel: "Paiement Stripe",
            action: "trial_converted",
            entityType: "registration",
            entityId: registrationId,
            entityLabel: registration ? `${registration.player_first_name} ${registration.player_last_name}`.trim() : null,
            before: { is_trial: true },
            after: { status: "paid", program_id: session.metadata?.programId ?? null, amount_cents: session.amount_total }
          });
          if (registration) {
            const programName = registration.program_id ? PROGRAMS[registration.program_id as ProgramCode]?.name : undefined;
            await sendConfirmationEmail({ to: registration.parent_email, parentName: registration.parent_name, programName }).catch((error) =>
              console.error("Unable to send trial conversion confirmation", error)
            );
            await notifyPaidRegistration(programName ?? "Saison New Valkyria", registration, session, "Essai converti en inscription");
          }
        } catch (error) {
          console.error("Unable to convert trial registration", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Offre spéciale (ex. 2 pour 1 pour deux sœurs) : un seul paiement inscrit toutes
    // les joueuses de l'offre, chacune dans son groupe. ──
    if (checkoutType === "special-offer") {
      const token = session.metadata?.offerToken;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const offer = token ? await getOfferByToken(token) : null;
      if (offer && !offer.paid_at) {
        const supabase = getSupabaseAdminClient() as any;
        let first: any = null;
        for (const [i, item] of offer.registrations.entries()) {
          try {
            const { data: registration } = await supabase
              .from("registrations")
              .update({
                status: "paid",
                is_trial: false,
                program_id: item.programId,
                time_slot_template_id: item.timeSlotTemplateId,
                // La session Stripe n'est rattachée qu'à la 1re inscription ; le paiement est partagé.
                stripe_checkout_session_id: i === 0 ? session.id : null,
                stripe_payment_intent_id: paymentIntentId,
                updated_at: new Date().toISOString()
              })
              .eq("id", item.registrationId)
              .select("*")
              .maybeSingle();
            await logAudit({
              actorRole: "system",
              actorLabel: "Paiement Stripe",
              action: "special_offer_paid",
              entityType: "registration",
              entityId: item.registrationId,
              entityLabel: item.playerName,
              before: null,
              after: { status: "paid", program_id: item.programId, offer: offer.title, amount_cents: session.amount_total }
            });
            if (registration) {
              first ??= registration;
              await notifyPaidRegistration(PROGRAMS[item.programId as ProgramCode]?.name ?? item.programId, registration, session, `${offer.title} · ${item.groupLabel}`);
            }
          } catch (error) {
            console.error("Unable to apply special offer registration", error);
          }
        }
        await markOfferPaid(offer.token, session.id, paymentIntentId);
        if (first) {
          const programName = PROGRAMS[offer.registrations[0].programId as ProgramCode]?.name;
          await sendConfirmationEmail({ to: first.parent_email, parentName: first.parent_name, programName }).catch((error) =>
            console.error("Unable to send special offer confirmation", error)
          );
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Complément de saison : une joueuse inscrite à la demi-saison paie la 2e moitié
    // (lien de paiement envoyé par l'admin). Sa place devient une inscription saison complète. ──
    if (checkoutType === "season-completion") {
      const registrationId = session.metadata?.registrationId;
      if (registrationId) {
        try {
          const supabase = getSupabaseAdminClient() as any;
          const { data: before } = await supabase.from("registrations").select("player_first_name, player_last_name, is_half_season, half_season_ends_on").eq("id", registrationId).maybeSingle();
          await supabase.from("registrations").update({ is_half_season: false, half_season_ends_on: null, updated_at: new Date().toISOString() }).eq("id", registrationId);
          await logAudit({
            actorRole: "system",
            actorLabel: "Paiement Stripe",
            action: "season_completion",
            entityType: "registration",
            entityId: registrationId,
            entityLabel: before ? `${before.player_first_name} ${before.player_last_name}`.trim() : null,
            before: before ? { is_half_season: before.is_half_season, half_season_ends_on: before.half_season_ends_on } : null,
            after: { is_half_season: false, half_season_ends_on: null, amount_cents: session.amount_total }
          });
          await notifyPaidRegistration("Complément de saison (2e moitié)", before, session);
        } catch (error) {
          console.error("Unable to complete half-season registration", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Lien de paiement de remplacement pour un versement échelonné en
    // échec — voir /api/admin/paiements-echelonnes/[id]/lien-paiement. Marque
    // uniquement ce versement payé et remplace la carte du plan par la
    // nouvelle, sans toucher au statut de l'inscription (déjà "paid" depuis
    // le 1er versement) ni renvoyer de courriel de confirmation d'inscription. ──
    if (checkoutType === "installment-retry") {
      const installmentId = session.metadata?.installmentId;
      const planId = session.metadata?.planId;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      if (installmentId && paymentIntentId) {
        try {
          await markInstallmentPaid(installmentId, paymentIntentId);
          if (planId) {
            const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
            const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId);
            const stripePaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : undefined;
            if (stripeCustomerId && stripePaymentMethodId) {
              await updatePaymentPlanCard(planId, { stripeCustomerId, stripePaymentMethodId });
            }
          }
        } catch (error) {
          console.error("Unable to process installment retry payment", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Programme Sport-Études — paiement unique ou en 2 versements ──
    if (checkoutType === "sportetudes") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const registration = await markSportEtudesRegistrationPaid(session.id, paymentIntentId);
      if (registration) {
        await enrollInAllActiveSessions(registration.id);
        try {
          await sendConfirmationEmail({ to: registration.parent_email, parentName: `${registration.parent_first_name} ${registration.parent_last_name}`.trim() });
        } catch (error) {
          console.error("Unable to send Sport-Études confirmation email", error);
        }
        await notifyPaidRegistration("Programme Sport-Études", registration as any, session, session.metadata?.paymentPlanId ? "Paiement en 2 versements" : undefined);
      }

      // Paiement échelonné (2 versements) — enregistre la carte pour le
      // prélèvement automatique du 2e versement, marque le 1er comme payé.
      const paymentPlanId = session.metadata?.paymentPlanId;
      if (paymentPlanId && paymentIntentId) {
        try {
          const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
          const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId);
          const stripePaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : undefined;
          if (stripeCustomerId && stripePaymentMethodId) {
            await activateSportEtudesPaymentPlan(paymentPlanId, {
              stripeCustomerId,
              stripePaymentMethodId,
              firstInstallmentPaymentIntentId: paymentIntentId
            });
          } else {
            console.error("Sport-Études payment plan activation missing customer or payment method", { paymentPlanId, stripeCustomerId, stripePaymentMethodId });
          }
        } catch (error) {
          console.error("Unable to activate Sport-Études payment plan", error);
        }
      }

      return NextResponse.json({ received: true });
    }

    // ── Programmes à dates fixes (Privilège Valkyria / Programme Intensif) — paiement unique ou en 2-3 versements ──
    if (checkoutType === "sessionprogram") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const registration = await markSessionProgramRegistrationPaid(session.id, paymentIntentId);
      const isPrivateProgram = session.metadata?.privateProgram === "true";
      if (registration) {
        await enrollInAllDates(registration.id, registration.program_slug as "privilege-valkyria" | "intensif-garcons");
        if (!isPrivateProgram) {
          try {
            await sendConfirmationEmail({ to: registration.parent_email, parentName: registration.parent_name });
          } catch (error) {
            console.error("Unable to send session-program confirmation email", error);
          }
        }
      }

      const paymentPlanId = session.metadata?.paymentPlanId;
      if (paymentPlanId && paymentIntentId) {
        try {
          const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
          const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId);
          const stripePaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : undefined;
          if (stripeCustomerId && stripePaymentMethodId) {
            await activateSessionProgramPaymentPlan(paymentPlanId, { stripeCustomerId, stripePaymentMethodId, firstInstallmentPaymentIntentId: paymentIntentId });
          } else {
            console.error("Session-program payment plan activation missing customer or payment method", { paymentPlanId, stripeCustomerId, stripePaymentMethodId });
          }
        } catch (error) {
          console.error("Unable to activate session-program payment plan", error);
        }
      }

      // Programmes privés : validation du référencement, récompense et courriel détaillé
      // (après l'activation du plan, pour que les montants soient à jour).
      if (registration && isPrivateProgram) {
        try {
          await onPrivateRegistrationPaid(registration as any);
        } catch (error) {
          console.error("Unable to finalize private program registration", error);
        }
      }
      if (registration) {
        const pkg = (registration as any).package === "samedi" ? "Forfait samedi" : null;
        const plan = session.metadata?.paymentPlanId ? "Paiement en versements" : null;
        await notifyPaidRegistration(await sessionProgramName(registration.program_slug), registration as any, session, [pkg, plan].filter(Boolean).join(" · ") || undefined);
      }

      return NextResponse.json({ received: true });
    }

    // ── Matchs vendus à d'autres académies — plages payées ──
    if (checkoutType === "match-slot") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const bookings = await markBookingsPaid(session.id, paymentIntentId);
      if (bookings.length > 0) {
        try {
          await sendMatchSlotsConfirmationEmail({
            to: bookings[0].contact_email,
            contactName: bookings[0].contact_name,
            orgName: bookings[0].org_name,
            teamLabel: bookings[0].team_label,
            slots: toEmailSlots(bookings)
          });
          await (getSupabaseAdminClient() as any).from("match_slot_bookings").update({ confirmation_sent_at: new Date().toISOString() }).in("id", bookings.map((b) => b.id));
        } catch (error) {
          console.error("Unable to send match slot confirmation email", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Location de terrain — créneau payé ──
    if (checkoutType === "terrain-rental") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const rental = await markRentalPaid(session.id, paymentIntentId);
      if (rental) {
        try {
          const { data: terrain } = await (getSupabaseAdminClient() as any).from("terrains").select("name, address").eq("id", rental.terrain_id).maybeSingle();
          await sendTerrainRentalConfirmationEmail({
            to: rental.contact_email,
            contactName: rental.contact_name,
            organizationName: rental.organization_name,
            terrainName: terrain?.name ?? "Terrain",
            terrainAddress: terrain?.address ?? null,
            date: rental.rental_date,
            start: rental.start_time,
            end: rental.end_time,
            priceCents: rental.price_cents
          });
          await (getSupabaseAdminClient() as any).from("terrain_rentals").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", rental.id);
        } catch (error) {
          console.error("Unable to send terrain rental confirmation email", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    // ── Boutique — commande en base de données ──
    if (checkoutType === "shop-order") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const order = await markOrderPaidByCheckoutSession(session.id, paymentIntentId);
      if (order) {
        try {
          await sendShopOrderConfirmationEmail({
            to: order.customer_email,
            customerName: order.customer_name,
            items: order.items.map((item) => ({
              productName: item.product_name,
              variantLabel: item.variant_label,
              unitPriceCents: item.unit_price_cents,
              quantity: item.quantity
            })),
            totalCents: order.total_cents
          });
        } catch (error) {
          console.error("Unable to send shop order confirmation email", error);
        }
      }
      return NextResponse.json({ received: true });
    }

    const leadId = session.metadata?.leadId;
    const sessionEmail = session.customer_details?.email ?? session.customer_email ?? undefined;
    let emailToNotify = sessionEmail;
    let parentName = "Parent";

    if (leadId && checkoutType !== "trial") {
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      const lead = await markLeadAsPaid(leadId, paymentIntentId);

      // Invalide immédiatement le cache de capacité
      revalidateTag("enrollment-capacity", "max");

      if (lead.email) {
        emailToNotify = lead.email;
        // Mise à jour du statut dans Google Sheets (fire-and-forget)
        void markLeadPaidInSheet(lead.email, leadId);
      }
      if (lead.parent_name) {
        parentName = lead.parent_name;
      }
    }

    if (emailToNotify) {
      try {
        await sendConfirmationEmail({
          to: emailToNotify,
          parentName
        });
      } catch (error) {
        console.error("Unable to send confirmation email", error);
      }
    }
  }

  // ── Session de paiement expirée : la réservation d'un programme privé est libérée ──
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.checkoutType === "match-slot") {
      try {
        await releaseMatchBySession(session.id);
      } catch (error) {
        console.error("Unable to release expired match slot reservation", error);
      }
    }
    if (session.metadata?.checkoutType === "terrain-rental") {
      try {
        await releaseRentalBySession(session.id);
      } catch (error) {
        console.error("Unable to release expired terrain rental", error);
      }
    }
    if (session.metadata?.privateProgram === "true") {
      try {
        await onPrivateCheckoutExpired(session.id);
      } catch (error) {
        console.error("Unable to release expired private program reservation", error);
      }
    }
  }

  // ── Remboursement : on déclenche la vérification de la récompense liée ──
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
    if (paymentIntentId) {
      try {
        await onPrivateRefund(paymentIntentId);
      } catch (error) {
        console.error("Unable to flag refunded private program registration", error);
      }
    }
  }

  return NextResponse.json({ received: true });
}

/** Avis à JP pour chaque inscription payée — ne bloque jamais le webhook. */
async function notifyPaidRegistration(
  programName: string,
  reg: Record<string, any> | null,
  session: Stripe.Checkout.Session,
  note?: string
) {
  try {
    const parentName = reg?.parent_name ?? ([reg?.parent_first_name, reg?.parent_last_name].filter(Boolean).join(" ") || session.customer_details?.name || null);
    const playerName = reg ? [reg.player_first_name, reg.player_last_name].map((v) => (v ?? "").trim()).filter(Boolean).join(" ") || null : null;
    await sendPaidRegistrationNotification({
      programName,
      playerName,
      birthYear: reg?.birth_year ?? reg?.player_birth_year ?? (reg?.player_dob ? String(reg.player_dob).slice(0, 4) : null),
      parentName,
      parentEmail: reg?.parent_email ?? session.customer_details?.email ?? null,
      parentPhone: reg?.parent_phone ?? session.customer_details?.phone ?? null,
      amountCents: session.amount_total ?? null,
      note: note ?? null
    });
  } catch (error) {
    console.error("Unable to send paid-registration notification", error);
  }
}

async function sessionProgramName(slug: string): Promise<string> {
  const label = programEmailLabel(slug);
  if (label !== "programme New Valkyria") return label;
  const { data } = await (getSupabaseAdminClient() as any).from("session_programs").select("name").eq("slug", slug).maybeSingle();
  return data?.name ?? slug;
}
