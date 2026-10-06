import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { transferBoy, type BoysProgram } from "@/lib/boys-transfer";
import { jsonError } from "@/lib/http";

const PROGRAMS: BoysProgram[] = ["sport-etudes", "intensif-garcons"];

/** Transfère un garçon entre Sport-Études et Programme Intensif. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { from?: BoysProgram; to?: BoysProgram; id?: string } | null;
  if (!body?.id || !body.from || !body.to || !PROGRAMS.includes(body.from) || !PROGRAMS.includes(body.to)) {
    return jsonError("Paramètres invalides", 400);
  }
  try {
    const registrationId = await transferBoy({ from: body.from, to: body.to, id: body.id });
    return NextResponse.json({ ok: true, registrationId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
