import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { autoInviteReferees } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Chaque jour : ouvre les postes d'arbitre des matchs vendus et invite les arbitres actifs quand un match des
 *  2 prochaines semaines n'a pas encore ses arbitres. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  return NextResponse.json({ ok: true, ...(await autoInviteReferees()) });
}
