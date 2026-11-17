import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clientIp, loginBlocked, recordLogin, sessionCookie } from "@/lib/login-guard";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { PARENT_COOKIE_MAX_AGE, PARENT_COOKIE_NAME } from "@/lib/parent-auth";
import { createParentSession, deleteParentSession, signInParent } from "@/lib/parent-repo";
import { parentSignInSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const payload = parentSignInSchema.parse(await request.json());
    const ip = clientIp(request);
    if (await loginBlocked("famille", ip, payload.email)) return jsonError("Trop de tentatives : réessayez dans 15 minutes.", 429);

    const result = await signInParent(payload.email, payload.password);
    await recordLogin("famille", ip, payload.email, !("error" in result));
    if ("error" in result) return jsonError(result.error, 401);

    const token = await createParentSession(result.userId);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(PARENT_COOKIE_NAME, token, sessionCookie(PARENT_COOKIE_MAX_AGE));
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    }
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_COOKIE_NAME)?.value;
  if (token) await deleteParentSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(PARENT_COOKIE_NAME);
  return response;
}
