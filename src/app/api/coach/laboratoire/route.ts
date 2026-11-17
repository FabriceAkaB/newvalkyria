import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { createExperiment, listExperiments, practicesForTrial } from "@/lib/coach-lab-repo";
import { jsonError } from "@/lib/http";

/** Laboratoire des éducateurs : la liste des expériences (partagée par toute l'équipe) et une nouvelle expérience. */
export async function GET() {
  if (!(await getCurrentCoachId())) return jsonError("Non autorisé", 401);
  const [experiments, practices] = await Promise.all([listExperiments(), practicesForTrial()]);
  return NextResponse.json({ experiments, practices });
}

export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const id = await createExperiment(coachId, body ?? {});
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Erreur", 422);
  }
}
