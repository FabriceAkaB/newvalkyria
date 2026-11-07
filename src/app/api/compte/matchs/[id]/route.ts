import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { playerUrlFor } from "@/lib/match-videos";
import { getParentUserId } from "@/lib/parent-auth";

export const dynamic = "force-dynamic";

/** Lien signé (4 h) du lecteur d'un match, seulement pour une famille dont la fille est dans l'équipe ou au match. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous à votre espace parent.", 401);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonError("Vidéo introuvable", 404);
  const url = await playerUrlFor(userId, id).catch(() => null);
  if (!url) return jsonError("Cette vidéo n'est pas disponible pour votre compte.", 404);
  return NextResponse.json({ url });
}
