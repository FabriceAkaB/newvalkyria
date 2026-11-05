import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { runMcsRobot, sendPresenceReminders } from "@/lib/mcs-robot-runner";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";
import { sendDueEmails } from "@/lib/scheduled-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Chaque heure : envoie les courriels programmés dont l'heure est passée, relit les calendriers MonClubSportif, fait ce qui manque (joueuses payées dans leurs équipes, photos,
 *  adversaires, présences modifiables en tout temps) puis envoie les rappels de présence dus (48 h, 24 h, le jour même). */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  // D'abord les courriels programmés (ex. « prévenir les parents à 8 h ») : ils ne doivent pas attendre le robot.
  const emails = await sendDueEmails().catch((e) => ({ sent: 0, failed: 0, error: e instanceof Error ? e.message : "erreur" }));
  const synced = await syncStaleTeams(50, 8000).catch(() => 0);
  const robot = await runMcsRobot({ reason: "cron horaire" }).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : "erreur" }));
  const reminders = await sendPresenceReminders().catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "erreur" }));
  return NextResponse.json({ ok: true, emails, synced, robot, reminders });
}
