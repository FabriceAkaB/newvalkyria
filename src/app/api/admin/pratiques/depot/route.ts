import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { attachPracticeDeck, startDeckUpload } from "@/lib/practice-history-repo";

/** Dépôt des diapos d'une pratique (PDF) pour une date de l'horaire, en deux temps (lien d'envoi direct, puis
 *  rattachement), ou réutilisation d'une pratique déjà déposée pour une autre date. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof body?.[k] === "string" && body[k] ? (body[k] as string) : null);
  try {
    if (body?.action === "start") {
      return NextResponse.json(await startDeckUpload({ fileName: str("fileName") ?? "pratique.pdf", contentType: str("contentType") ?? "" }));
    }
    const key = str("key");
    if (!key) return jsonError("Pratique manquante", 400);
    const out = await attachPracticeDeck({ key, path: str("path"), fileName: str("fileName"), reuseDocumentId: str("reuseDocumentId"), uploadedBy: role === "admin" ? "JP" : "Gérante" });
    return NextResponse.json({ ok: true, ...out });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
