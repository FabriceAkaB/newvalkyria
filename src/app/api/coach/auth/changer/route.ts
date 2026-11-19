import { NextResponse } from "next/server";

import { changeCoachPassword, getCurrentCoachId } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";

/** L'éducateur change son mot de passe (Mon dossier). */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non connecté", 401);
  const { current, next } = ((await request.json().catch(() => null)) ?? {}) as { current?: string; next?: string };
  if (!current || !next) return jsonError("Mots de passe requis", 400);
  try {
    await changeCoachPassword(coachId, current, next);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Erreur", 400);
  }
}
