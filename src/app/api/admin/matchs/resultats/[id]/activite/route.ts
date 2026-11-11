import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { createActivityForSlot } from "@/lib/match-results";

export const dynamic = "force-dynamic";

const schema = z.object({ categoryId: z.string().trim().max(40).nullable() });

/** POST : plage vendue sans activité → crée l'activité « Match » reliée (convocations, alignement,
 *  chronomètre et évaluations d'après-match se font ensuite dans l'activité). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choisis la catégorie de l'équipe.", 400);
  try {
    const out = await createActivityForSlot(id, parsed.data.categoryId || null);
    if (out.outcome !== "existing") {
      await logAudit({
        actorRole: role,
        actorLabel: role,
        action: out.outcome === "created" ? "match_activity_created" : "match_activity_linked",
        entityType: "coach_activities",
        entityId: out.activityId,
        after: { matchSlotId: id, categoryId: parsed.data.categoryId }
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}
