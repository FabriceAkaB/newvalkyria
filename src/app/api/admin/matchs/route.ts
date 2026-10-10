import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { sendMatchSlotsConfirmationEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { areConsecutive } from "@/lib/match-slots-core";
import { cancelBookings, getAllBookings, getBookingsByIds, getSlotsWithAvailability, toEmailSlots } from "@/lib/match-slots-repo";
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

/** Convertit les champs d'édition d'une plage (corps de requête) en colonnes — seulement ceux fournis. */
function slotPatch(body: Record<string, any>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const year = (v: unknown) => {
    if (v === null || v === "" || v === undefined) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 2000 && n <= 2030 ? n : null;
  };
  const cents = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.priceCents !== undefined) patch.price_cents = cents(body.priceCents);
  if (body.balanceDueCents !== undefined) patch.balance_due_cents = cents(body.balanceDueCents);
  if (body.format !== undefined) patch.match_format = text(body.format);
  if (body.opponent !== undefined) patch.opponent = text(body.opponent);
  if (body.allowedGender !== undefined) {
    if (!["tous", "filles", "garcons"].includes(body.allowedGender)) throw new Error("Genre admis invalide.");
    patch.allowed_gender = body.allowedGender;
  }
  if (body.birthYearMin !== undefined) patch.birth_year_min = year(body.birthYearMin);
  if (body.birthYearMax !== undefined) patch.birth_year_max = year(body.birthYearMax);
  if (body.restrictionNote !== undefined) patch.restriction_note = text(body.restrictionNote);
  if (body.preferredNote !== undefined) patch.preferred_note = text(body.preferredNote);
  if (body.allowedCategories !== undefined) {
    const list = Array.isArray(body.allowedCategories) ? body.allowedCategories : [];
    const cats = list.map((c: any) => {
      if (!["tous", "filles", "garcons"].includes(c?.gender)) throw new Error("Genre invalide dans une catégorie admise.");
      const lo = year(c.birthYearMin);
      const hi = year(c.birthYearMax);
      if (lo != null && hi != null && lo > hi) throw new Error("Dans une catégorie, l'année la plus ancienne doit être inférieure ou égale à la plus récente.");
      return { gender: c.gender, birthYearMin: lo, birthYearMax: hi };
    });
    patch.allowed_categories = cats.length > 0 ? cats : null;
  }
  if (body.notes !== undefined) patch.notes = text(body.notes);
  if (body.location !== undefined && text(body.location)) patch.location = text(body.location);
  if (body.field !== undefined) patch.field_label = text(body.field);
  const min = patch.birth_year_min as number | null | undefined;
  const max = patch.birth_year_max as number | null | undefined;
  if (min != null && max != null && min > max) throw new Error("L'année la plus ancienne doit être inférieure ou égale à la plus récente.");
  return patch;
}

