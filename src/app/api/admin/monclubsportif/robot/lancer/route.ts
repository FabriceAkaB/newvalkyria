import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { runMcsRobot } from "@/lib/mcs-robot-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Lance le robot MonClubSportif depuis l'admin : en essai (ce qu'il ferait, rien n'est touché) ou pour vrai. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { dryRun?: boolean } | null;
  const report = await runMcsRobot({ reason: body?.dryRun === false ? "lancé par l'admin" : "essai depuis l'admin", dryRun: body?.dryRun !== false });
  return NextResponse.json(report);
}
