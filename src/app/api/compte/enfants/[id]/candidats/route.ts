import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount, getPlayerCandidatesForEmail } from "@/lib/parent-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const children = await getChildrenForParent(userId);
  const child = children.find((c) => c.id === id);
  if (!child) return jsonError("Profil introuvable", 404);

  const account = await getParentAccount(userId);
  if (!account?.email) return NextResponse.json({ candidates: [] });

  const candidates = await getPlayerCandidatesForEmail(account.email);
  return NextResponse.json({ candidates });
}
