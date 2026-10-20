import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getAllOffers, setOptionPrice } from "@/lib/partnership-offers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Propositions de partenariat personnalisées : suivi, prix d'une option (ex. chandail « à convenir »), statut. */
export async function GET() {
  if (!(await getCurrentAdminRole())) return jsonError("Non autorisé", 401);
  return NextResponse.json({ offers: await getAllOffers() });
}

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Réservé à l'administrateur.", 403);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  try {
    switch (body?.action) {
      case "set_option_price": {
        const cents = Math.round(Number(body.priceCents));
        if (!Number.isFinite(cents) || cents < 100) return jsonError("Montant invalide.", 400);
        await setOptionPrice(String(body.optionId), cents);
        break;
      }
      case "set_status": {
        if (!["sent", "accepted", "declined", "expired"].includes(body.status)) return jsonError("Statut invalide.", 400);
        await (getSupabaseAdminClient() as any).from("partnership_offers").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.offerId);
        break;
      }
      default:
        return jsonError("Action inconnue", 400);
    }
    return NextResponse.json({ ok: true, offers: await getAllOffers() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
