import { NextResponse } from "next/server";

import { cronGate } from "@/lib/cron-gate";
import { auditMcsAccess } from "@/lib/mcs-robot-runner";
import { syncStaleTeams } from "@/lib/mcs-teams-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Chaque matin : relit le calendrier MonClubSportif de chaque équipe, puis vérifie les accès (seules les personnes
 *  permises sont gestionnaires d'équipe ; le personnel est rangé dans « Autre personnel ») et corrige ce qui dépasse. */
export async function GET(request: Request) {
  const gate = await cronGate(request, "mcs-sync", { adminRoles: ["admin"] });
  if (!gate.ok) return gate.response;
  const synced = await syncStaleTeams(0, 10_000);
  const access = await auditMcsAccess().catch((e) => ({ fixed: [], error: e instanceof Error ? e.message : "erreur" }));
  return NextResponse.json({ ok: true, synced, access });
}
