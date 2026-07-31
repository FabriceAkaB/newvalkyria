import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteSlot, updateSlot } from "@/lib/season-admin-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { slotId } = await params;
  const body = (await request.json().catch(() => null)) as {
    day?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    maxPlaces?: number;
    recommendedForAdvanced?: boolean;
    advancedOnly?: boolean;
    active?: boolean;
    categoryIds?: string[];
    programIds?: string[];
  } | null;

  if (!body) return jsonError("Paramètres invalides", 400);

  try {
    await updateSlot(slotId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { slotId } = await params;
  try {
    await deleteSlot(slotId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression", 500);
  }
}
