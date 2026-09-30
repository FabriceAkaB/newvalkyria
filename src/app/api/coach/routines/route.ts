import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { addPlayerRoutine } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { registrationId?: string; title?: string; notes?: string | null; exerciseIds?: string[] } | null;
  if (!body?.registrationId || !body.title?.trim()) return jsonError("Paramètres invalides", 400);

  await addPlayerRoutine(
    body.registrationId,
    { title: body.title.trim(), notes: body.notes?.trim() || null, exerciseIds: Array.isArray(body.exerciseIds) ? body.exerciseIds : [] },
    coachId
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
