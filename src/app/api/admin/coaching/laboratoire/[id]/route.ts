import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { decideExperiment } from "@/lib/coach-lab-repo";
import { jsonError } from "@/lib/http";

/** Décision de JP sur une expérience du laboratoire : dans la méthode, abandonnée, ou remise à l'essai. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "methode" && body?.action !== "abandonner" && body?.action !== "reprendre") return jsonError("Action invalide", 400);
  await decideExperiment(id, body.action);
  return NextResponse.json({ ok: true });
}
