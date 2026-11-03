import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { redeemReward, saveReward } from "@/lib/player-points-repo";

/** Récompenses (catalogue) et échange des points d'une joueuse. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (b?.action === "redeem") {
    if (typeof b.registrationId !== "string" || typeof b.rewardId !== "string") return jsonError("Paramètres invalides", 400);
    const problem = await redeemReward(b.registrationId, b.rewardId);
    if (problem) return jsonError(problem, 422);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "reward") {
    if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
    const cost = Number(b.cost);
    if (typeof b.name !== "string" || !b.name.trim() || !Number.isFinite(cost) || cost <= 0) return jsonError("Donne un nom et un coût en points.", 422);
    await saveReward({ id: typeof b.id === "string" ? b.id : undefined, name: b.name, cost, productId: typeof b.productId === "string" && b.productId ? b.productId : null, active: b.active !== false });
    return NextResponse.json({ ok: true });
  }
  return jsonError("Paramètres invalides", 400);
}
