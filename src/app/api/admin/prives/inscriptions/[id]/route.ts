import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { cancelRegistrationAdmin } from "@/lib/private-programs-admin";
import { onPrivateRegistrationPaid } from "@/lib/private-programs-lifecycle";
import { getPrivateRegistrationById, setRegistrationStatus } from "@/lib/private-programs-repo";

/** Actions administratives sur une inscription d'un programme privé :
 *  annuler (libère la place, annule les versements à venir, remet le crédit,
 *  annule la récompense), annuler + rembourser via Stripe, ou marquer comme
 *  payée (paiement reçu hors ligne : comptant, virement). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: "cancel" | "mark_paid"; refund?: boolean; reason?: string } | null;
  if (!body?.action) return jsonError("Action requise", 400);
  const actor = `admin:${role}`;

  try {
    if (body.action === "cancel") {
      const result = await cancelRegistrationAdmin(id, { actor, refund: Boolean(body.refund), reason: body.reason?.trim() || "Annulation par l'administrateur" });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "mark_paid") {
      const registration = await getPrivateRegistrationById(id);
      if (!registration) return jsonError("Inscription introuvable", 404);
      if (registration.status === "paid") return jsonError("Déjà payée.", 409);
      await setRegistrationStatus(id, "paid");
      await onPrivateRegistrationPaid({ ...registration, status: "paid" });
      return NextResponse.json({ ok: true });
    }
    return jsonError("Action inconnue", 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
