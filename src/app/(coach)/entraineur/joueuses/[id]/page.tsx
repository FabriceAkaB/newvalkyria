import { notFound } from "next/navigation";

import { CoachJoueurDetail } from "@/components/coach-joueur-detail";
import { requireCoach } from "@/lib/coach-auth";
import { getPlayerAttendanceHistory, getPlayerEvaluations, getPlayerObjectives, getPlayerProfile } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";

export const metadata = { title: "Joueuse — Espace Entraîneur" };
export const dynamic = "force-dynamic";

export default async function CoachJoueurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;

  const [coach, player, evaluations, objectives, attendanceHistory] = await Promise.all([
    getCoach(coachId),
    getPlayerProfile(id),
    getPlayerEvaluations(id),
    getPlayerObjectives(id),
    getPlayerAttendanceHistory(id)
  ]);

  if (!player) notFound();

  return (
    <CoachJoueurDetail
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      player={player}
      evaluations={evaluations}
      objectives={objectives}
      attendanceHistory={attendanceHistory}
    />
  );
}
