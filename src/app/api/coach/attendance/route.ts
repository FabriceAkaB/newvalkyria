import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { setPlayerAttendance, type PlayerAttendanceStatus } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

const VALID_STATUSES: readonly string[] = ["present", "absent", "injured", "late", "left_early"] satisfies readonly PlayerAttendanceStatus[];

export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { activityId?: string; registrationId?: string; status?: string } | null;
  if (!body?.activityId || !body.registrationId || !body.status || !VALID_STATUSES.includes(body.status)) {
    return jsonError("Paramètres invalides", 400);
  }

  await setPlayerAttendance(body.activityId, body.registrationId, body.status as PlayerAttendanceStatus);
  return NextResponse.json({ ok: true });
}
