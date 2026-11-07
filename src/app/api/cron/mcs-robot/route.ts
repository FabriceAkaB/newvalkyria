import { NextResponse } from "next/server";

import { syncBounces } from "@/lib/email-bounces";

import { cronGate } from "@/lib/cron-gate";
import { runMcsRobot, sendPresenceReminders, syncMcsAttendance } from "@/lib/mcs-robot-runner";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";
import { sendDueEmails } from "@/lib/scheduled-emails";
import { sendTeamTaskReminders } from "@/lib/team-tasks-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Chaque heure : envoie les courriels programmés dont l'heure est passée, relit les calendriers MonClubSportif, fait ce qui manque (joueuses payées dans leurs équipes, photos,
 *  adversaires, présences modifiables en tout temps) puis envoie les rappels de présence dus (48 h, 24 h, le jour même) et les rappels des tâches confiées par JP. */
export async function GET(request: Request) {
  const gate = await cronGate(request, "mcs-robot", { adminRoles: ["admin"] });
  if (!gate.ok) return gate.response;
  // D'abord les courriels programmés (ex. « prévenir les parents à 8 h ») : ils ne doivent pas attendre le robot.
  const emails = await sendDueEmails().catch((e) => ({ sent: 0, failed: 0, error: e instanceof Error ? e.message : "erreur" }));
  // Courriels refusés (rebonds dans info@) : rangés pour qu'Aujourd'hui les montre le jour même.
  const bounces = await syncBounces().catch((e) => ({ found: 0, added: 0, error: e instanceof Error ? e.message : "erreur" }));
  const synced = await syncStaleTeams(50, 8000).catch(() => 0);
  const robot = await runMcsRobot({ reason: "cron horaire" }).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : "erreur" }));
  const reminders = await sendPresenceReminders().catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "erreur" }));
  // Le soir (22 h et 23 h) : les présences de la journée, jeunes et entraîneurs, entrent dans le site (bulletin, paie).
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Toronto" }));
  // À partir de 8 h : rappel aux personnes qui ont une tâche de JP (la veille de l'échéance, puis aux 2 jours en retard).
  const tasks = hour >= 8 && hour < 21 ? await sendTeamTaskReminders().catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "erreur" })) : null;
  const attendance = hour >= 22 || new URL(request.url).searchParams.has("presences") ? await syncMcsAttendance().catch((e) => ({ error: e instanceof Error ? e.message : "erreur" })) : null;
  return NextResponse.json({ ok: true, emails, bounces, synced, robot, reminders, tasks, attendance });
}
