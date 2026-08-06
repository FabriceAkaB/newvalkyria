import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setMonthlyGoal } from "@/lib/revenue-repo";

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { month?: string; goalCents?: number };

  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month) || typeof body.goalCents !== "number" || body.goalCents < 0) {
    return jsonError("Données invalides", 400);
  }

  await setMonthlyGoal(body.month, Math.round(body.goalCents));
  return NextResponse.json({ ok: true });
}
