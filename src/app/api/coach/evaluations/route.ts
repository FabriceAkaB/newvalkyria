import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getActivityNotes, getCoachActivityWithRoster, getCoachPreviousNotes, saveEvaluation } from "@/lib/coach-portal-repo";
import { checkNote, cleanNote, QUICK_CRITERIA } from "@/lib/coach-report";
import { jsonError } from "@/lib/http";

/** Évaluation rapide d'une joueuse (P1.2.08) : 3 échelles de 1 à 5 + une note d'au moins 30 caractères.
 *  Contrôle de qualité (P1.4.09) : note trop courte, répétitive, copiée d'une autre fille ou d'une séance
 *  précédente = refusée avec un message clair (422). */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    activityId?: string;
    registrationId?: string;
    ratings?: Record<string, number>;
    comment?: string | null;
  } | null;

  if (!body?.activityId || !body.registrationId) {
    return jsonError("Paramètres invalides", 400);
  }

  const entry = await getCoachActivityWithRoster(coachId, body.activityId);
  if (!entry) return jsonError("Activité introuvable", 404);
  const player = entry.roster.find((p) => p.registrationId === body.registrationId);
  if (!player) return jsonError("Cette joueuse n'est pas attendue à cette activité.", 403);

  const ratings: Record<string, number> = {};
  for (const c of QUICK_CRITERIA) {
    const v = Number(body.ratings?.[c]);
    if (!Number.isInteger(v) || v < 1 || v > 5) return jsonError(`Choisis une note de 1 à 5 pour « ${c} ».`, 422);
    ratings[c] = v;
  }

  const comment = cleanNote(body.comment);
  const [sameActivity, previous] = await Promise.all([getActivityNotes(body.activityId, body.registrationId), getCoachPreviousNotes(coachId, body.activityId)]);
  const check = checkNote({ note: comment, playerFirstName: player.firstName, sameActivity, previous });
  if (!check.ok) return NextResponse.json({ error: check.message, code: check.code }, { status: 422 });

  await saveEvaluation({ activityId: body.activityId, registrationId: body.registrationId, coachId, ratings, comment });
  return NextResponse.json({ ok: true, ratings, comment });
}
