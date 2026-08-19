import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { bookSlotAtomically, listBookings } from "@/lib/private-sessions-repo";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const bookings = await listBookings({ from, to });
  return NextResponse.json({ bookings });
}

/** Création manuelle d'une réservation par l'admin — même chemin atomique
 *  que la réservation parent (bookSlotAtomically), aucune admissibilité
 *  vérifiée ici puisque c'est l'admin qui décide directement. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as {
    slotId?: string;
    playerId?: string | null;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string | null;
    notes?: string | null;
  } | null;

  if (!body?.slotId || !body.parentName?.trim() || !body.parentEmail?.trim()) {
    return jsonError("Créneau, nom et courriel du parent requis", 400);
  }

  const result = await bookSlotAtomically(body.slotId, {
    playerId: body.playerId || null,
    parentUserId: null,
    childId: null,
    parentName: body.parentName.trim(),
    parentEmail: body.parentEmail.trim(),
    parentPhone: body.parentPhone?.trim() || null,
    notes: body.notes?.trim() || null,
    createdByAdmin: true
  });

  if ("error" in result) return jsonError("Ce créneau n'est plus disponible", 409);
  return NextResponse.json({ ok: true, bookingId: result.bookingId }, { status: 201 });
}
