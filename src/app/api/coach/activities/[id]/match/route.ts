import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getMatchDetails, updateMatchScore, updateMatchStatus, upsertMatchDetails, type MatchStatus } from "@/lib/match-repo";

const VALID_STATUSES: readonly string[] = ["scheduled", "live", "completed", "cancelled"] satisfies readonly MatchStatus[];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);
  const details = await getMatchDetails(id);
  return NextResponse.json({ details });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);

  const body = (await request.json().catch(() => null)) as {
    opponentName?: string;
    homeAway?: "home" | "away";
    formation?: string | null;
    status?: string;
    finalScoreUs?: number | null;
    finalScoreThem?: number | null;
  } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  if (body.opponentName !== undefined) {
    if (!body.opponentName.trim()) return jsonError("Nom de l'adversaire requis", 400);
    await upsertMatchDetails(id, { opponentName: body.opponentName.trim(), homeAway: body.homeAway ?? "home", formation: body.formation ?? null });
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) return jsonError("Statut invalide", 400);
    await updateMatchStatus(id, body.status as MatchStatus);
  }
  if (body.finalScoreUs !== undefined || body.finalScoreThem !== undefined) {
    await updateMatchScore(id, body.finalScoreUs ?? null, body.finalScoreThem ?? null);
  }

  return NextResponse.json({ ok: true });
}
