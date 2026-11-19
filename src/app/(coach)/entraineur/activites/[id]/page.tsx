import Link from "next/link";
import { notFound } from "next/navigation";

import { CoachTopbar } from "@/components/coach-topbar";
import { isMethodOpen, opensOn } from "@/lib/coach-access-core";

import { CoachActiviteDetail } from "@/components/coach-activite-detail";
import { getComponents } from "@/lib/coaching-method-repo";
import { requireCoach } from "@/lib/coach-auth";
import { cleanCategory, getActivityAttendance, getActivityEvaluations, getActivityRoster, getBriefing, getCoachActivityAccess, getPracticeReadItems } from "@/lib/coach-portal-repo";
import { defaultStepFor } from "@/lib/coach-report";
import { getCoach } from "@/lib/coaches-repo";
import { getActivityChampions, getRules } from "@/lib/player-points-repo";
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

  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) notFound();

  const isMatch = entry.activity.activity_type === "Match";
  const activityDate = String(entry.activity.activity_date).slice(0, 10);

  // La méthode ne s'ouvre que semaine par semaine (JP, 17 nov. 2026) : plus loin, l'heure et le lieu seulement.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  if (!isMethodOpen(entry.activity, today)) {
    const coach = await getCoach(coachId);
    const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    return (
      <>
        <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
        <div className="admin-content">
          <div className="admin-section coach-page">
            <Link href="/entraineur" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>← Mes pratiques</Link>
            <p className="coach-eyebrow">{fr(activityDate)} · {String(entry.activity.start_time).slice(0, 5).replace(":", " h ")} à {String(entry.activity.end_time).slice(0, 5).replace(":", " h ")}</p>
            <h1 className="coach-title">{entry.activity.title || entry.activity.category || "Pratique"}</h1>
            {entry.activity.location ? <p className="coach-sub">{entry.activity.location}</p> : null}
            <div className="coach-card" style={{ marginTop: 20 }}>
              <p className="coach-card__label">🔒 Le plan s&apos;ouvre le {fr(opensOn(activityDate))}</p>
              <p className="coach-sub" style={{ marginTop: 0 }}>
                La méthode Valkyria s&apos;ouvre semaine par semaine : les diapos, les exercices et le guide de cette pratique seront ici dès le samedi qui la précède. Tu as tout le temps de la lire avant.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

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

  const [briefing, champions, pointsRules, components, videos, readItems] = await Promise.all([
    getBriefing(entry.activity, roster).catch(() => []),
    getActivityChampions(id).catch(() => []),
    getRules(),
    getComponents().catch(() => null),
    videosForActivity(id).catch(() => []),
    getPracticeReadItems([id]).then((m) => m.get(id) ?? []).catch(() => [])
  ]);

  // Accès limité : la présence de l'éducateur sans son taux ni les champs de paiement.
  // Accès d'équipe (pratique de l'Académie sans y être assignée) : pas de présence ni de paie ici.
  const { assignment } = entry;
  const myPresence = assignment
    ? {
        status: assignment.status,
        confirmed: assignment.confirmed,
        arrivalTime: assignment.arrival_time ? String(assignment.arrival_time).slice(0, 5) : null,
        departureTime: assignment.departure_time ? String(assignment.departure_time).slice(0, 5) : null,
        locked: assignment.paid
      }
    : null;
  // Étape ouverte par défaut selon l'heure (Montréal) : avant, pendant ou après l'activité.
  const defaultStep = defaultStepFor(activityDate, String(entry.activity.start_time).slice(0, 5), String(entry.activity.end_time).slice(0, 5));
  const coachNames: Record<string, string> = Object.fromEntries([
    [coachId, coach?.first_name ?? "Moi"],
    ...entry.otherCoaches.map((c) => [c.id, c.first_name] as [string, string])
  ]);

  return (
    <CoachActiviteDetail
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      coachRole={coach?.role ?? null}
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
      initialChampions={champions}
      pointsRules={pointsRules}
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
      readItems={readItems}
      initialReadSeen={(assignment?.practice_read_items ?? []) as string[]}
      initialReadAt={assignment?.practice_read_at ?? null}
    />
  );
}
