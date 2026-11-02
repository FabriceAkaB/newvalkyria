import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getBlocksForActivity, parseBlockGuide, updateBlock } from "@/lib/session-plan-repo";

/** Pratique du jour (P1.4.08) : montage du terrain, matériel, qui fait quoi, points clés, variantes et
 *  progressions d'un bloc du plan de séance. Préparé par JP dans l'admin, lu par l'éducateur dans son portail. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id, blockId } = await params;
  if (!(await getBlocksForActivity(id)).some((b) => b.id === blockId)) return jsonError("Bloc introuvable", 404);

  const guide = parseBlockGuide((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!Object.keys(guide).length) return jsonError("Rien à enregistrer", 400);
  await updateBlock(blockId, { guide });
  return NextResponse.json({ ok: true, guide });
}
