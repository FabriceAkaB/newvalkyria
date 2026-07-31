import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  checkAdminPassword,
  createAdminSession,
  deleteAdminSession,
  isIpRateLimited,
  recordLoginAttempt
} from "@/lib/admin-auth";

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  if (await isIpRateLimited(ip)) {
    return NextResponse.json({ error: "Trop de tentatives — réessayez dans quelques minutes." }, { status: 429 });
  }

  const { password } = (await request.json()) as { password?: string };
  const success = Boolean(password && checkAdminPassword(password));

  await recordLoginAttempt(ip, success);

  if (!success) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const token = await createAdminSession();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    sameSite: "lax"
  });
  return response;
}

export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (token) await deleteAdminSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
