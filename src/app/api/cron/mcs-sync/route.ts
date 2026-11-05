import { NextResponse } from "next/server";

import { cronGate } from "@/lib/cron-gate";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Relit chaque matin le calendrier MonClubSportif de chaque équipe (les pages de l'admin et de vente le relisent aussi
 *  toutes les 15 minutes quand on les ouvre). */
export async function GET(request: Request) {
  const gate = await cronGate(request, "mcs-sync", { adminRoles: ["admin"] });
  if (!gate.ok) return gate.response;
  const synced = await syncStaleTeams(0, 10_000);
  return NextResponse.json({ ok: true, synced });
}
