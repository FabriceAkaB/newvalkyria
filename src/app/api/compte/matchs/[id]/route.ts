import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { playerDataForParent } from "@/lib/match-videos";
import { getParentUserId } from "@/lib/parent-auth";

export const dynamic = "force-dynamic";

/** Le lecteur d'un match (lien Veo, périodes, temps forts), seulement pour une famille dont la fille est dans l'équipe
 *  ou était au match. Chaque ouverture est notée. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous à votre espace parent.", 401);
  const { id } = await params;
  const data = await playerDataForParent(userId, id).catch(() => null);
  if (!data) return jsonError("Cette vidéo n'est pas disponible pour votre compte.", 404);
  return NextResponse.json(data);
}
