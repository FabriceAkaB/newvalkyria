import { NextResponse } from "next/server";

import { COACH_COOKIE_NAME, COACH_SESSION_TTL_SECONDS, createCoachSession, consumePasswordLink } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";
import { sessionCookie } from "@/lib/login-guard";

/** Le mot de passe choisi avec le lien personnel ; l'éducateur est ensuite connecté. */
export async function POST(request: Request) {
  const { token, password } = ((await request.json().catch(() => null)) ?? {}) as { token?: string; password?: string };
  if (!token || !password) return jsonError("Mot de passe requis", 400);
  try {
    const coachId = await consumePasswordLink(token, password);
    const session = await createCoachSession(coachId);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COACH_COOKIE_NAME, session, sessionCookie(COACH_SESSION_TTL_SECONDS));
    return response;
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Erreur", 400);
  }
}
