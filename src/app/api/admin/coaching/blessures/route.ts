import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { updateIncident } from "@/lib/player-incidents-repo";

/** Suivi d'une fiche de blessure (JP ou la gérante) : statut, suivi, retour au jeu. */
export async function PATCH(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return jsonError("Fiche introuvable", 400);
  const incident = await updateIncident(body.id, body);
  return NextResponse.json({ incident });
}
