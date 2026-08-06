import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setCoachTypeRate } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { coachId?: string; activityType?: string; hourlyRateCents?: number } | null;
  if (!body?.coachId || !body.activityType || typeof body.hourlyRateCents !== "number" || body.hourlyRateCents < 0) {
    return jsonError("Paramètres invalides", 400);
  }

  await setCoachTypeRate(body.coachId, body.activityType, Math.round(body.hourlyRateCents));
  return NextResponse.json({ ok: true });
}
