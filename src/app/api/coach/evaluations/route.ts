import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { saveEvaluation } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

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

  await saveEvaluation({
    activityId: body.activityId,
    registrationId: body.registrationId,
    coachId,
    ratings: body.ratings ?? {},
    comment: body.comment ?? null
  });
  return NextResponse.json({ ok: true });
}
