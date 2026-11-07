import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivities } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { coachPlayerUrl } from "@/lib/match-videos";

export const dynamic = "force-dynamic";

/** Lecteur d'une pratique (ou d'un match) filmée, seulement pour un éducateur assigné à cette activité. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Connectez-vous au portail des éducateurs.", 401);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError("Vidéo introuvable", 404);
  const mine = (await getCoachActivities(coachId)).map((a) => a.activity.id);
  const url = await coachPlayerUrl(id, mine).catch(() => null);
  if (!url) return jsonError("Cette vidéo n'est pas disponible pour toi.", 404);
  return NextResponse.json({ url });
}
