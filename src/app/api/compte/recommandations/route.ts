import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getParentAccount } from "@/lib/parent-repo";
import { getAllPrivatePrograms } from "@/lib/private-programs-repo";
import { chooseReferralReward, getLedgerForFamily, getReferrerSummary } from "@/lib/referrals-repo";

/** « Mes recommandations » — code personnel, liens à partager, compteurs,
 *  récompenses à choisir et solde de crédit de la famille connectée. */
export async function GET() {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non connecté", 401);
  const account = await getParentAccount(userId);
  if (!account?.email) return jsonError("Compte introuvable", 404);

  const [summary, programs, ledger] = await Promise.all([
    getReferrerSummary(account.email, account.fullName),
    getAllPrivatePrograms(),
    getLedgerForFamily(account.email)
  ]);

  return NextResponse.json({
    summary,
    ledger: ledger.slice(0, 20).map((e) => ({ id: e.id, deltaCents: e.delta_cents, kind: e.kind, note: e.note, createdAt: e.created_at })),
    origin: env.publicSiteUrl,
    programs: programs
      .filter((p) => p.active && p.published)
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        shortName: `${p.gender === "filles" ? "Filles" : p.gender === "mixte" ? "Joueurs" : "Garçons"} ${p.birth_years.replace("-", "–")}`,
        priceCents: p.price_cents,
        practices: p.practices_count ?? 16,
        matches: p.matches_count ?? 3,
        capacity: p.max_capacity,
        minCapacity: p.min_capacity,
        feeCents: p.installment_fee_cents,
        referralDiscountCents: p.referral_discount_cents
      }))
  });
}

export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non connecté", 401);
  const account = await getParentAccount(userId);
  if (!account?.email) return jsonError("Compte introuvable", 404);

  const body = (await request.json().catch(() => null)) as { referralId?: string; choice?: "sac" | "credit" } | null;
  if (!body?.referralId || (body.choice !== "sac" && body.choice !== "credit")) return jsonError("Choix invalide", 400);

  const result = await chooseReferralReward(body.referralId, account.email, body.choice);
  if (!result.ok) return jsonError(result.error, 409);
  return NextResponse.json({ ok: true });
}
