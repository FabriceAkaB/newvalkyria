import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { applyReschedule } from "@/lib/mandalart-repo";

export const dynamic = "force-dynamic";

/** Report automatique des tâches du Mandalart (Vercel Cron, chaque matin vers 4 h-5 h à Montréal) : une tâche pas
 *  faite à sa date passe au lendemain, la suite de son objectif est réorganisée, les tâches à date fixe ne bougent pas. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const changes = await applyReschedule();
  return NextResponse.json({ ok: true, moved: changes.length, late: changes.filter((c) => c.reason === "retard").length, changes });
}
