import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityWithRoster, setPlayerAttendance, type PlayerAttendanceStatus } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

const VALID_STATUSES: readonly string[] = ["present", "absent", "injured", "late", "left_early"] satisfies readonly PlayerAttendanceStatus[];

/** Présence d'une joueuse (ou de plusieurs : « toutes présentes ») — seulement pour une activité de ce coach
 *  et des joueuses attendues à cette activité. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { activityId?: string; registrationId?: string; registrationIds?: string[]; status?: string } | null;
  const ids = body?.registrationIds ?? (body?.registrationId ? [body.registrationId] : []);
  if (!body?.activityId || !ids.length || !body.status || !VALID_STATUSES.includes(body.status)) {
    return jsonError("Paramètres invalides", 400);
  }

  const entry = await getCoachActivityWithRoster(coachId, body.activityId);
  if (!entry) return jsonError("Activité introuvable", 404);
  const allowed = new Set(entry.roster.map((p) => p.registrationId));
  if (ids.some((id) => !allowed.has(id))) return jsonError("Cette joueuse n'est pas attendue à cette activité.", 403);

  await setPlayerAttendance(body.activityId, ids, body.status as PlayerAttendanceStatus);
  return NextResponse.json({ ok: true });
}
