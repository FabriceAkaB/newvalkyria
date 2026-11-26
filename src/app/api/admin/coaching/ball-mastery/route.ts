import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminCoachId } from "@/lib/admin-my-practices";
import { getBallMasteryStatus, setBallMasterySkipped } from "@/lib/ball-mastery-skip-repo";
import { jsonError } from "@/lib/http";

/** « Ball mastery fait ce jour-là ? » depuis la fiche admin d'une pratique (JP ou la gérante), aussi pour les fois passées. */
export async function GET(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const id = new URL(request.url).searchParams.get("activite");
  if (!id) return jsonError("Pratique introuvable", 400);
  return NextResponse.json(await getBallMasteryStatus(id));
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { activityId?: unknown; done?: unknown } | null;
  if (typeof body?.activityId !== "string" || typeof body.done !== "boolean") return jsonError("Paramètres invalides", 400);
  try {
    return NextResponse.json(await setBallMasterySkipped(body.activityId, !body.done, await getAdminCoachId().catch(() => null)));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Pas enregistré", 400);
  }
}
