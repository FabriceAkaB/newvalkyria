import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations, getParentAccount } from "@/lib/parent-repo";
import { savePlayerSheet } from "@/lib/player-sheet-repo";

/** Fiche joueuse (P4.1.03) : le parent l'enregistre pour une fille de sa famille seulement. */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous à votre espace famille.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body?.registrationId !== "string") return jsonError("Paramètres invalides", 400);
  const [family, account] = await Promise.all([getFamilyRegistrations(userId), getParentAccount(userId)]);
  const girl = family.find((f) => f.registrationId === body.registrationId);
  if (!girl) return jsonError("Cette joueuse n'est pas reliée à votre compte.", 403);
  try {
    const problem = await savePlayerSheet({ registrationId: girl.registrationId, playerId: girl.playerId, userId, parentName: account?.fullName ?? null, answers: body });
    if (problem) return jsonError(problem, 422);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
  return NextResponse.json({ ok: true });
}
