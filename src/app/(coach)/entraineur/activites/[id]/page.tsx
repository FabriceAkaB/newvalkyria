import { notFound } from "next/navigation";

import { CoachActiviteDetail } from "@/components/coach-activite-detail";
import { requireCoach } from "@/lib/coach-auth";
import { getActivityAttendance, getActivityEvaluations, getCoachActivityById, getExpectedRoster } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { getExercises } from "@/lib/exercises-repo";
import { getConvocations, getLineup, getMatchDetails, getMatchEvaluations, getMatchRoster, getPlaytimeSegments } from "@/lib/match-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getBlocksForActivity } from "@/lib/session-plan-repo";

export const metadata = { title: "Activité — Espace Technique" };
export const dynamic = "force-dynamic";

export default async function CoachActiviteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;

  const entry = await getCoachActivityById(coachId, id);
  if (!entry) notFound();

  const isMatch = entry.activity.activity_type === "Match";

  const [coach, roster, attendance, evaluations, blocks, exercises, matchRoster, matchDetails, matchConvocations, matchLineup, matchPlaytime, matchEvaluations] = await Promise.all([
    getCoach(coachId),
    getExpectedRoster(SEASON_DB_ID, entry.activity.category, entry.activity.activity_date),
    getActivityAttendance(id),
    getActivityEvaluations(id),
    getBlocksForActivity(id),
    getExercises(),
    isMatch ? getMatchRoster(SEASON_DB_ID, entry.activity.category, entry.activity.activity_date) : Promise.resolve([]),
    isMatch ? getMatchDetails(id) : Promise.resolve(null),
    isMatch ? getConvocations(id) : Promise.resolve([]),
    isMatch ? getLineup(id) : Promise.resolve([]),
    isMatch ? getPlaytimeSegments(id) : Promise.resolve([]),
    isMatch ? getMatchEvaluations(id) : Promise.resolve([])
  ]);

  const myEvaluations = evaluations.filter((e) => e.coach_id === coachId);

  return (
    <CoachActiviteDetail
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      coachId={coachId}
      activity={entry.activity}
      otherCoaches={entry.otherCoaches}
      roster={roster}
      initialAttendance={attendance}
      initialEvaluations={myEvaluations}
      sessionBlocks={blocks}
      initialExercises={exercises}
      matchRoster={matchRoster}
      initialMatchDetails={matchDetails}
      initialMatchConvocations={matchConvocations}
      initialMatchLineup={matchLineup}
      initialMatchPlaytime={matchPlaytime}
      initialMatchEvaluations={matchEvaluations}
    />
  );
}
