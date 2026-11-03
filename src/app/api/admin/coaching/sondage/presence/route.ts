import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setPlayerAttendance, type PlayerAttendanceStatus } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getSurveyData } from "@/lib/practice-survey-repo";

const VALID: readonly string[] = ["present", "absent", "injured", "late", "left_early"] satisfies readonly PlayerAttendanceStatus[];

/** Présence des joueuses depuis le sondage de fin (espace Coaching). */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { activityId?: string; registrationIds?: string[]; status?: string } | null;
  const ids = Array.isArray(body?.registrationIds) ? body.registrationIds.map(String) : [];
  if (!body?.activityId || !ids.length || !body.status || !VALID.includes(body.status)) return jsonError("Paramètres invalides", 400);
  const data = await getSurveyData(body.activityId);
  if (!data) return jsonError("Activité introuvable", 404);
  const allowed = new Set(data.roster.map((p) => p.registrationId));
  if (ids.some((id) => !allowed.has(id))) return jsonError("Cette joueuse n'est pas attendue à cette pratique.", 403);
  await setPlayerAttendance(body.activityId, ids, body.status as PlayerAttendanceStatus);
  return NextResponse.json({ ok: true });
}
