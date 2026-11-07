import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { confirmParentEmailCheck, sendParentEmailCheck } from "@/lib/parent-repo";

/** Lien du courriel de confirmation : le courriel du compte parent est confirmé, retour à l'espace parent. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const userId = await confirmParentEmailCheck(token);
  return NextResponse.redirect(`${env.publicSiteUrl}/compte/espace?courriel=${userId ? "confirme" : "invalide"}`, 303);
}

/** Renvoyer le lien de confirmation au parent connecté. */
export async function POST() {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const r = await sendParentEmailCheck(userId);
  return NextResponse.json({ ok: true, sent: r.sent, email: r.email });
}
