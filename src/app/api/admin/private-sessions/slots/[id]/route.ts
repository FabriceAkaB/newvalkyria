import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { closeSlot, reopenSlot, updateSlot } from "@/lib/private-sessions-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    location?: string | null;
    terrainId?: string | null;
    coachId?: string | null;
    notes?: string | null;
    action?: "close" | "reopen";
    closedReason?: string | null;
  } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  try {
    if (body.action === "close") {
      await closeSlot(id, body.closedReason?.trim() || null);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reopen") {
      await reopenSlot(id);
      return NextResponse.json({ ok: true });
    }
    await updateSlot(id, {
      location: body.location,
      terrainId: body.terrainId,
      coachId: body.coachId,
      notes: body.notes
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
