import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getPlayerCandidatesForEmail, getParentAccount, linkChildToPlayer, unlinkChildFromPlayer } from "@/lib/parent-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { playerId?: string } | null;
  if (!body?.playerId) return jsonError("playerId requis", 400);

  const children = await getChildrenForParent(userId);
  if (!children.some((c) => c.id === id)) return jsonError("Profil introuvable", 404);

  // Le joueur choisi doit vraiment provenir d'une inscription de ce compte —
  // jamais faire confiance à un playerId envoyé tel quel par le client.
  const account = await getParentAccount(userId);
  const candidates = account?.email ? await getPlayerCandidatesForEmail(account.email) : [];
  if (!candidates.some((c) => c.playerId === body.playerId)) {
    return jsonError("Cette joueuse ne correspond à aucune inscription de votre compte", 403);
  }

  try {
    await linkChildToPlayer(id, userId, body.playerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await unlinkChildFromPlayer(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
