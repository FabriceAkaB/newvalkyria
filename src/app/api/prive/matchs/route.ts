import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStripeClient } from "@/lib/stripe";
import { isValidPhone } from "@/lib/form-validation";
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
  const slots = await getSlotsWithAvailability();
  return NextResponse.json({
    maxPerTeam: MAX_SLOTS_PER_TEAM,
    slots: slots.map((s) => ({ id: s.id, date: s.slot_date, start: s.start_time, end: s.end_time, location: s.location, field: s.field_label, priceCents: s.price_cents, available: s.available }))
  });
}

const schema = z.object({
  slotIds: z.array(z.string().min(1)).min(1, "Choisissez au moins une plage.").max(MAX_SLOTS_PER_TEAM, `Une équipe ne peut réserver que ${MAX_SLOTS_PER_TEAM} plages.`),
  orgName: z.string().trim().min(2, "Nom de l'académie ou du club requis"),
  teamLabel: z.string().trim().min(1, "Catégorie / âge de l'équipe requis"),
  contactName: z.string().trim().min(2, "Nom du responsable requis"),
  contactEmail: z.string().trim().email("Courriel invalide"),
  contactPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  notes: z.string().optional(),
  termsAccepted: z.boolean().refine((v) => v, { message: "L'acceptation des conditions est obligatoire" })
});

/** Réserve 1 ou 2 plages de match et ouvre le paiement Stripe (100 $ par plage).
 *  Prix et règles (2 plages max par équipe) toujours validés côté serveur. */
export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const { bookings, slots, totalCents } = await reserveSlots({
      slotIds: payload.slotIds,
      orgName: payload.orgName,
      teamLabel: payload.teamLabel,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
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
              product_data: { name: `Match New Valkyria — ${label}, ${s.start_time}`, description: `${payload.orgName} (${payload.teamLabel}) · ${s.location}` },
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
      return NextResponse.json({ ok: true, checkoutUrl: session.url, totalCents });
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
