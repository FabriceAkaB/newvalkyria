import { NextResponse } from "next/server";

import { sendPasswordLink } from "@/lib/coach-auth";
import { clientIp, loginBlocked, recordLogin } from "@/lib/login-guard";

/** « Mot de passe oublié » : envoie un lien de 2 h au courriel de l'éducateur. Répond toujours pareil (on ne dit
 *  jamais si un courriel existe). */
export async function POST(request: Request) {
  const { email } = ((await request.json().catch(() => null)) ?? {}) as { email?: string };
  const ip = clientIp(request);
  if (!email || !email.includes("@") || (await loginBlocked("coach", ip, `oubli:${email}`))) return NextResponse.json({ ok: true });
  await recordLogin("coach", ip, `oubli:${email}`, false).catch(() => null);
  await sendPasswordLink(email, "oubli").catch(() => false);
  return NextResponse.json({ ok: true });
}
