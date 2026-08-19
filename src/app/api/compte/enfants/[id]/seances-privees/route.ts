import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount } from "@/lib/parent-repo";
import { bookSlotAtomically, getOpenSlots, isPlayerCurrentlyEnrolled } from "@/lib/private-sessions-repo";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** L'admissibilité est toujours revérifiée ici, jamais fait confiance à
 *  l'affichage client — voir le plan §4 : "actuellement inscrit" = au moins
 *  une inscription Automne/Hiver+ confirmée ou payée, hors essai seul. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const children = await getChildrenForParent(userId);
  const child = children.find((c) => c.id === id);
  if (!child) return jsonError("Profil introuvable", 404);

  if (!child.player_id) {
    return NextResponse.json({ eligible: false, reason: "not_linked", slots: [] });
  }

  const eligible = await isPlayerCurrentlyEnrolled(child.player_id);
  if (!eligible) {
    return NextResponse.json({ eligible: false, reason: "not_enrolled", slots: [] });
  }

  const slots = await getOpenSlots({ from: isoToday() });
  return NextResponse.json({ eligible: true, slots });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { slotId?: string } | null;
  if (!body?.slotId) return jsonError("Créneau requis", 400);

  const children = await getChildrenForParent(userId);
  const child = children.find((c) => c.id === id);
  if (!child) return jsonError("Profil introuvable", 404);
  if (!child.player_id) {
    return jsonError("Ce profil doit d'abord être relié à une inscription pour réserver une séance privée.", 403);
  }

  const eligible = await isPlayerCurrentlyEnrolled(child.player_id);
  if (!eligible) {
    return jsonError(
      "Les séances privées sont réservées aux jeunes actuellement inscrits à l'Académie New Valkyria. Ce profil n'a pas d'inscription confirmée ou payée en ce moment.",
      403
    );
  }

  const account = await getParentAccount(userId);

  const result = await bookSlotAtomically(body.slotId, {
    playerId: child.player_id,
    parentUserId: userId,
    childId: child.id,
    parentName: account?.fullName?.trim() || account?.email || "Parent",
    parentEmail: account?.email ?? "",
    parentPhone: null,
    notes: null,
    createdByAdmin: false
  });

  if ("error" in result) return jsonError("Ce créneau vient d'être réservé par quelqu'un d'autre.", 409);
  return NextResponse.json({ ok: true, bookingId: result.bookingId }, { status: 201 });
}
