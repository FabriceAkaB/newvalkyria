import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setPlayerFeedback } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { parseSurveyAnswer } from "@/lib/practice-survey";
import { getSurveyData } from "@/lib/practice-survey-repo";

/** Réponse d'une joueuse au sondage de fin : plaisir, fatigue, ce qu'elle aimerait avoir plus. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const activityId = typeof body?.activityId === "string" ? body.activityId : null;
  const registrationId = typeof body?.registrationId === "string" ? body.registrationId : null;
  if (!body || !activityId || !registrationId) return jsonError("Paramètres invalides", 400);
  const answer = parseSurveyAnswer(body);
  if (typeof answer === "string") return jsonError(answer, 400);
  const data = await getSurveyData(activityId);
  if (!data) return jsonError("Activité introuvable", 404);
  if (!data.roster.some((p) => p.registrationId === registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette pratique.", 403);
  await setPlayerFeedback(activityId, registrationId, answer);
  return NextResponse.json({ ok: true });
}
