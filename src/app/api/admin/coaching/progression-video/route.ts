import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { handleProgressVideoAction } from "@/lib/progress-videos-repo";

/** Vidéos de progression des joueuses (JP ou la gérante) : dépôt direct, rattachement (jour, étape, pratique), aperçu,
 *  retrait, étape, « Absente ce jour-là » de la demande de vidéos. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const role = await getCurrentAdminRole();
    const result = await handleProgressVideoAction(body, role === "gerante" ? "Gérante" : "JP");
    if (result) return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  return jsonError("Action inconnue", 400);
}
