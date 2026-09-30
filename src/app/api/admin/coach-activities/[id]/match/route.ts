import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getMatchDetails, updateMatchScore, updateMatchStatus, upsertMatchDetails, type MatchStatus } from "@/lib/match-repo";

const VALID_STATUSES: readonly string[] = ["scheduled", "live", "completed", "cancelled"] satisfies readonly MatchStatus[];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const details = await getMatchDetails(id);
  return NextResponse.json({ details });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

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
