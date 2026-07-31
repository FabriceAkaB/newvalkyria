import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const ADMIN_COOKIE_NAME = "nv_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 heures

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "180180";

function db() {
  return getSupabaseAdminClient() as any;
}

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

/** Limiteur de tentatives — protège le mot de passe unique contre le brute-force. */
export async function isIpRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await db()
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("attempted_at", since);
  return (count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginAttempt(ip: string, success: boolean): Promise<void> {
  await db().from("admin_login_attempts").insert({ ip, success });
}

/** Jeton de session opaque, vérifié côté serveur — remplace l'ancien cookie
 *  statique `nv_admin=ok` (rejouable par quiconque le devine). */
export async function createAdminSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString();
  const { error } = await db().from("admin_sessions").insert({ token, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return token;
}

async function isValidAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const { data } = await db().from("admin_sessions").select("expires_at").eq("token", token).maybeSingle();
  if (!data) return false;
  return new Date(data.expires_at as string).getTime() > Date.now();
}

export async function deleteAdminSession(token: string): Promise<void> {
  await db().from("admin_sessions").delete().eq("token", token);
}

/** À appeler en haut de chaque Server Component/Route admin. Redirige vers /admin si non connecté. */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!(await isValidAdminSession(token))) {
    redirect("/admin");
  }
}

/** Vérifie l'auth dans les route handlers (ne peut pas utiliser redirect). */
export async function isAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return isValidAdminSession(token);
}
