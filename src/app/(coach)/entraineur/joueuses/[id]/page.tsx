import { notFound } from "next/navigation";

import { CoachJoueurDetail } from "@/components/coach-joueur-detail";
import { requireCoach } from "@/lib/coach-auth";
import { getPlayerAttendanceHistory, getPlayerEvaluations, getPlayerObjectives, getPlayerProfile, getPlayerRoutines } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { getExercises } from "@/lib/exercises-repo";

export const metadata = { title: "Joueuse — Espace Technique" };
export const dynamic = "force-dynamic";

export default async function CoachJoueurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;

  const [coach, player, evaluations, objectives, routines, exercises, attendanceHistory] = await Promise.all([
    getCoach(coachId),
    getPlayerProfile(id),
    getPlayerEvaluations(id),
    getPlayerObjectives(id),
    getPlayerRoutines(id),
    getExercises(),
    getPlayerAttendanceHistory(id)
  ]);

  if (!player) notFound();

  return (
    <CoachJoueurDetail
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      player={player}
      evaluations={evaluations}
      objectives={objectives}
      routines={routines}
      exercises={exercises}
      attendanceHistory={attendanceHistory}
    />
  );
}
