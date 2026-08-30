import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { removeParticipant, updateAttendance } from "@/lib/tryout-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ participantId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { participantId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Corps de requête invalide", 400);
  try {
    await updateAttendance(participantId, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ participantId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { participantId } = await params;
  await removeParticipant(participantId);
  return NextResponse.json({ ok: true });
}
