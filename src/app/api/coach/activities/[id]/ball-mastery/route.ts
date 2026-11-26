import { NextResponse } from "next/server";

import { getBallMasteryStatus, setBallMasterySkipped } from "@/lib/ball-mastery-skip-repo";
import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

const todayToronto = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** « Le ball mastery n'a pas été fait » : état de la pratique (partagé par tous ses éducateurs). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  return NextResponse.json(await getBallMasteryStatus(id));
}

/** Un éducateur de la pratique répond Oui / Non dans son rapport : vaut pour tout le monde, modifiable après coup. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (String(entry.activity.activity_date).slice(0, 10) > todayToronto()) return jsonError("On le marque le jour de la pratique ou après.", 400);
  // « Ball mastery fait aujourd'hui ? » : done = Oui / Non.
  const body = (await request.json().catch(() => null)) as { done?: unknown } | null;
  if (typeof body?.done !== "boolean") return jsonError("Paramètres invalides", 400);
  try {
    return NextResponse.json(await setBallMasterySkipped(id, !body.done, coachId));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Pas enregistré", 400);
  }
}
