import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { applyGuideEverywhere } from "@/lib/exercises-repo";
import { getBlocksForActivity, parseBlockGuide, updateBlock } from "@/lib/session-plan-repo";

/** Pratique du jour (P1.4.08) : montage du terrain, matériel, qui fait quoi, points clés, variantes et
 *  progressions d'un bloc du plan de séance. Préparé par JP dans l'admin, lu par l'éducateur dans son portail. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id, blockId } = await params;
  const block = (await getBlocksForActivity(id)).find((b) => b.id === blockId);
  if (!block) return jsonError("Bloc introuvable", 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const guide = parseBlockGuide(body);
  if (!Object.keys(guide).length) return jsonError("Rien à enregistrer", 400);
  // « Appliquer partout » : la fiche de la banque et toutes les pratiques à venir qui utilisent cet exercice.
  if (body?.everywhere === true && block.exercise_id) {
    const { blocks } = await applyGuideEverywhere(block.exercise_id, guide);
    return NextResponse.json({ ok: true, guide, everywhere: blocks });
  }
  await updateBlock(blockId, { guide });
  return NextResponse.json({ ok: true, guide });
}
