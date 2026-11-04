import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { cleanDeckUrl } from "@/lib/practice-history";
import { depositPractice } from "@/lib/practice-history-repo";

/** Dépôt d'une pratique passée : lien des diapos et analyse d'après pratique. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { key?: string; deckUrl?: unknown; analysis?: unknown } | null;
  if (!body?.key) return jsonError("Paramètres invalides", 400);
  const deckUrl = body.deckUrl === undefined ? undefined : cleanDeckUrl(body.deckUrl);
  if (deckUrl === undefined && body.deckUrl !== undefined) return jsonError("Le lien des diapos doit commencer par https://", 400);
  const analysis = body.analysis === undefined ? undefined : String(body.analysis).trim().slice(0, 5000) || null;
  const id = await depositPractice({ key: body.key, deckUrl, analysis });
  if (!id) return jsonError("Pratique introuvable dans l'horaire de la saison.", 404);
  return NextResponse.json({ ok: true, activityId: id });
}
