import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clientIp, sessionCookie } from "@/lib/login-guard";

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  checkAdminPassword,
  createAdminSession,
  deleteAdminSession,
  isIpRateLimited,
  recordLoginAttempt
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const ip = clientIp(request);

  if (await isIpRateLimited(ip)) {
    return NextResponse.json({ error: "Trop de tentatives — réessayez dans quelques minutes." }, { status: 429 });
  }

  const { password } = ((await request.json().catch(() => null)) ?? {}) as { password?: string };
  const role = typeof password === "string" && password ? await checkAdminPassword(password) : null;

  await recordLoginAttempt(ip, role !== null);

  if (!role) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const token = await createAdminSession(role);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, sessionCookie(ADMIN_SESSION_TTL_SECONDS));
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
