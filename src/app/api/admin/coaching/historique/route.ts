import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { cleanDeckUrl, cleanScore } from "@/lib/practice-history";
import { depositPractice } from "@/lib/practice-history-repo";

/** Dépôt d'une pratique passée : lien des diapos, analyse d'après pratique et note de pertinence au thème (sur 10). */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { key?: string; deckUrl?: unknown; analysis?: unknown; themeScore?: unknown } | null;
  if (!body?.key) return jsonError("Paramètres invalides", 400);
  const deckUrl = body.deckUrl === undefined ? undefined : cleanDeckUrl(body.deckUrl);
  if (deckUrl === undefined && body.deckUrl !== undefined) return jsonError("Le lien des diapos doit commencer par https://", 400);
  const analysis = body.analysis === undefined ? undefined : String(body.analysis).trim().slice(0, 5000) || null;
  const themeScore = body.themeScore === undefined ? undefined : cleanScore(body.themeScore);
  if (themeScore === undefined && body.themeScore !== undefined) return jsonError("La note va de 0 à 10.", 400);
  const id = await depositPractice({ key: body.key, deckUrl, analysis, themeScore });
  if (!id) return jsonError("Pratique introuvable dans l'horaire de la saison.", 404);
  return NextResponse.json({ ok: true, activityId: id });
}
