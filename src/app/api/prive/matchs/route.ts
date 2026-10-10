import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStripeClient } from "@/lib/stripe";
import { isValidPhone } from "@/lib/form-validation";
import { restrictionLabel } from "@/lib/match-slots-core";
import {
  cancelBookings,
  getSlotsWithAvailability,
  MatchConflictError,
  MATCH_RESERVATION_MINUTES,
  MAX_SLOTS_PER_TEAM,
  reserveSlots,
  setBookingsCheckoutSession
} from "@/lib/match-slots-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await getSlotsWithAvailability();
  // Une plage réservée (ou une double cédule dont une moitié l'est) disparaît de la page publique.
  const blockedGroups = new Set(all.filter((s) => !s.available && s.double_group).map((s) => s.double_group));
  const slots = all.filter((s) => s.available && !(s.double_group && blockedGroups.has(s.double_group)));
  return NextResponse.json({
    maxPerTeam: MAX_SLOTS_PER_TEAM,
    slots: slots.map((s) => ({
      id: s.id,
      date: s.slot_date,
      start: s.start_time,
      end: s.end_time,
      location: s.location,
      field: s.field_label,
      depositCents: s.price_cents,
      balanceDueCents: s.balance_due_cents,
      format: s.match_format,
      opponent: s.opponent,
      allowedGender: s.allowed_gender,
      birthYearMin: s.birth_year_min,
      birthYearMax: s.birth_year_max,
      restriction: restrictionLabel(s),
      preferred: s.preferred_note,
      rules: {
        allowed_gender: s.allowed_gender,
        birth_year_min: s.birth_year_min,
        birth_year_max: s.birth_year_max,
        restriction_note: null,
        allowed_categories: s.allowed_categories
      },
      doubleGroup: s.double_group,
      notes: s.notes,
      available: s.available
    }))
  });
}

const schema = z.object({
  slotIds: z.array(z.string().min(1)).min(1, "Choisissez au moins une plage.").max(MAX_SLOTS_PER_TEAM, `Une équipe ne peut réserver que ${MAX_SLOTS_PER_TEAM} plages.`),
  orgName: z.string().trim().min(2, "Nom de l'académie ou du club requis"),
  teamGender: z.enum(["filles", "garcons", "mixte"], { message: "Genre de l'équipe requis" }),
  teamBirthYear: z.number().int().min(2000, "Année de naissance invalide").max(2026, "Année de naissance invalide"),
  teamLabel: z.string().trim().min(1, "Nom ou catégorie de l'équipe requis"),
  contactName: z.string().trim().min(2, "Nom du responsable requis"),
  contactEmail: z.string().trim().email("Courriel invalide"),
  contactPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  notes: z.string().optional(),
  termsAccepted: z.boolean().refine((v) => v, { message: "L'acceptation des conditions est obligatoire" })
});

/** Réserve 1 ou 2 plages de match (une double cédule en bloc) et ouvre le paiement Stripe
 *  de l'acompte (50 $ par plage ; le solde se paie le jour du match).
 *  Prix, admissibilité et règles (2 plages max par équipe) toujours validés côté serveur. */
export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const { bookings, slots, totalCents, balanceCents } = await reserveSlots({
      slotIds: payload.slotIds,
      orgName: payload.orgName,
      teamLabel: payload.teamLabel,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      teamGender: payload.teamGender,
      teamBirthYear: payload.teamBirthYear,
      notes: payload.notes?.trim() || null
    });

    try {
      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payload.contactEmail,
        payment_method_types: ["card"],
        expires_at: Math.floor(Date.now() / 1000) + MATCH_RESERVATION_MINUTES * 60,
        line_items: bookings.map((b) => {
          const s = slots.find((x) => x.id === b.slot_id)!;
          const label = new Date(s.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
          return {
            quantity: 1,
            price_data: {
              currency: "cad",
              product_data: {
                name: `Acompte de réservation — match New Valkyria, ${label}, ${s.start_time}`,
                description: `${payload.orgName} (${payload.teamLabel}) · solde de ${(b.balance_due_cents / 100).toFixed(2).replace(".", ",")} $ payable le jour du match`
              },
              unit_amount: b.price_cents
            }
          };
        }),
        metadata: { checkoutType: "match-slot", bookingIds: bookings.map((b) => b.id).join(",") },
        success_url: `${baseUrl}/prive/matchs/confirmation?ids=${bookings.map((b) => b.id).join(",")}`,
        cancel_url: `${baseUrl}/prive/matchs?cancelled=1`
      });
      if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");
      await setBookingsCheckoutSession(bookings.map((b) => b.id), session.id);
      return NextResponse.json({ ok: true, checkoutUrl: session.url, totalCents, balanceCents });
    } catch (stripeError) {
      await cancelBookings(bookings.map((b) => b.id), "Paiement non démarré").catch(() => {});
      throw stripeError;
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof MatchConflictError) return NextResponse.json({ error: error.message, code: "conflict" }, { status: 409 });
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
