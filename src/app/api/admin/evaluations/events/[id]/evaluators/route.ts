import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addEvaluator, getEvaluatorsForEvent } from "@/lib/tryout-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const evaluators = await getEvaluatorsForEvent(id);
  return NextResponse.json({ evaluators });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { coachId?: string; guestName?: string } | null;
  if (!body?.coachId && !body?.guestName) return jsonError("coachId ou guestName requis", 400);
  const evaluatorId = await addEvaluator(id, body);
  return NextResponse.json({ id: evaluatorId });
}
