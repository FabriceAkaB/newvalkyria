import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";
import { markPickupDelivered } from "@/lib/shop-pickup-repo";

/** « Remis » : l'éducateur assigné à la séance a remis le colis de la boutique au parent ; la tâche de JP se coche. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry?.assignment) return jsonError("Seuls les éducateurs assignés à cette séance remettent les colis.", 403);
  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  if (typeof body?.orderId !== "string") return jsonError("Commande manquante", 400);
  const coach = await getCoach(coachId);
  const ok = await markPickupDelivered(entry.activity, body.orderId, coach ? `${coach.first_name} ${coach.last_name}`.trim() : "Éducateur");
  if (!ok) return jsonError("Ce colis n'est pas à remettre à cette séance.", 404);
  return NextResponse.json({ ok: true });
}
