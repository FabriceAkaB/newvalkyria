import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getActivityAttendance, getCoachActivityWithRoster } from "@/lib/coach-portal-repo";
import { PARTICIPATED } from "@/lib/coach-report";
import { jsonError } from "@/lib/http";
import { setWinner } from "@/lib/player-points-repo";

/** Gagnantes du jour dans le rapport de l'éducateur : victoire ou attitude ; les points se comptent tout seuls. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { registrationId?: string; kind?: string; on?: boolean } | null;
  if (!body?.registrationId || (body.kind !== "victoire" && body.kind !== "attitude") || typeof body.on !== "boolean") return jsonError("Paramètres invalides", 400);

  const entry = await getCoachActivityWithRoster(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (!entry.roster.some((p) => p.registrationId === body.registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette activité.", 403);
  if (body.on) {
    const att = (await getActivityAttendance(id)).find((a) => a.registration_id === body.registrationId);
    if (!att || !PARTICIPATED.includes(att.status)) return jsonError("Marque d'abord sa présence : seule une joueuse présente peut gagner.", 422);
  }
  const problem = await setWinner({ activityId: id, registrationId: body.registrationId, kind: body.kind, on: body.on, coachId });
  if (problem) return jsonError(problem, 422);
  return NextResponse.json({ ok: true });
}
