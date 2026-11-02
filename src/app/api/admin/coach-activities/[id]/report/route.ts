import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getActivityAttendance, getActivityEvaluations, getActivityRoster } from "@/lib/coach-portal-repo";
import { computeReport, reportRequired } from "@/lib/coach-report";
import { getActivity, getCoaches } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

/** Rapport des éducateurs pour une activité : présence, évaluation rapide et routine de fin de chaque joueuse. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) return jsonError("Activité introuvable", 404);

  const [roster, attendance, evaluations, coaches] = await Promise.all([getActivityRoster(activity), getActivityAttendance(id), getActivityEvaluations(id), getCoaches()]);
  const coachName = new Map(coaches.map((c) => [c.id, c.first_name]));
  const report = computeReport({
    activity,
    roster: roster.map((p) => ({ registrationId: p.registrationId, name: `${p.firstName} ${p.lastName}`.trim() })),
    attendance,
    evaluations
  });

  return NextResponse.json({
    required: reportRequired(activity, roster.length),
    report,
    players: roster.map((p) => {
      const a = attendance.find((x) => x.registration_id === p.registrationId) ?? null;
      return {
        registrationId: p.registrationId,
        name: `${p.firstName} ${p.lastName}`.trim(),
        isTrial: p.isTrial,
        status: a?.status ?? null,
        practiceRating: a?.practice_rating ?? null,
        fatigue: a?.fatigue ?? null,
        evaluations: evaluations
          .filter((e) => e.registration_id === p.registrationId)
          .map((e) => ({ coach: coachName.get(e.coach_id) ?? "", ratings: e.ratings, comment: e.comment }))
      };
    })
  });
}
