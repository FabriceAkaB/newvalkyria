import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { addTrial, practicesForTrial } from "@/lib/coach-lab-repo";
import { jsonError } from "@/lib/http";

/** Un essai de l'expérience à une pratique : est-ce que ça a amélioré la séance (1 à 5) et ce qu'on a observé. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { activityId?: string; rating?: number; observation?: string } | null;
  const rating = Math.round(Number(body?.rating));
  if (!(rating >= 1 && rating <= 5)) return jsonError("Note de 1 à 5 : est-ce que ça a amélioré la séance ?", 400);
  const allowed = await practicesForTrial();
  const activityId = body?.activityId && allowed.some((p) => p.id === body.activityId) ? body.activityId : null;
  if (!activityId) return jsonError("Choisis la pratique où tu l'as testé.", 400);
  if (typeof body?.observation !== "string" || body.observation.trim().length < 15) return jsonError("Écris ce que tu as observé (au moins une phrase).", 400);
  await addTrial(id, { activityId, coachId, rating, observation: body.observation });
  return NextResponse.json({ ok: true });
}
