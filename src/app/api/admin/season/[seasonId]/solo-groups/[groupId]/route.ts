import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteSoloGroup, updateSoloGroup } from "@/lib/season-admin-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { groupId } = await params;
  const body = (await request.json().catch(() => null)) as {
    label?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    maxPlaces?: number;
    active?: boolean;
  } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  try {
    await updateSoloGroup(groupId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { groupId } = await params;
  try {
    await deleteSoloGroup(groupId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression", 500);
  }
}
