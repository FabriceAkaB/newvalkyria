import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getLineup, removeLineupSlot, setLineupSlot } from "@/lib/match-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const slots = await getLineup(id);
  return NextResponse.json({ slots });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    registrationId?: string;
    positionCode?: string | null;
    x?: number | null;
    y?: number | null;
    isStarter?: boolean;
  } | null;
  if (!body?.registrationId) return jsonError("registrationId requis", 400);

  await setLineupSlot(id, body.registrationId, {
    positionCode: body.positionCode,
    x: body.x,
    y: body.y,
    isStarter: body.isStarter
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const registrationId = searchParams.get("registrationId");
  if (!registrationId) return jsonError("registrationId requis", 400);

  await removeLineupSlot(id, registrationId);
  return NextResponse.json({ ok: true });
}
