import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { runMcsRobot, sendPresenceReminders } from "@/lib/mcs-robot-runner";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Chaque heure : relit les calendriers MonClubSportif, fait ce qui manque (joueuses payées dans leurs équipes, photos,
 *  adversaires, présences modifiables en tout temps) puis envoie les rappels de présence dus (48 h, 24 h, le jour même). */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const synced = await syncStaleTeams(50, 8000).catch(() => 0);
  const robot = await runMcsRobot({ reason: "cron horaire" }).catch((e) => ({ ok: false, error: e instanceof Error ? e.message : "erreur" }));
  const reminders = await sendPresenceReminders().catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "erreur" }));
  return NextResponse.json({ ok: true, synced, robot, reminders });
}
