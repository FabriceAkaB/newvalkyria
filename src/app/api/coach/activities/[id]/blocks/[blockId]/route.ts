import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { deleteBlock, swapBlockOrder, updateBlock } from "@/lib/session-plan-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id, blockId } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);

  const body = (await request.json().catch(() => null)) as {
    move?: "up" | "down";
    blockType?: string;
    exerciseId?: string | null;
    customTitle?: string | null;
    durationMinutes?: number;
    notes?: string | null;
  } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  if (body.move) {
    await swapBlockOrder(id, blockId, body.move);
    return NextResponse.json({ ok: true });
  }

  await updateBlock(blockId, {
    blockType: body.blockType,
    exerciseId: body.exerciseId,
    customTitle: body.customTitle,
    durationMinutes: body.durationMinutes,
    notes: body.notes
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id, blockId } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);
  await deleteBlock(blockId);
  return NextResponse.json({ ok: true });
}
