import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const ADMIN_COOKIE_NAME = "nv_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 heures

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "180180";
const GERANTE_PASSWORD = process.env.GERANTE_PASSWORD ?? "125125";

/** "admin" = accès complet (dont finances). "gerante" = inscriptions,
 *  essais, groupes/horaire — jamais les données financières. Étendre
 *  cette liste (ex. "entraineur", "coordonnateur") pour de futurs rôles
 *  sans casser l'existant : chaque route/page choisit explicitement les
 *  rôles autorisés via `requireAdmin({ roles: [...] })`. */
export type AdminRole = "admin" | "gerante";

function db() {
  return getSupabaseAdminClient() as any;
}

/** Retourne le rôle associé au mot de passe saisi, ou null s'il est invalide. */
export function checkAdminPassword(password: string): AdminRole | null {
  if (password === ADMIN_PASSWORD) return "admin";
  if (password === GERANTE_PASSWORD) return "gerante";
  return null;
}

/** Limiteur de tentatives — protège les mots de passe contre le brute-force. */
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
export async function createAdminSession(role: AdminRole): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000).toISOString();
  const { error } = await db().from("admin_sessions").insert({ token, expires_at: expiresAt, role });
  if (error) throw new Error(error.message);
  return token;
}

async function getSessionRole(token: string | undefined): Promise<AdminRole | null> {
  if (!token) return null;
  const { data } = await db().from("admin_sessions").select("expires_at, role").eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  return (data.role as AdminRole) ?? "admin";
}

export async function deleteAdminSession(token: string): Promise<void> {
  await db().from("admin_sessions").delete().eq("token", token);
}

/** Rôle de la session en cours (route handlers — ne peut pas rediriger). */
export async function getCurrentAdminRole(): Promise<AdminRole | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return getSessionRole(token);
}

/** À appeler en haut de chaque Server Component/Route admin. Redirige vers
 *  /admin si non connecté. Avec `roles`, redirige vers /admin/dashboard si
 *  le rôle de la session n'est pas autorisé pour cette page (ex. Revenus,
 *  réservé à "admin"). Retourne le rôle pour un usage éventuel dans la page. */
export async function requireAdmin(options?: { roles?: AdminRole[] }): Promise<AdminRole> {
  const role = await getCurrentAdminRole();
  if (!role) redirect("/admin");
  if (options?.roles && !options.roles.includes(role)) redirect("/admin/dashboard");
  return role;
}

/** Vérifie l'auth dans les route handlers (ne peut pas utiliser redirect).
 *  Avec `roles`, retourne false si le rôle de la session n'est pas
 *  autorisé — à utiliser sur TOUTE route API exposant des données
 *  financières, en plus du masquage de la navigation côté client. */
export async function isAdminRequest(options?: { roles?: AdminRole[] }): Promise<boolean> {
  const role = await getCurrentAdminRole();
  if (!role) return false;
  if (options?.roles && !options.roles.includes(role)) return false;
  return true;
}
