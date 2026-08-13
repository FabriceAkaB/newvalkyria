import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addBlock, getBlocksForActivity, SESSION_BLOCK_TYPES } from "@/lib/session-plan-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const blocks = await getBlocksForActivity(id);
  return NextResponse.json({ blocks });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    blockType?: string;
    exerciseId?: string | null;
    customTitle?: string | null;
    durationMinutes?: number;
    notes?: string | null;
  } | null;

  if (!body?.blockType || !(SESSION_BLOCK_TYPES as readonly string[]).includes(body.blockType)) {
    return jsonError("Type de bloc invalide", 400);
  }
  const durationMinutes = typeof body.durationMinutes === "number" && body.durationMinutes > 0 ? body.durationMinutes : 10;

  const blockId = await addBlock(id, {
    blockType: body.blockType,
    exerciseId: body.exerciseId || null,
    customTitle: body.customTitle || null,
    durationMinutes,
    notes: body.notes || null
  });

  return NextResponse.json({ ok: true, id: blockId }, { status: 201 });
}
