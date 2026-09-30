import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { deactivatePlayerRoutine } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await deactivatePlayerRoutine(id);
  return NextResponse.json({ ok: true });
}
