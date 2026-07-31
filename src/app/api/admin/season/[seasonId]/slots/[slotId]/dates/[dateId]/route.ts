import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { removeSlotDate, toggleSlotDateCancelled } from "@/lib/season-admin-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ dateId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { dateId } = await params;
  const body = (await request.json().catch(() => null)) as { cancelled?: boolean } | null;
  if (!body || typeof body.cancelled !== "boolean") return jsonError("Paramètres invalides", 400);

  try {
    await toggleSlotDateCancelled(dateId, body.cancelled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ dateId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { dateId } = await params;
  try {
    await removeSlotDate(dateId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression", 500);
  }
}
