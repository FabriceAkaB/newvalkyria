import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setRevenueGoal } from "@/lib/revenue-repo";

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { seasonKey?: string; seasonLabel?: string; goalCents?: number };

  if (!body.seasonKey || !body.seasonLabel || typeof body.goalCents !== "number" || body.goalCents < 0) {
    return jsonError("Données invalides", 400);
  }

  await setRevenueGoal(body.seasonKey, body.seasonLabel, Math.round(body.goalCents));
  return NextResponse.json({ ok: true });
}
