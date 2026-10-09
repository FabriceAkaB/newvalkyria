import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { sendTerrainRentalConfirmationEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cancelRental, getAllTerrainsForRental, getBlocks, getRentalById, getRentals, getWindows } from "@/lib/terrain-rentals-repo";

function db() {
  return getSupabaseAdminClient() as any;
}

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const [terrains, windows, blocks, rentals] = await Promise.all([getAllTerrainsForRental(), getWindows(), getBlocks(), getRentals()]);
  return NextResponse.json({ terrains, windows, blocks, rentals });
}

/** Gestion de la location : terrains offerts, plages, dates bloquées, annulations/remboursements. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (!body?.action) return jsonError("Action requise", 400);

  try {
    switch (body.action) {
      case "terrain_update": {
        const patch: Record<string, unknown> = {};
        if (typeof body.rentable === "boolean") patch.rentable = body.rentable;
        if (body.rental_description !== undefined) patch.rental_description = body.rental_description || null;
        await db().from("terrains").update(patch).eq("id", body.terrainId);
        break;
      }
      case "window_create": {
        const isWeekly = body.weekday !== null && body.weekday !== undefined && body.weekday !== "";
        const { error } = await db().from("terrain_rental_windows").insert({
          terrain_id: body.terrainId,
          weekday: isWeekly ? Number(body.weekday) : null,
          specific_date: isWeekly ? null : body.specificDate,
          start_time: body.startTime,
          end_time: body.endTime,
          slot_minutes: Number(body.slotMinutes) || 90,
          price_cents: Math.round(Number(body.priceCents) || 0),
          valid_from: body.validFrom || null,
          valid_until: body.validUntil || null
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "window_update": {
        const patch: Record<string, unknown> = {};
        if (typeof body.active === "boolean") patch.active = body.active;
        if (body.priceCents !== undefined) patch.price_cents = Math.round(Number(body.priceCents) || 0);
        await db().from("terrain_rental_windows").update(patch).eq("id", body.windowId);
        break;
      }
      case "window_delete":
        await db().from("terrain_rental_windows").delete().eq("id", body.windowId);
        break;
      case "block_create": {
        const { error } = await db().from("terrain_rental_blocks").insert({
          terrain_id: body.terrainId,
          block_date: body.blockDate,
          start_time: body.startTime || null,
          end_time: body.endTime || null,
          reason: body.reason || null
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "block_delete":
        await db().from("terrain_rental_blocks").delete().eq("id", body.blockId);
        break;
      case "rental_cancel": {
        const rental = await getRentalById(body.rentalId);
        if (!rental) return jsonError("Réservation introuvable", 404);
        let refunded = false;
        if (body.refund && rental.status === "paid" && rental.stripe_payment_intent_id) {
          await getStripeClient().refunds.create({ payment_intent: rental.stripe_payment_intent_id });
          refunded = true;
        }
        await cancelRental(rental.id, body.reason || (refunded ? "Annulée et remboursée par l'administrateur" : "Annulée par l'administrateur"));
        return NextResponse.json({ ok: true, refunded });
      }
      case "rental_resend": {
        const rental = await getRentalById(body.rentalId);
        if (!rental || rental.status !== "paid") return jsonError("Réservation payée introuvable", 404);
        const { data: terrain } = await db().from("terrains").select("name, address").eq("id", rental.terrain_id).maybeSingle();
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
        await db().from("terrain_rentals").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", rental.id);
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
