import { notFound } from "next/navigation";

import { CoachActiviteDetail } from "@/components/coach-activite-detail";
import { getComponents } from "@/lib/coaching-method-repo";
import { requireCoach } from "@/lib/coach-auth";
import { cleanCategory, getActivityAttendance, getActivityEvaluations, getActivityRoster, getBriefing, getCoachActivityById } from "@/lib/coach-portal-repo";
import { defaultStepFor } from "@/lib/coach-report";
import { getCoach } from "@/lib/coaches-repo";
import { getActivityWinners } from "@/lib/player-points-repo";
import { getExercisesForPlanning } from "@/lib/exercises-repo";
import { videosForActivity } from "@/lib/match-videos";
import { getConvocations, getLineup, getMatchDetails, getMatchEvaluations, getMatchRoster, getPlaytimeSegments } from "@/lib/match-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate, themeFor } from "@/lib/season-themes-repo";
import { getBlocksForActivity } from "@/lib/session-plan-repo";

export const metadata = { title: "Activité — Espace Technique" };
export const dynamic = "force-dynamic";

export default async function CoachActiviteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;

  const entry = await getCoachActivityById(coachId, id);
  if (!entry) notFound();

  const isMatch = entry.activity.activity_type === "Match";
  const activityDate = String(entry.activity.activity_date).slice(0, 10);

  const [coach, roster, attendance, evaluations, blocks, exercises, theme, matchRoster, matchDetails, matchConvocations, matchLineup, matchPlaytime, matchEvaluations] = await Promise.all([
    getCoach(coachId),
    getActivityRoster(entry.activity),
    getActivityAttendance(id),
    getActivityEvaluations(id),
    getBlocksForActivity(id),
    // Banque Valkyria : approuvés d'abord, sans les exercices qui ne peuvent pas aller dans cette séance
    getBlocksForActivity(id).then((b) => getExercisesForPlanning(entry.activity.activity_date, b.map((x) => x.exercise_id))),
    getThemeForDate(SEASON_DB_ID, new Date(`${activityDate}T12:00:00`)).catch(() => null),
    isMatch ? getMatchRoster(SEASON_DB_ID, entry.activity.category, entry.activity.activity_date) : Promise.resolve([]),
    isMatch ? getMatchDetails(id) : Promise.resolve(null),
    isMatch ? getConvocations(id) : Promise.resolve([]),
    isMatch ? getLineup(id) : Promise.resolve([]),
    isMatch ? getPlaytimeSegments(id) : Promise.resolve([]),
    isMatch ? getMatchEvaluations(id) : Promise.resolve([])
  ]);

  const [briefing, winners, components, videos] = await Promise.all([
    getBriefing(entry.activity, roster).catch(() => []),
    getActivityWinners(id).catch(() => []),
    getComponents().catch(() => null),
    videosForActivity(id).catch(() => [])
  ]);

  // Accès limité : la présence de l'éducateur sans son taux ni les champs de paiement.
  const { assignment } = entry;
  const myPresence = {
    status: assignment.status,
    confirmed: assignment.confirmed,
    arrivalTime: assignment.arrival_time ? String(assignment.arrival_time).slice(0, 5) : null,
    departureTime: assignment.departure_time ? String(assignment.departure_time).slice(0, 5) : null,
    locked: assignment.paid
  };
  // Étape ouverte par défaut selon l'heure (Montréal) : avant, pendant ou après l'activité.
  const defaultStep = defaultStepFor(activityDate, String(entry.activity.start_time).slice(0, 5), String(entry.activity.end_time).slice(0, 5));
  const coachNames: Record<string, string> = Object.fromEntries([
    [coachId, coach?.first_name ?? "Moi"],
    ...entry.otherCoaches.map((c) => [c.id, c.first_name] as [string, string])
  ]);

  return (
    <CoachActiviteDetail
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      coachId={coachId}
      activity={entry.activity}
      otherCoaches={entry.otherCoaches}
      roster={roster}
      initialAttendance={attendance}
      initialEvaluations={evaluations}
      coachNames={coachNames}
      myPresence={myPresence}
      defaultStep={defaultStep}
      briefing={briefing}
      initialWinners={winners}
      musts={components?.items ?? []}
      theme={theme ? { theme: themeFor(theme, cleanCategory(entry.activity.category)) ?? theme.theme, notes: theme.notes } : null}
      sessionBlocks={blocks}
      initialExercises={exercises}
      matchRoster={matchRoster}
      initialMatchDetails={matchDetails}
      initialMatchConvocations={matchConvocations}
      initialMatchLineup={matchLineup}
      initialMatchPlaytime={matchPlaytime}
      initialMatchEvaluations={matchEvaluations}
      videos={videos}
    />
  );
}
