import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getMatchEvaluations, saveMatchEvaluation } from "@/lib/match-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);
  const evaluations = await getMatchEvaluations(id);
  return NextResponse.json({ evaluations });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);

  const body = (await request.json().catch(() => null)) as {
    registrationId?: string;
    positionCode?: string | null;
    scale?: 10 | 100;
    score?: number | null;
    comment?: string | null;
  } | null;
  if (!body?.registrationId || (body.scale !== 10 && body.scale !== 100)) return jsonError("Paramètres invalides", 400);

  await saveMatchEvaluation({
    activityId: id,
    registrationId: body.registrationId,
    coachId,
    positionCode: body.positionCode ?? null,
    scale: body.scale,
    score: body.score ?? null,
    comment: body.comment ?? null
  });
  return NextResponse.json({ ok: true });
}
