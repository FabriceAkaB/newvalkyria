import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setActiveSeason } from "@/lib/season-admin-repo";

export async function PUT(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { seasonId?: string } | null;
  if (!body?.seasonId) return jsonError("Saison requise", 400);

  await setActiveSeason(body.seasonId);
  return NextResponse.json({ ok: true });
}
