import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { coachCanSeePlayer, deactivatePlayerRoutine, registrationOfItem } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const registrationId = await registrationOfItem("player_routines", id);
  if (!registrationId || !(await coachCanSeePlayer(coachId, registrationId))) return jsonError("Introuvable", 404);
  await deactivatePlayerRoutine(id);
  return NextResponse.json({ ok: true });
}
