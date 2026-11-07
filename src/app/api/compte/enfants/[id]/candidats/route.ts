import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getPlayerCandidatesForEmail, getVerifiedParentEmail } from "@/lib/parent-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const children = await getChildrenForParent(userId);
  const child = children.find((c) => c.id === id);
  if (!child) return jsonError("Profil introuvable", 404);

  // Courriel pas encore confirmé : rien n'est montré (n'importe qui pourrait avoir tapé le courriel d'un parent).
  const email = await getVerifiedParentEmail(userId);
  if (!email) return NextResponse.json({ candidates: [], needsEmailCheck: true });

  const candidates = await getPlayerCandidatesForEmail(email);
  return NextResponse.json({ candidates });
}
