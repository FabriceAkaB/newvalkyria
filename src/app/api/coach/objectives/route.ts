import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { addPlayerObjective } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { registrationId?: string; objective?: string } | null;
  if (!body?.registrationId || !body.objective?.trim()) return jsonError("Paramètres invalides", 400);

  await addPlayerObjective(body.registrationId, body.objective.trim(), coachId);
  return NextResponse.json({ ok: true }, { status: 201 });
}
