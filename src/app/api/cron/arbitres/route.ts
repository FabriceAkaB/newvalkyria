import { NextResponse } from "next/server";

import { cronGate } from "@/lib/cron-gate";
import { autoInviteReferees } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Chaque jour : ouvre les postes d'arbitre des matchs vendus et invite les arbitres actifs quand un match des
 *  2 prochaines semaines n'a pas encore ses arbitres. */
export async function GET(request: Request) {
  const gate = await cronGate(request, "arbitres", { adminRoles: ["admin"] });
  if (!gate.ok) return gate.response;
  return NextResponse.json({ ok: true, ...(await autoInviteReferees()) });
}
