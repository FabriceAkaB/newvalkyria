import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations } from "@/lib/parent-repo";
import { requestReward } from "@/lib/player-points-repo";

/** Espace famille : demander une récompense avec les points de sa fille (seulement une fille de cette famille). */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous d'abord.", 401);
  const b = (await request.json().catch(() => null)) as { registrationId?: string; rewardId?: string } | null;
  if (typeof b?.registrationId !== "string" || typeof b?.rewardId !== "string") return jsonError("Paramètres invalides", 400);
  const family = await getFamilyRegistrations(userId);
  if (!family.some((f) => f.registrationId === b.registrationId)) return jsonError("Cette joueuse n'est pas reliée à votre compte.", 403);
  const problem = await requestReward({ registrationId: b.registrationId, rewardId: b.rewardId, by: "famille" });
  if (problem) return jsonError(problem, 422);
  return NextResponse.json({ ok: true });
}
