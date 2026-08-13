import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createTerrain, getTerrains } from "@/lib/terrains-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const terrains = await getTerrains();
  return NextResponse.json({ terrains });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { name?: string; address?: string | null } | null;
  if (!body?.name?.trim()) return jsonError("Nom du terrain requis", 400);

  const id = await createTerrain({ name: body.name.trim(), address: body.address?.trim() || null });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
