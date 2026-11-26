import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { parseJournalPatch } from "@/lib/practice-journal";
import { getJournal, saveJournal } from "@/lib/practice-debriefs-repo";
import { outcomeDone } from "@/lib/planned-exercises";
import { getBlockAnswers, setPlannedBlocksDone } from "@/lib/planned-exercises-repo";

/** Rapport journalier de la pratique (JP, 20 nov. 2026) : lu et enregistré champ par champ, au fil de la journée.
 *  « Exercices réalisés » lit et écrit l'état partagé « Exercices prévus : faits ? » (Sauté = Non ; Fait, Modifié = Oui). */
const todayToronto = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  const [journal, answers] = await Promise.all([getJournal(id, coachId), getBlockAnswers(id).catch(() => ({}))]);
  return NextResponse.json({ journal, answers });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  const patch = parseJournalPatch(await request.json().catch(() => null));
  if (!patch) return jsonError("Rien à enregistrer", 400);
  const outcomes = Object.entries(patch.exercices ?? {});
  if (outcomes.length && String(entry.activity.activity_date).slice(0, 10) > todayToronto()) return jsonError("On répond le jour de la pratique ou après.", 400);
  const journal = await saveJournal(id, coachId, patch);
  // Même réponse pour tous les éducateurs : le bloc passe à Oui (fait, modifié) ou Non (sauté).
  for (const done of [true, false]) {
    const ids = outcomes.filter(([, o]) => outcomeDone(o) === done).map(([blockId]) => blockId);
    if (ids.length) await setPlannedBlocksDone(id, ids, done, coachId).catch(() => null);
  }
  return NextResponse.json({ journal, answers: await getBlockAnswers(id).catch(() => ({})) });
}
