import { timingSafeEqual } from "crypto";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Protection des connexions (admin, éducateurs, familles) contre les essais répétés : au plus N échecs en 15 minutes
 *  par adresse IP et par identifiant. Les tentatives sont notées dans `admin_login_attempts` (colonne `ip` = clé). */

const WINDOW_MINUTES = 15;

function db() {
  return getSupabaseAdminClient() as any;
}

/** L'adresse IP réelle du visiteur. Sur Vercel, `x-vercel-forwarded-for` et `x-real-ip` sont posés par la plateforme ;
 *  la première valeur de `x-forwarded-for` peut être inventée par le client, on ne la prend qu'en dernier recours. */
export function clientIp(request: Request): string {
  const h = request.headers;
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",").pop()!.trim();
  return "inconnue";
}

export async function isLimited(key: string, maxFailures: number): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await db().from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ip", key).eq("success", false).gte("attempted_at", since);
  return (count ?? 0) >= maxFailures;
}

export async function recordAttempt(keys: string[], success: boolean): Promise<void> {
  await db().from("admin_login_attempts").insert(keys.map((ip) => ({ ip, success })));
}

/** Une connexion est bloquée si l'IP a trop d'échecs (10) ou si cet identifiant en a trop (5), sur 15 minutes. */
export async function loginBlocked(scope: string, ip: string, identifier: string | null): Promise<boolean> {
  if (await isLimited(`${scope}:ip:${ip}`, 10)) return true;
  return identifier ? isLimited(`${scope}:id:${identifier.trim().toLowerCase()}`, 5) : false;
}

export async function recordLogin(scope: string, ip: string, identifier: string | null, success: boolean): Promise<void> {
  await recordAttempt([`${scope}:ip:${ip}`, ...(identifier ? [`${scope}:id:${identifier.trim().toLowerCase()}`] : [])], success).catch(() => null);
}

/** Comparaison de deux secrets en temps constant (ne révèle pas, par le temps de réponse, combien de caractères sont bons). */
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Options des cookies de session : jamais lisibles par le JavaScript de la page, envoyés seulement en HTTPS en production. */
export const sessionCookie = (maxAge: number) => ({ httpOnly: true, path: "/", maxAge, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" });
