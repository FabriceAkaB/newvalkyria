import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { closeOtherOffersForSlot, reopenOffersForSlot } from "@/lib/partnership-offers";
import { buildPaymentLinkParams, type SponsorSlot } from "@/lib/sponsorship-2027";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export type SponsorSlotRow = SponsorSlot & { company_name: string | null; contact_name: string | null; contact_email: string | null; sponsor_status: string | null };

export async function loadSlots(): Promise<SponsorSlotRow[]> {
  const { data, error } = await db().from("sponsor_slots_2027").select("*, sponsor:sponsors(company_name, contact_name, contact_email, status)").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    ...r,
    company_name: r.sponsor?.company_name ?? null,
    contact_name: r.sponsor?.contact_name ?? null,
    contact_email: r.sponsor?.contact_email ?? null,
    sponsor_status: r.sponsor?.status ?? null
  }));
}

/** La gérante peut suivre la section, copier les liens et réserver ; seuls les administrateurs
 *  modifient les prix, marquent « payé » à la main ou remettent un emplacement disponible. */
const GERANTE_ACTIONS = new Set(["reserve", "set_company"]);

export async function GET() {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  return NextResponse.json({ slots: await loadSlots(), role });
}

/** Désactive / réactive le lien Stripe d'un emplacement (un emplacement vendu ou réservé ne doit plus être payable). */
async function setLinkActive(linkId: string | null, active: boolean) {
  if (!linkId) return;
  try {
    await getStripeClient().paymentLinks.update(linkId, { active });
  } catch (error) {
    console.error("Unable to update payment link", linkId, error);
  }
}

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (!body?.action || !body.slotKey) return jsonError("Action et emplacement requis", 400);
  if (role !== "admin" && !GERANTE_ACTIONS.has(body.action)) return jsonError("Cette action est réservée à l'administrateur.", 403);

  try {
    const { data: slot } = await db().from("sponsor_slots_2027").select("*").eq("slot_key", body.slotKey).maybeSingle();
    if (!slot) return jsonError("Emplacement introuvable", 404);

    switch (body.action) {
      case "mark_sold":
      case "reserve": {
        if (slot.status !== "available") return jsonError("Cet emplacement n'est plus disponible.", 409);
        const company = String(body.company ?? "").trim();
        if (!company) return jsonError("Le nom de l'entreprise est requis.", 400);
        const sold = body.action === "mark_sold";
        const amount = Math.max(0, Math.round(Number(body.amountCents) || slot.price_cents));
        const { data: sponsor, error } = await db()
          .from("sponsors")
          .insert({
            company_name: company,
            contact_name: String(body.contactName ?? "").trim() || null,
            contact_email: String(body.contactEmail ?? "").trim() || null,
            category: slot.tier === "titre" || slot.tier === "majeur" ? "principal" : slot.tier === "site" ? "evenement" : "equipement",
            partnership_type: `${slot.tier_label} — ${slot.placement} (2027)`,
            proposed_amount_cents: amount,
            status: sold ? "paye" : "confirme",
            notes: String(body.note ?? "").trim() || (sold ? "Marqué payé manuellement (paiement hors lien Stripe)." : "Emplacement réservé.")
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        if (sold) {
          await db().from("sponsor_payments").insert({ sponsor_id: sponsor.id, amount_cents: amount, paid_at: new Date().toISOString(), method: String(body.method ?? "Hors ligne"), note: "Paiement saisi manuellement" });
        }
        await db().from("sponsor_slots_2027").update({ status: sold ? "sold" : "reserved", sponsor_id: sponsor.id, updated_at: new Date().toISOString() }).eq("slot_key", slot.slot_key);
        await setLinkActive(slot.payment_link_id, false);
        await closeOtherOffersForSlot(slot.slot_key, null);
        break;
      }
      case "release": {
        await db().from("sponsor_slots_2027").update({ status: "available", sponsor_id: null, updated_at: new Date().toISOString() }).eq("slot_key", slot.slot_key);
        await setLinkActive(slot.payment_link_id, true);
        await reopenOffersForSlot(slot.slot_key);
        break;
      }
      case "set_company": {
        const company = String(body.company ?? "").trim();
        if (!company || !slot.sponsor_id) return jsonError("Entreprise ou commanditaire manquant.", 400);
        await db()
          .from("sponsors")
          .update({ company_name: company, contact_name: String(body.contactName ?? "").trim() || null, contact_email: String(body.contactEmail ?? "").trim() || null, updated_at: new Date().toISOString() })
          .eq("id", slot.sponsor_id);
        break;
      }
      case "custom_price": {
        // Prix négocié : nouveau lien de paiement au montant convenu (l'ancien est désactivé).
        if (slot.status !== "available") return jsonError("Le prix se modifie seulement pour un emplacement disponible.", 409);
        const amount = Math.round(Number(body.amountCents));
        if (!Number.isFinite(amount) || amount < 100) return jsonError("Montant invalide (minimum 1 $).", 400);
        await setLinkActive(slot.payment_link_id, false);
        const updated = { ...slot, price_cents: amount };
        const link = await getStripeClient().paymentLinks.create(buildPaymentLinkParams(updated));
        await db()
          .from("sponsor_slots_2027")
          .update({
            price_cents: amount,
            list_price_cents: slot.list_price_cents ?? slot.price_cents,
            payment_link_id: link.id,
            payment_link_url: link.url,
            notes: String(body.note ?? "").trim() || `Prix négocié : ${(amount / 100).toFixed(2)} $ (tarif ${(((slot.list_price_cents ?? slot.price_cents) as number) / 100).toFixed(2)} $)`,
            updated_at: new Date().toISOString()
          })
          .eq("slot_key", slot.slot_key);
        break;
      }
      case "new_link": {
        if (slot.status !== "available") return jsonError("Un lien se crée seulement pour un emplacement disponible.", 409);
        await setLinkActive(slot.payment_link_id, false);
        const link = await getStripeClient().paymentLinks.create(buildPaymentLinkParams(slot));
        await db().from("sponsor_slots_2027").update({ payment_link_id: link.id, payment_link_url: link.url, updated_at: new Date().toISOString() }).eq("slot_key", slot.slot_key);
        break;
      }
      default:
        return jsonError("Action inconnue", 400);
    }
    return NextResponse.json({ ok: true, slots: await loadSlots() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
