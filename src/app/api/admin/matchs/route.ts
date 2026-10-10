import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { sendMatchSlotsConfirmationEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { cancelBookings, getAllBookings, getBookingsByIds, getSlotsWithAvailability } from "@/lib/match-slots-repo";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const [slots, bookings] = await Promise.all([getSlotsWithAvailability({ includeInactive: true, includePast: true }), getAllBookings()]);
  return NextResponse.json({ slots, bookings });
}

/** Gestion des plages de match : ajout, prix, activation, réservations (annulation / remboursement). */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (!body?.action) return jsonError("Action requise", 400);

  try {
    switch (body.action) {
      case "slot_create": {
        const { error } = await db().from("match_slots").insert({
          slot_date: body.date,
          start_time: body.start,
          end_time: body.end,
          location: body.location,
          field_label: body.field || null,
          price_cents: Math.round(Number(body.priceCents) || 10000)
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "slot_update": {
        const patch: Record<string, unknown> = {};
        if (typeof body.active === "boolean") patch.active = body.active;
        if (body.priceCents !== undefined) patch.price_cents = Math.max(0, Math.round(Number(body.priceCents) || 0));
        await db().from("match_slots").update(patch).eq("id", body.slotId);
        break;
      }
      case "slot_delete": {
        const { count } = await db().from("match_slot_bookings").select("id", { count: "exact", head: true }).eq("slot_id", body.slotId).in("status", ["pending", "paid"]);
        if ((count ?? 0) > 0) return jsonError("Cette plage a une réservation active : annulez-la d'abord.", 409);
        await db().from("match_slots").delete().eq("id", body.slotId);
        break;
      }
      case "booking_cancel": {
        const [booking] = await getBookingsByIds([body.bookingId]);
        if (!booking) return jsonError("Réservation introuvable", 404);
        let refunded = false;
        if (body.refund && booking.status === "paid" && booking.stripe_payment_intent_id) {
          // Un paiement peut couvrir 2 plages : on rembourse seulement le montant de CETTE plage.
          await getStripeClient().refunds.create({ payment_intent: booking.stripe_payment_intent_id, amount: booking.price_cents });
          refunded = true;
        }
        await cancelBookings([booking.id], body.reason || (refunded ? "Annulée et remboursée par l'administrateur" : "Annulée par l'administrateur"));
        return NextResponse.json({ ok: true, refunded });
      }
      case "booking_mark_paid": {
        await db().from("match_slot_bookings").update({ status: "paid", reservation_expires_at: null, updated_at: new Date().toISOString() }).eq("id", body.bookingId).eq("status", "pending");
        break;
      }
      case "booking_resend": {
        const [booking] = await getBookingsByIds([body.bookingId]);
        if (!booking || booking.status !== "paid") return jsonError("Réservation payée introuvable", 404);
        await sendMatchSlotsConfirmationEmail({
          to: booking.contact_email,
          contactName: booking.contact_name,
          orgName: booking.org_name,
          teamLabel: booking.team_label,
          slots: [{ date: booking.slot.slot_date, start: booking.slot.start_time, end: booking.slot.end_time, location: booking.slot.location }],
          totalCents: booking.price_cents
        });
        await db().from("match_slot_bookings").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", booking.id);
        break;
      }
      default:
        return jsonError("Action inconnue", 400);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
