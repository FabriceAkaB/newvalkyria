import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getRegistrationsForPlayer } from "@/lib/parent-repo";
import { getPaymentPlanForRegistration, getSeason, getSeasonPrograms } from "@/lib/season-admin-repo";
import { getPlayerAttendanceHistory, getPlayerEvaluations, getPlayerObjectives } from "@/lib/coach-portal-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const children = await getChildrenForParent(userId);
  const child = children.find((c) => c.id === id);
  if (!child) return jsonError("Profil introuvable", 404);
  if (!child.player_id) return NextResponse.json({ linked: false, seasons: [] });

  const registrations = await getRegistrationsForPlayer(child.player_id);

  const seasons = await Promise.all(
    registrations.map(async (reg) => {
      const [season, attendance, evaluations, objectives, paymentPlan] = await Promise.all([
        getSeason(reg.seasonId),
        getPlayerAttendanceHistory(reg.id),
        getPlayerEvaluations(reg.id),
        getPlayerObjectives(reg.id),
        getPaymentPlanForRegistration(reg.id)
      ]);
      const programs = reg.seasonId ? await getSeasonPrograms(reg.seasonId) : [];
      const program = programs.find((p) => p.id === reg.programId);

      return {
        registrationId: reg.id,
        seasonLabel: season?.label ?? reg.seasonId,
        programName: program?.name ?? null,
        status: reg.status,
        isTrial: reg.isTrial,
        attendance,
        evaluations,
        objectives,
        paymentPlan
      };
    })
  );

  return NextResponse.json({ linked: true, seasons });
}
