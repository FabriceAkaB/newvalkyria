import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityWithRoster, setPlayerFeedback } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

const score = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10 ? Number(v) : undefined);

/** Routine de fin (P1.5.06) : la note de la pratique et la fatigue (sur 10) données par la joueuse, saisies par l'éducateur. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { activityId?: string; registrationId?: string; practiceRating?: unknown; fatigue?: unknown } | null;
  const practiceRating = score(body?.practiceRating);
  const fatigue = score(body?.fatigue);
  if (!body?.activityId || !body.registrationId || practiceRating === undefined || fatigue === undefined) {
    return jsonError("Les notes vont de 0 à 10.", 400);
  }

  const entry = await getCoachActivityWithRoster(coachId, body.activityId);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (!entry.roster.some((p) => p.registrationId === body.registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette activité.", 403);

  await setPlayerFeedback(body.activityId, body.registrationId, practiceRating, fatigue);
  return NextResponse.json({ ok: true });
}
