import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addParticipant, getParticipantsForEvent } from "@/lib/tryout-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const participants = await getParticipantsForEvent(id);
  return NextResponse.json({ participants });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { playerId?: string; playerIds?: string[] } | null;
  const playerIds = body?.playerIds ?? (body?.playerId ? [body.playerId] : []);
  if (playerIds.length === 0) return jsonError("playerId ou playerIds requis", 400);
  try {
    const participantIds = await Promise.all(playerIds.map((playerId) => addParticipant(id, playerId)));
    return NextResponse.json({ participantIds });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
