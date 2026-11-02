import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { submitResponse } from "@/lib/surveys-repo";

export const dynamic = "force-dynamic";

/** Réponse d'une famille à un sondage (lien personnel). Une famille peut corriger sa réponse tant que le sondage est ouvert. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return jsonError("Lien invalide", 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.answers !== "object") return jsonError("Réponses manquantes");
  try {
    const r = await submitResponse(token, body.answers as Record<string, unknown>);
    if (!r.ok) return jsonError(r.error, 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Survey submit failed", err);
    return jsonError("Erreur, réessayez dans un instant.", 500);
  }
}
