import { NextResponse } from "next/server";

import { cronGate } from "@/lib/cron-gate";
import { applyReschedule } from "@/lib/mandalart-repo";

export const dynamic = "force-dynamic";

/** Report automatique des tâches du Mandalart (Vercel Cron, chaque matin vers 4 h-5 h à Montréal) : une tâche pas
 *  faite à sa date passe au lendemain, la suite de son objectif est réorganisée, les tâches à date fixe ne bougent pas. */
export async function GET(request: Request) {
  const gate = await cronGate(request, "mandalart-report", { adminRoles: ["admin"] });
  if (!gate.ok) return gate.response;
  const changes = await applyReschedule();
  return NextResponse.json({ ok: true, moved: changes.length, late: changes.filter((c) => c.reason === "retard").length, changes });
}