/** Gestion des plages de match : ajout, détails, restrictions, doubles cédules, réservations. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (!body?.action) return jsonError("Action requise", 400);

  try {
    switch (body.action) {
      case "slot_create": {
        const { data: created, error } = await db()
          .from("match_slots")
          .insert({
            slot_date: body.date,
            start_time: body.start,
            end_time: body.end,
            location: body.location,
            field_label: body.field || null,
            price_cents: body.priceCents !== undefined ? Math.max(0, Math.round(Number(body.priceCents) || 0)) : 5000,
            balance_due_cents: body.balanceDueCents !== undefined ? Math.max(0, Math.round(Number(body.balanceDueCents) || 0)) : 15000,
            ...slotPatch({ format: body.format, opponent: body.opponent, allowedGender: body.allowedGender ?? "tous", birthYearMin: body.birthYearMin, birthYearMax: body.birthYearMax, restrictionNote: body.restrictionNote, allowedCategories: body.allowedCategories, preferredNote: body.preferredNote, notes: body.notes })
          })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        // Double cédule automatique : une plage qui suit (ou précède) une autre le même jour au même endroit.
        const { data: sameDay } = await db().from("match_slots").select("*").eq("slot_date", created.slot_date).eq("location", created.location).neq("id", created.id);
        const neighbor = (sameDay ?? []).find((o: any) => areConsecutive(o, created) || areConsecutive(created, o));
        if (neighbor) {
          const group = neighbor.double_group ?? randomUUID();
          await db().from("match_slots").update({ double_group: group }).in("id", [neighbor.id, created.id]);
        }
        break;
      }
      case "slot_update": {
        const patch = slotPatch(body);
        if (Object.keys(patch).length === 0) return jsonError("Rien à modifier.", 400);
        const { error } = await db().from("match_slots").update(patch).eq("id", body.slotId);
        if (error) throw new Error(error.message);
        break;
      }
      case "slots_bulk_update": {
        const ids = Array.isArray(body.slotIds) ? body.slotIds.filter((x: unknown) => typeof x === "string") : [];
        if (ids.length === 0) return jsonError("Aucune plage cochée.", 400);
        const patch = slotPatch(body);
        if (Object.keys(patch).length === 0) return jsonError("Rien à appliquer.", 400);
        const { error } = await db().from("match_slots").update(patch).in("id", ids);
        if (error) throw new Error(error.message);
        break;
      }
      case "slot_link_double": {
        const ids: string[] = Array.isArray(body.slotIds) ? body.slotIds : [];
        if (ids.length !== 2) return jsonError("Choisissez exactement deux plages à lier.", 400);
        const { data: pair } = await db().from("match_slots").select("*").in("id", ids);
        if ((pair ?? []).length !== 2) return jsonError("Plages introuvables.", 404);
        const [x, y] = pair;
        if (!(areConsecutive(x, y) || areConsecutive(y, x))) return jsonError("Une double cédule doit être formée de deux plages qui se suivent, le même jour, au même endroit.", 409);
        const group = x.double_group ?? y.double_group ?? randomUUID();
        await db().from("match_slots").update({ double_group: group }).in("id", ids);
        break;
      }
      case "slot_unlink_double": {
        const { data: slot } = await db().from("match_slots").select("double_group").eq("id", body.slotId).maybeSingle();
        if (slot?.double_group) {
          const { data: members } = await db().from("match_slots").select("id").eq("double_group", slot.double_group);
          const { count } = await db()
            .from("match_slot_bookings")
            .select("id", { count: "exact", head: true })
            .in("slot_id", (members ?? []).map((m: any) => m.id))
            .in("status", ["pending", "paid"]);
          if ((count ?? 0) > 0) return jsonError("Cette double cédule a une réservation active : annulez-la d'abord.", 409);
          await db().from("match_slots").update({ double_group: null }).eq("double_group", slot.double_group);
        }
        break;
      }
      case "slot_delete": {
        const { count } = await db().from("match_slot_bookings").select("id", { count: "exact", head: true }).eq("slot_id", body.slotId).in("status", ["pending", "paid"]);
        if ((count ?? 0) > 0) return jsonError("Cette plage a une réservation active : annulez-la d'abord.", 409);
        const { data: gone } = await db().from("match_slots").select("double_group").eq("id", body.slotId).maybeSingle();
        await db().from("match_slots").delete().eq("id", body.slotId);
        if (gone?.double_group) {
          // Une double cédule amputée d'une plage redevient une plage simple.
          const { data: left } = await db().from("match_slots").select("id").eq("double_group", gone.double_group);
          if ((left ?? []).length === 1) await db().from("match_slots").update({ double_group: null }).eq("id", left[0].id);
        }
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
      case "booking_balance_paid": {
        await db()
          .from("match_slot_bookings")
          .update({ balance_paid_at: body.paid === false ? null : new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", body.bookingId)
          .eq("status", "paid");
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
          slots: toEmailSlots([booking])
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
