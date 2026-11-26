import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getRegistrationsForPlayer } from "@/lib/parent-repo";
import { getPaymentPlanForRegistration, getSeason, getSeasonPrograms } from "@/lib/season-admin-repo";
import { getPlayerAttendanceHistory, getPlayerEvaluations, getPlayerObjectives } from "@/lib/coach-portal-repo";
import { progressOf } from "@/lib/player-points";
import { getPointsSummaries, getRewards } from "@/lib/player-points-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const children = await getChildrenForParent(userId);
  const child = children.find((c) => c.id === id);
  if (!child) return jsonError("Profil introuvable", 404);
  if (!child.player_id) return NextResponse.json({ linked: false, seasons: [] });

  const registrations = await getRegistrationsForPlayer(child.player_id);
  // Points de la joueuse (présences, victoires, attitude) : sa barre de progression, comme dans un jeu.
  const [points, rewards] = await Promise.all([getPointsSummaries(registrations.map((r) => r.id)).catch(() => new Map()), getRewards().catch(() => [])]);
  const activeRewards = rewards.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name, cost: r.cost }));

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
        // Seulement ce que la famille voit (jamais la liste des autres filles attendues ni les notes de l'activité).
        attendance: attendance.map((a) => ({ id: a.id, status: a.status, activity: { activity_date: a.activity?.activity_date, title: a.activity?.title ?? null, activity_type: a.activity?.activity_type } })),
        // Les notes des éducateurs sont internes (elles peuvent parler d'autres enfants) : jamais envoyées aux parents,
        // comme dans le bulletin.
        evaluations: (evaluations as any[]).map((e) => ({ ...e, comment: null })),
        objectives,
        paymentPlan,
        points: points.get(reg.id) ? progressOf(points.get(reg.id)!.earned, activeRewards, points.get(reg.id)!.balance) : null
      };
    })
  );

  return NextResponse.json({ linked: true, seasons });
}
