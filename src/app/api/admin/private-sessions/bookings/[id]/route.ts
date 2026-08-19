import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { cancelBooking, moveBooking } from "@/lib/private-sessions-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { action?: "cancel" | "move"; newSlotId?: string } | null;
  if (!body?.action) return jsonError("Action requise", 400);

  try {
    if (body.action === "cancel") {
      await cancelBooking(id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "move") {
      if (!body.newSlotId) return jsonError("Nouveau créneau requis", 400);
      const result = await moveBooking(id, body.newSlotId);
      if ("error" in result) return jsonError("Le nouveau créneau n'est plus disponible", 409);
      return NextResponse.json({ ok: true });
    }
    return jsonError("Action inconnue", 400);
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
