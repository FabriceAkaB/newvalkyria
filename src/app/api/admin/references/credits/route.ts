import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { adjustCredit } from "@/lib/private-programs-admin";

/** Correction manuelle d'un crédit familial (toujours avec une note, toujours journalisée). */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { email?: string; deltaCents?: number; note?: string } | null;
  if (!body?.email || typeof body.deltaCents !== "number") return jsonError("Courriel et montant requis", 400);
  try {
    await adjustCredit({ email: body.email, deltaCents: Math.round(body.deltaCents), note: body.note ?? "", actor: `admin:${role}` });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
