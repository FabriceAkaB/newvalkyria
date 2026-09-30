import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getPlaytimeSegments, substituteIn, substituteOut } from "@/lib/match-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const segments = await getPlaytimeSegments(id);
  return NextResponse.json({ segments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { action?: "in" | "out"; registrationId?: string; minute?: number } | null;
  if (!body?.registrationId || (body.action !== "in" && body.action !== "out") || typeof body.minute !== "number") {
    return jsonError("Paramètres invalides", 400);
  }

  if (body.action === "in") await substituteIn(id, body.registrationId, body.minute);
  else await substituteOut(id, body.registrationId, body.minute);

  return NextResponse.json({ ok: true });
}
