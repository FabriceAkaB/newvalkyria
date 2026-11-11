import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { isValidLogoInput, parseVideoLink } from "@/lib/match-results-core";
import { saveMatchSheet } from "@/lib/match-results";

export const dynamic = "force-dynamic";

const score = z.number().int().min(0).max(99).nullable();
const schema = z
  .object({
    scoreUs: score,
    scoreThem: score,
    cancelled: z.boolean(),
    opponentName: z.string().max(120),
    homeAway: z.enum(["home", "away"]),
    opponentLogo: z.string().max(500).refine(isValidLogoInput, "Logo : collez l'adresse https d'une image ou un emoji."),
    summary: z.string().max(5000),
    analysis: z.object({ strengths: z.string().max(4000), fixes: z.string().max(4000), actions: z.string().max(4000) }),
    videoUrl: z
      .string()
      .max(500)
      .refine((v) => !v.trim() || parseVideoLink(v) !== null, "Lien vidéo invalide (adresse https://…).")
  })
  .refine((v) => (v.scoreUs === null) === (v.scoreThem === null), "Entrez les deux scores, ou aucun.");

/** Enregistre la fiche d'un match : score, résumé, analyse, lien vidéo, adversaire et son logo. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Données invalides", 400);
  try {
    const card = await saveMatchSheet(id, parsed.data);
    await logAudit({
      actorRole: role,
      actorLabel: role,
      action: "match_sheet_saved",
      entityType: card.activityId ? "match_details" : "match_slot_results",
      entityId: card.activityId ?? card.slotId ?? id,
      entityLabel: `${card.ourName} vs ${card.opponent ?? "adversaire"} (${card.date})`,
      after: { status: card.status, scoreUs: card.scoreUs, scoreThem: card.scoreThem }
    }).catch(() => null);
    return NextResponse.json({ ok: true, status: card.status });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}
