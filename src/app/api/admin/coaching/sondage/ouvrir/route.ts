import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { openSurveyActivity } from "@/lib/practice-survey-repo";

/** Ouvre le sondage de fin d'une pratique de l'horaire (crée son activité au besoin). */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { key?: string } | null;
  if (!body?.key) return jsonError("Paramètres invalides", 400);
  const activityId = await openSurveyActivity(body.key);
  if (!activityId) return jsonError("Pratique introuvable (seulement aujourd'hui et les 7 derniers jours).", 404);
  return NextResponse.json({ ok: true, activityId });
}
