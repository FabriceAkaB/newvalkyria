import { NextResponse } from "next/server";

import { showGoogleButton } from "@/lib/bulletin-gate";
import { getGoogleReviewUrl, getParentGate, markGateGoogleClick, syncGoogleLinkTask } from "@/lib/bulletin-gate-repo";
import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { submitResponse } from "@/lib/surveys-repo";

/** Espace famille : le sondage avant le bulletin (P4.8.18) et le clic « Laisser cet avis sur Google » (P3.8.19).
 *  Le parent connecté répond pour sa propre invitation seulement (retrouvée par son compte, jamais par un jeton envoyé). */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous d'abord.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const period = body?.period === "mi-saison" || body?.period === "fin-saison" ? body.period : null;
  if (!period) return jsonError("Bulletin introuvable.", 400);
  const gate = await getParentGate(userId, period);
  if (!gate) return jsonError("Aucune joueuse reliée à votre compte.", 403);

  if (body?.action === "repondre") {
    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? (body.answers as Record<string, unknown>) : {};
    const result = await submitResponse(gate.invite.token, answers);
    if (!result.ok) return jsonError(result.error, 400);
    const rq = gate.survey.questions.find((q) => q.role === "recommandation");
    const score = rq && typeof answers[rq.id] !== "undefined" ? Number(answers[rq.id]) : null;
    const url = await getGoogleReviewUrl();
    // 9 ou 10 sans lien Google : JP reçoit la tâche d'ajouter le lien (le bouton reste caché d'ici là).
    if (score !== null && score >= 9 && !url) await syncGoogleLinkTask().catch(() => undefined);
    return NextResponse.json({ ok: true, showGoogle: showGoogleButton(score, url) });
  }

  if (body?.action === "google") {
    if (!gate.response) return jsonError("Répondez d'abord au sondage.", 400);
    await markGateGoogleClick(gate.response.id, gate.email);
    return NextResponse.json({ ok: true });
  }
  return jsonError("Action inconnue", 400);
}
