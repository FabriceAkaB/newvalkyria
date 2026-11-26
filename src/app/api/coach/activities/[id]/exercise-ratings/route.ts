import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { APPROVAL_SCORE, parseScores } from "@/lib/exercise-bank";
import { getActivityExercisesToRate, saveRating } from "@/lib/exercises-repo";
import { setExerciseDoneInActivity } from "@/lib/planned-exercises-repo";
import { jsonError } from "@/lib/http";

const todayToronto = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** Rapport des 24 heures : chaque éducateur de la séance note sur 10 les exercices de la banque
 *  utilisés (5 critères à 0, 1 ou 2). La note recalcule le statut de l'exercice (exercise-bank.ts). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  const exercises = await getActivityExercisesToRate(id, coachId);
  return NextResponse.json({ exercises, canRate: entry.activity.activity_date <= todayToronto() });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (entry.activity.activity_date > todayToronto()) return jsonError("On note les exercices après la séance.", 400);

  const body = (await request.json().catch(() => null)) as { exerciseId?: string; scores?: unknown; comment?: string } | null;
  const parsed = parseScores(body?.scores);
  if (!body?.exerciseId || !parsed) return jsonError("Note les 5 critères (0, 1 ou 2).", 400);
  const comment = typeof body.comment === "string" && body.comment.trim() ? body.comment.trim() : null;
  if (parsed.total < APPROVAL_SCORE && (comment?.length ?? 0) < 10) return jsonError(`Sous ${APPROVAL_SCORE} sur 10 : écris ce qu'il faut changer.`, 400);

  const used = await getActivityExercisesToRate(id, coachId);
  if (!used.some((e) => e.exerciseId === body.exerciseId)) return jsonError("Cet exercice n'est pas dans le plan de cette séance.", 400);

  const coach = await getCoach(coachId);
  await saveRating({
    exerciseId: body.exerciseId,
    activityId: id,
    activityDate: entry.activity.activity_date,
    coachId,
    raterName: coach ? `${coach.first_name} ${coach.last_name}`.trim() : null,
    scores: parsed.scores,
    total: parsed.total,
    comment
  });
  const after = (await getActivityExercisesToRate(id, coachId)).find((e) => e.exerciseId === body.exerciseId);
  return NextResponse.json({ ok: true, total: parsed.total, bank: after?.bank ?? null });
}

/** « On ne l'a pas fait » : l'exercice prévu n'a pas été joué (ou on annule : il a été fait). Même état que
 *  « Exercices prévus : faits ? » du rapport (Non / Oui), partagé par tous les éducateurs (planned-exercises.ts). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  const body = (await request.json().catch(() => null)) as { exerciseId?: string; notDone?: boolean; note?: string } | null;
  if (!body?.exerciseId || typeof body.notDone !== "boolean") return jsonError("Paramètres invalides", 400);
  const used = await getActivityExercisesToRate(id, coachId);
  if (!used.some((e) => e.exerciseId === body.exerciseId)) return jsonError("Cet exercice n'est pas dans le plan de cette séance.", 400);
  if (String(entry.activity.activity_date).slice(0, 10) > todayToronto()) return jsonError("On répond le jour de la pratique ou après.", 400);
  await setExerciseDoneInActivity(id, body.exerciseId, !body.notDone, coachId, typeof body.note === "string" ? body.note.trim() : null);
  return NextResponse.json({ ok: true });
}
