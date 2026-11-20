import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { parseJournalPatch } from "@/lib/practice-journal";
import { getJournal, saveJournal } from "@/lib/practice-debriefs-repo";

/** Rapport journalier de la pratique (JP, 20 nov. 2026) : lu et enregistré champ par champ, au fil de la journée. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  return NextResponse.json({ journal: await getJournal(id, coachId) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  const patch = parseJournalPatch(await request.json().catch(() => null));
  if (!patch) return jsonError("Rien à enregistrer", 400);
  return NextResponse.json({ journal: await saveJournal(id, coachId, patch) });
}
