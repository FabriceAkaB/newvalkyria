import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { parseIdea } from "@/lib/idea-box-core";
import { addIdea } from "@/lib/idea-box-repo";
import { getParentUserId } from "@/lib/parent-auth";
import { getParentAccount } from "@/lib/parent-repo";

export const dynamic = "force-dynamic";

/** Une idée pour l'académie : du site public (nom et courriel facultatifs) ou de l'espace parent (rattachée au compte). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Idée manquante", 400);
  const idea = parseIdea(body);
  if (idea === "robot") return NextResponse.json({ ok: true });
  if (typeof idea === "string") return jsonError(idea, 400);
  try {
    const userId = await getParentUserId();
    const account = userId ? await getParentAccount(userId) : null;
    await addIdea({
      ...idea,
      authorName: idea.authorName ?? account?.fullName ?? null,
      authorEmail: idea.authorEmail ?? account?.email?.toLowerCase() ?? null,
      source: userId ? "espace" : "site",
      parentUserId: userId
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Idea submit failed", err);
    return jsonError("Erreur, réessayez dans un instant.", 500);
  }
}
