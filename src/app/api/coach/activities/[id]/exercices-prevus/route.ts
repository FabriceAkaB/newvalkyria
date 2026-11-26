import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getPlannedExercises, setPlannedBlocksDone } from "@/lib/planned-exercises-repo";

const todayToronto = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** « Exercices prévus : faits ? » : chaque bloc du plan avec Oui / Non, partagé par tous les éducateurs de la pratique. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  return NextResponse.json(await getPlannedExercises(id));
}

/** Un éducateur répond pour un ou plusieurs blocs : { blockIds: [...], done: true | false }. Modifiable après coup. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (String(entry.activity.activity_date).slice(0, 10) > todayToronto()) return jsonError("On répond le jour de la pratique ou après.", 400);
  const body = (await request.json().catch(() => null)) as { blockIds?: unknown; done?: unknown } | null;
  const blockIds = Array.isArray(body?.blockIds) ? body.blockIds.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (!blockIds.length || typeof body?.done !== "boolean") return jsonError("Paramètres invalides", 400);
  try {
    return NextResponse.json(await setPlannedBlocksDone(id, blockIds, body.done, coachId));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Pas enregistré", 400);
  }
}
