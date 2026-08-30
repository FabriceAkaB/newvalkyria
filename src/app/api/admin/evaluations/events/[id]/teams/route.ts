import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createTeam, getTeamsForEvent } from "@/lib/tryout-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const teams = await getTeamsForEvent(id);
  return NextResponse.json({ teams });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string; colorHex?: string } | null;
  if (!body?.name || !body.colorHex) return jsonError("name et colorHex requis", 400);
  const teamId = await createTeam(id, body.name, body.colorHex);
  return NextResponse.json({ id: teamId });
}
