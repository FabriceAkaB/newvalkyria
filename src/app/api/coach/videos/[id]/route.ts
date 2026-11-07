import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivities } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { playerDataForCoach } from "@/lib/match-videos";

export const dynamic = "force-dynamic";

/** Le lecteur d'une pratique (ou d'un match) filmée, seulement pour un éducateur assigné à cette activité. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Connectez-vous au portail des éducateurs.", 401);
  const { id } = await params;
  const mine = (await getCoachActivities(coachId)).map((a) => a.activity.id);
  const data = await playerDataForCoach(id, mine).catch(() => null);
  if (!data) return jsonError("Cette vidéo n'est pas disponible pour toi.", 404);
  return NextResponse.json(data);
}
