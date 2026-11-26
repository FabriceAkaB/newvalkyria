import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";
import { handleProgressVideoAction } from "@/lib/progress-videos-repo";

/** Vidéos de progression déposées par l'éducateur vidéaste depuis son portail (JP, 19 et 25 nov. 2026) : mêmes actions
 *  que l'admin (dépôt, rattachement, aperçu, retrait, étape, « Absente ce jour-là »). */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const coach = await getCoach(coachId);
  if (!coach?.is_videographer) return jsonError("Réservé au vidéaste de l'académie.", 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const result = await handleProgressVideoAction(body, `${coach.first_name} ${coach.last_name}`.trim());
    if (result) return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  return jsonError("Action inconnue", 400);
}
