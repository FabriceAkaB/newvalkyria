import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityWithRoster, setPlayerFeedback } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { parseSurveyAnswer } from "@/lib/practice-survey";

/** Sondage de fin (P1.5.06) : plaisir et fatigue (sur 10) et ce que la joueuse aimerait avoir plus, saisis par l'éducateur. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const activityId = typeof body?.activityId === "string" ? body.activityId : null;
  const registrationId = typeof body?.registrationId === "string" ? body.registrationId : null;
  const answer = body ? parseSurveyAnswer(body) : "Paramètres invalides";
  if (!activityId || !registrationId) return jsonError("Paramètres invalides", 400);
  if (typeof answer === "string") return jsonError(answer, 400);

  const entry = await getCoachActivityWithRoster(coachId, activityId);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (!entry.roster.some((p) => p.registrationId === registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette activité.", 403);

  await setPlayerFeedback(activityId, registrationId, answer);
  return NextResponse.json({ ok: true });
}
