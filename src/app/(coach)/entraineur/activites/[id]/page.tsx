import { notFound } from "next/navigation";

import { CoachActiviteDetail } from "@/components/coach-activite-detail";
import { requireCoach } from "@/lib/coach-auth";
import { getActivityAttendance, getActivityEvaluations, getCoachActivityById, getExpectedRoster } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { getExercises } from "@/lib/exercises-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getBlocksForActivity } from "@/lib/session-plan-repo";

export const metadata = { title: "Activité — Espace Entraîneur" };
export const dynamic = "force-dynamic";

export default async function CoachActiviteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;

  const entry = await getCoachActivityById(coachId, id);
  if (!entry) notFound();

  const [coach, roster, attendance, evaluations, blocks, exercises] = await Promise.all([
    getCoach(coachId),
    getExpectedRoster(SEASON_DB_ID, entry.activity.category, entry.activity.activity_date),
    getActivityAttendance(id),
    getActivityEvaluations(id),
    getBlocksForActivity(id),
    getExercises()
  ]);

  const myEvaluations = evaluations.filter((e) => e.coach_id === coachId);
  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));

  return (
    <CoachActiviteDetail
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      activity={entry.activity}
      otherCoaches={entry.otherCoaches}
      roster={roster}
      initialAttendance={attendance}
      initialEvaluations={myEvaluations}
      sessionBlocks={blocks.map((b) => ({ ...b, exercise: b.exercise_id ? exerciseById.get(b.exercise_id) ?? null : null }))}
    />
  );
}
