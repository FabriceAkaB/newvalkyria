import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { COACH_COOKIE_NAME, COACH_SESSION_TTL_SECONDS, createCoachSession, deleteCoachSession, verifyCoachLogin } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const { username, password } = (await request.json().catch(() => null)) as { username?: string; password?: string } | null ?? {};

  if (!username || !password) return jsonError("Identifiant et mot de passe requis", 400);

  const coach = await verifyCoachLogin(username, password);
  if (!coach) return jsonError("Identifiant ou mot de passe incorrect", 401);

  const token = await createCoachSession(coach.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COACH_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: COACH_SESSION_TTL_SECONDS,
    sameSite: "lax"
  });
  return response;
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COACH_COOKIE_NAME)?.value;
  if (token) await deleteCoachSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COACH_COOKIE_NAME);
  return response;
}
