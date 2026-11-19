import { NextResponse } from "next/server";

import { syncBounces } from "@/lib/email-bounces";

import { cronGate } from "@/lib/cron-gate";
import { runMcsRobot, sendPresenceReminders, syncMcsAttendance } from "@/lib/mcs-robot-runner";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";
import { sendDueEmails, sendDueMcsPosts } from "@/lib/scheduled-emails";
import { sendJpMonthlyList, sendTeamTaskReminders } from "@/lib/team-tasks-repo";
import { syncVeo } from "@/lib/veo-robot";
import { archiveVideos } from "@/lib/video-archive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Chaque heure : envoie les courriels programmés dont l'heure est passée, relit les calendriers MonClubSportif, fait ce qui manque (joueuses payées dans leurs équipes, photos,
 *  adversaires, présences modifiables en tout temps) puis envoie les rappels de présence dus (48 h, 24 h, le jour même) et les rappels des tâches confiées par JP. */
export async function GET(request: Request) {
  const started = Date.now();
  const gate = await cronGate(request, "mcs-robot", { adminRoles: ["admin"] });
  if (!gate.ok) return gate.response;
  // D'abord les courriels programmés (ex. « prévenir les parents à 8 h ») : ils ne doivent pas attendre le robot.
  const emails = await sendDueEmails().catch((e) => ({ sent: 0, failed: 0, error: e instanceof Error ? e.message : "erreur" }));
  // Puis les publications MonClubSportif programmées (ex. un sondage, un lien personnel par famille).
  const mcsPosts = await sendDueMcsPosts().catch((e) => ({ posted: 0, failed: 0, error: e instanceof Error ? e.message : "erreur" }));
  // Relances des sondages : 2, 5 et 7 jours après l'envoi, aux familles qui n'ont pas répondu (le jour seulement).
  const surveyReminders = await import("@/lib/surveys-repo").then((m) => m.runSurveyReminders()).catch((e) => ({ sent: 0, failed: 0, error: e instanceof Error ? e.message : "erreur" }));
  // Courriels refusés (rebonds dans info@) : rangés pour qu'Aujourd'hui les montre le jour même.
  const bounces = await syncBounces().catch((e) => ({ found: 0, added: 0, error: e instanceof Error ? e.message : "erreur" }));
  const synced = await syncStaleTeams(50, 8000).catch(() => 0);
  const robot = await runMcsRobot({ reason: "cron horaire" }).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : "erreur" }));
  const reminders = await sendPresenceReminders().catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "erreur" }));
  // Le soir (22 h et 23 h) : les présences de la journée, jeunes et entraîneurs, entrent dans le site (bulletin, paie).
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Toronto" }));
  // À partir de 8 h : rappel aux personnes qui ont une tâche de JP (la veille de l'échéance, puis aux 2 jours en retard).
  const tasks = hour >= 8 && hour < 21 ? await sendTeamTaskReminders().catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "erreur" })) : null;
  // Le 1er du mois à partir de 8 h (une seule fois) : la liste du mois à JP, ses tâches et celles qu'il a confiées.
  const month = hour >= 8 ? await sendJpMonthlyList().catch((e) => ({ sent: false, error: e instanceof Error ? e.message : "erreur" })) : null;
  const attendance = hour >= 22 || new URL(request.url).searchParams.has("presences") ? await syncMcsAttendance().catch((e) => ({ error: e instanceof Error ? e.message : "erreur" })) : null;
  // De 8 h à 21 h : les présences du jour indiquées dans MonClubSportif (absentes en X, joueuses ajoutées) entrent dans
  // le site avant la pratique, pour que la borne du sondage de fin n'affiche que les filles attendues.
  const todayPresences = hour >= 8 && hour < 22 ? await syncMcsAttendance({ today: true, pages: 1 }).catch((e) => ({ error: e instanceof Error ? e.message : "erreur" })) : null;
  // Une heure après chaque pratique : rappel aux éducateurs de noter les exercices (thème de la semaine).
  const exerciseRatings = await import("@/lib/exercise-rating-reminder").then((m) => m.remindExerciseRatings()).catch((e) => ({ error: e instanceof Error ? e.message : "erreur" }));
  // De 8 h à 21 h : absences annoncées à l'avancé (pratiques de semaine) → filles de l'intermédiaire proposées à JP ;
  // les « oui » des parents sont ajoutés à la pratique dans MonClubSportif.
  const practiceInvites = hour >= 8 && hour < 22 ? await import("@/lib/practice-invites-repo").then((m) => m.runPracticeInvites()).catch((e) => ({ error: e instanceof Error ? e.message : "erreur" })) : null;
  // Toutes les heures : les enregistrements Veo « Newval … » prêts sont rangés (match → familles, pratique → éducateurs) ;
  // un match que Veo prépare encore est repris à l'heure suivante, jusqu'à ce qu'il soit disponible.
  const veo = await syncVeo().then((r) => ({ ok: r.ok, skipped: r.skipped, rangees: r.results.filter((x) => x.outcome === "rangee").length })).catch((e) => ({ error: e instanceof Error ? e.message : "erreur" }));
  // Puis, avec le temps qui reste : les vidéos sont téléchargées pour que l'académie les garde (Veo les efface après
  // environ un an). Un fichier commencé reprend à l'heure suivante, là où il s'était arrêté.
  const archive = await archiveVideos({ deadline: started + (maxDuration - 20) * 1000 })
    .then((r) => ({ done: r.done.length, progress: r.progress, errors: r.errors.map((e) => e.error) }))
    .catch((e) => ({ error: e instanceof Error ? e.message : "erreur" }));
  return NextResponse.json({ ok: true, emails, mcsPosts, surveyReminders, todayPresences, practiceInvites, exerciseRatings, bounces, synced, robot, reminders, tasks, month, attendance, veo, archive });
}
