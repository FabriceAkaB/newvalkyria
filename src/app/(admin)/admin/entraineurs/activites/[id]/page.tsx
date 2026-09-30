import { notFound } from "next/navigation";

import { AdminCoachActiviteDetail } from "@/components/admin-coach-activite-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { getActivity, getActivityAssignments, getAllCoachTypeRates, getCoaches } from "@/lib/coaches-repo";
import { getExercises } from "@/lib/exercises-repo";
import { getConvocations, getLineup, getMatchDetails, getMatchEvaluations, getMatchRoster, getPlaytimeSegments } from "@/lib/match-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getBlocksForActivity } from "@/lib/session-plan-repo";

export const metadata = { title: "Activité — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCoachActiviteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { id } = await params;

  const activity = await getActivity(id);
  if (!activity) notFound();

  const isMatch = activity.activity_type === "Match";

  const [assignments, coaches, typeRates, blocks, exercises, matchRoster, matchDetails, matchConvocations, matchLineup, matchPlaytime, matchEvaluations] = await Promise.all([
    getActivityAssignments(id),
    getCoaches(),
    getAllCoachTypeRates(),
    getBlocksForActivity(id),
    getExercises(),
    isMatch ? getMatchRoster(SEASON_DB_ID, activity.category, activity.activity_date) : Promise.resolve([]),
    isMatch ? getMatchDetails(id) : Promise.resolve(null),
    isMatch ? getConvocations(id) : Promise.resolve([]),
    isMatch ? getLineup(id) : Promise.resolve([]),
    isMatch ? getPlaytimeSegments(id) : Promise.resolve([]),
    isMatch ? getMatchEvaluations(id) : Promise.resolve([])
  ]);

  return (
    <AdminCoachActiviteDetail
      activity={activity}
      initialAssignments={assignments}
      coaches={coaches}
      typeRates={typeRates}
      initialBlocks={blocks}
      exercises={exercises}
      matchRoster={matchRoster}
      initialMatchDetails={matchDetails}
      initialMatchConvocations={matchConvocations}
      initialMatchLineup={matchLineup}
      initialMatchPlaytime={matchPlaytime}
      initialMatchEvaluations={matchEvaluations}
    />
  );
}
