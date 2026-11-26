import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminCoachId } from "@/lib/admin-my-practices";
import { jsonError } from "@/lib/http";
import { getPlannedExercises, setPlannedBlocksDone } from "@/lib/planned-exercises-repo";

const UUID = /^[0-9a-f-]{36}$/i;

/** « Exercices prévus : faits ? » depuis la fiche admin d'une pratique (JP ou la gérante), aussi pour les fois passées. */
export async function GET(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const id = new URL(request.url).searchParams.get("activite");
  if (!id || !UUID.test(id)) return jsonError("Pratique introuvable", 400);
  return NextResponse.json(await getPlannedExercises(id));
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { activityId?: unknown; blockIds?: unknown; done?: unknown } | null;
  const blockIds = Array.isArray(body?.blockIds) ? body.blockIds.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [];
  if (typeof body?.activityId !== "string" || !UUID.test(body.activityId) || !blockIds.length || typeof body.done !== "boolean") return jsonError("Paramètres invalides", 400);
  try {
    return NextResponse.json(await setPlannedBlocksDone(body.activityId, blockIds, body.done, await getAdminCoachId().catch(() => null)));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Pas enregistré", 400);
  }
}
