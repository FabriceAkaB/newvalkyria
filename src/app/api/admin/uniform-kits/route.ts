import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setUniformKitDelivered, type UniformKitSourceType } from "@/lib/uniform-kits-repo";

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    seasonKey?: string;
    sourceType?: UniformKitSourceType;
    sourceId?: string;
    delivered?: boolean;
    deliveredBy?: string | null;
  } | null;

  if (!body?.seasonKey || !body.sourceType || !body.sourceId || typeof body.delivered !== "boolean") {
    return jsonError("Paramètres invalides", 400);
  }
  if (body.delivered && !body.deliveredBy?.trim()) {
    return jsonError("Nom de la personne ayant remis l'uniforme requis", 400);
  }

  await setUniformKitDelivered(body.seasonKey, body.sourceType, body.sourceId, body.delivered, body.deliveredBy ?? null);
  return NextResponse.json({ ok: true });
}
