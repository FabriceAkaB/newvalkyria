import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import type { TournamentAnswer } from "@/lib/tournaments-core";
import { setFamilyResponse } from "@/lib/tournaments-repo";

/** Espace famille : le parent répond pour une de ses filles (Intéressée, Disponible, Pas cette fois). */
const ANSWERS: TournamentAnswer[] = ["interessee", "disponible", "pas_cette_fois"];

export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous à votre espace famille.", 401);
  const b = (await request.json().catch(() => null)) as { slug?: string; firstName?: string; lastName?: string; answer?: string } | null;
  const answer = b?.answer as TournamentAnswer;
  if (!b?.slug || !b.firstName || !ANSWERS.includes(answer)) return jsonError("Réponse incomplète.", 400);
  try {
    const res = await setFamilyResponse(userId, { slug: b.slug, firstName: b.firstName, lastName: b.lastName ?? "", answer });
    if (!res.ok) return jsonError(res.error, 422);
    return NextResponse.json({ ok: true, answer: res.row.response, offerStatus: res.row.offerStatus, token: res.row.token });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
}
