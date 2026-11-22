import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { cleanCriteria, scoreOn10 } from "@/lib/match-evaluation";
import { getMatchEvaluations, saveMatchEvaluation, setConvocation } from "@/lib/match-repo";

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
    /** Fiche en 10 points (page « Évaluer le match », aussi envoyée plus tard si l'appareil était hors réseau). */
    sheet?: boolean;
    present?: boolean;
    criteria?: Record<string, unknown>;
    strengths?: string | null;
    toImprove?: string | null;
  } | null;
  if (body?.sheet && body.registrationId) {
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : null);
    if (body.present === false) {
      await setConvocation(id, body.registrationId, "absent");
      return NextResponse.json({ ok: true });
    }
    const criteria = cleanCriteria(body.criteria);
    await setConvocation(id, body.registrationId, "confirmed");
    await saveMatchEvaluation({
      activityId: id,
      registrationId: body.registrationId,
      coachId,
      positionCode: typeof body.positionCode === "string" && body.positionCode ? body.positionCode : null,
      scale: 10,
      score: scoreOn10(criteria),
      comment: text(body.comment),
      criteria,
      strengths: text(body.strengths),
      toImprove: text(body.toImprove)
    });
    return NextResponse.json({ ok: true });
  }
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
