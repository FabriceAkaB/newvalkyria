import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getDebriefs, getPreviousGroupDebriefs, saveDebrief } from "@/lib/practice-debriefs-repo";

/** Retour de l'éducateur sur la pratique : le sien et celui des autres éducateurs, plus le dernier retour du groupe. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const access = await getCoachActivityAccess(coachId, id);
  if (!access) return jsonError("Activité introuvable", 404);
  const [debriefs, previous] = await Promise.all([getDebriefs([id]), getPreviousGroupDebriefs(access.activity as any).catch(() => [])]);
  return NextResponse.json({ coachId, debriefs, previous });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Rien à enregistrer", 400);
  await saveDebrief(id, coachId, body);
  return NextResponse.json({ ok: true });
}
