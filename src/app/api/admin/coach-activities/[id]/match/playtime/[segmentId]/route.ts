import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deletePlaytimeSegment, updatePlaytimeSegment } from "@/lib/match-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ segmentId: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { segmentId } = await params;

  const body = (await request.json().catch(() => null)) as { minuteIn?: number; minuteOut?: number | null } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  await updatePlaytimeSegment(segmentId, { minuteIn: body.minuteIn, minuteOut: body.minuteOut });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ segmentId: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { segmentId } = await params;
  await deletePlaytimeSegment(segmentId);
  return NextResponse.json({ ok: true });
}
