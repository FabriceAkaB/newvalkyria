import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cancelRental, createRental, RentalConflictError, RENTAL_RESERVATION_MINUTES, setRentalCheckoutSession } from "@/lib/terrain-rentals-repo";
import { isValidPhone } from "@/lib/form-validation";

const schema = z.object({
  terrainId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  organizationName: z.string().trim().min(1, "Nom de l'organisation requis"),
  contactName: z.string().trim().min(1, "Nom du responsable requis"),
  contactEmail: z.string().trim().email("Courriel invalide"),
  contactPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  notes: z.string().optional(),
  termsAccepted: z.boolean().refine((v) => v, { message: "L'acceptation des conditions est obligatoire" })
});

/** Réserve un créneau de terrain et ouvre le paiement Stripe. Le prix vient
 *  uniquement de la configuration serveur (jamais du navigateur). */
export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());

    const { data: terrain } = await (getSupabaseAdminClient() as any).from("terrains").select("id, name, active, rentable").eq("id", payload.terrainId).maybeSingle();
    if (!terrain || !terrain.active || !terrain.rentable) return jsonError("Ce terrain n'est pas offert à la location.", 404);

    const rental = await createRental({
      terrainId: payload.terrainId,
      date: payload.date,
      start: payload.start,
      end: payload.end,
      organizationName: payload.organizationName,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      notes: payload.notes?.trim() || null
    });

    try {
      const stripe = getStripeClient();
      const baseUrl = getRequestOrigin(request);
      const dateLabel = new Date(rental.rental_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: payload.contactEmail,
        payment_method_types: ["card"],
        expires_at: Math.floor(Date.now() / 1000) + RENTAL_RESERVATION_MINUTES * 60,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              product_data: { name: `Location de terrain — ${terrain.name}`, description: `${dateLabel}, ${rental.start_time} – ${rental.end_time} · ${payload.organizationName}` },
              unit_amount: rental.price_cents
            }
          }
        ],
        metadata: { checkoutType: "terrain-rental", rentalId: rental.id },
        success_url: `${baseUrl}/location-terrains/confirmation?rentalId=${rental.id}`,
        cancel_url: `${baseUrl}/location-terrains?cancelled=1`
      });
      if (!session.url) throw new Error("Stripe n'a pas retourné d'URL de paiement.");
      await setRentalCheckoutSession(rental.id, session.id);
      return NextResponse.json({ ok: true, checkoutUrl: session.url, rentalId: rental.id });
    } catch (stripeError) {
      await cancelRental(rental.id, "Paiement non démarré").catch(() => {});
      throw stripeError;
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof RentalConflictError) return NextResponse.json({ error: error.message, code: "slot_unavailable" }, { status: 409 });
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
