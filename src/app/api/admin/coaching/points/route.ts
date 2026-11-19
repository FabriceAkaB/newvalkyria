import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { REWARD_KINDS, type RewardKind } from "@/lib/player-points";
import { requestReward, saveReward, saveRules, setChampionPostHidden, setRedemptionStatus } from "@/lib/player-points-repo";

/** Points des joueuses (admin) : remettre une récompense, traiter une demande, retirer une publication du fil
 *  (admin et gérante) ; barème et catalogue (admin seulement). */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (b?.action === "redeem") {
    if (typeof b.registrationId !== "string" || typeof b.rewardId !== "string") return jsonError("Paramètres invalides", 400);
    const problem = await requestReward({ registrationId: b.registrationId, rewardId: b.rewardId, by: "admin", deliverNow: true });
    if (problem) return jsonError(problem, 422);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "redemption") {
    if (typeof b.id !== "string" || (b.status !== "remise" && b.status !== "annulee")) return jsonError("Paramètres invalides", 400);
    await setRedemptionStatus(b.id, b.status);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "hide-post") {
    if (typeof b.id !== "string") return jsonError("Paramètres invalides", 400);
    await setChampionPostHidden(b.id, b.hidden === true);
    return NextResponse.json({ ok: true });
  }
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Seul l'admin change le barème et les récompenses.", 403);
  if (b?.action === "rules") {
    if (!b.rules || typeof b.rules !== "object") return jsonError("Paramètres invalides", 400);
    return NextResponse.json({ ok: true, rules: await saveRules(b.rules as Record<string, number>) });
  }
  if (b?.action === "reward") {
    const cost = Number(b.cost);
    const kind = (typeof b.kind === "string" && b.kind in REWARD_KINDS ? b.kind : "cadeau") as RewardKind;
    const valueCents = b.valueCents === null || b.valueCents === undefined ? null : Math.round(Number(b.valueCents));
    if (typeof b.name !== "string" || !b.name.trim() || !Number.isFinite(cost) || cost <= 0) return jsonError("Donne un nom et un prix en points.", 422);
    if (kind !== "cadeau" && !(valueCents && valueCents > 0)) return jsonError("Donne la valeur en dollars du rabais ou du crédit.", 422);
    await saveReward({
      id: typeof b.id === "string" ? b.id : undefined,
      name: b.name,
      cost,
      kind,
      valueCents,
      description: typeof b.description === "string" ? b.description : null,
      isDefault: b.isDefault === true && kind === "cadeau",
      productId: typeof b.productId === "string" && b.productId ? b.productId : null,
      active: b.active !== false,
      stock: b.stock === null || b.stock === undefined || b.stock === "" ? null : Math.round(Number(b.stock)) || null
    });
    return NextResponse.json({ ok: true });
  }
  return jsonError("Paramètres invalides", 400);
}
