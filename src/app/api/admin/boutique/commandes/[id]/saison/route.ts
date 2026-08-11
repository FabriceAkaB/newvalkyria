import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setOrderSeasonKey } from "@/lib/shop-repo";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { seasonKey?: string } | null;
  if (!body?.seasonKey) return jsonError("Saison requise", 400);

  await setOrderSeasonKey(id, body.seasonKey);
  return NextResponse.json({ ok: true });
}
