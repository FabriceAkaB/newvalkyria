import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Relit chaque matin le calendrier MonClubSportif de chaque équipe (les pages de l'admin et de vente le relisent aussi
 *  toutes les 15 minutes quand on les ouvre). */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const synced = await syncStaleTeams(0, 10_000);
  return NextResponse.json({ ok: true, synced });
}
