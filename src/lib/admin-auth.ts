import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sameSecret } from "@/lib/login-guard";
import { verifyPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const ADMIN_COOKIE_NAME = "nv_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 heures

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

// Aucun mot de passe par défaut dans le code (le dépôt a été public) : ceux de Vercel (ADMIN_PASSWORD, GERANTE_PASSWORD)
// s'ils existent, et ceux rangés chiffrés (scrypt) dans app_settings « admin_password_hashes ».
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || null;
const GERANTE_PASSWORD = process.env.GERANTE_PASSWORD?.trim() || null;

/** "admin" = accès complet (dont finances). "gerante" = inscriptions,
 *  essais, groupes/horaire — jamais les données financières. Étendre
 *  cette liste (ex. "entraineur", "coordonnateur") pour de futurs rôles
 *  sans casser l'existant : chaque route/page choisit explicitement les
 *  rôles autorisés via `requireAdmin({ roles: [...] })`. */
export type AdminRole = "admin" | "gerante" | "borne";
/** « borne » (JP, 18 nov. 2026) : le code de la tablette au bord du terrain. Il n'ouvre que les pratiques du jour
 *  (leur plan et le sondage des filles, /admin/borne) : toute autre page y renvoie, et aucune route ne l'accepte sans le nommer. */
export const KIOSK_HOME = "/admin/borne";
/** Les rôles de l'équipe (tout sauf la borne). */
export type StaffRole = Exclude<AdminRole, "borne">;

function db() {
  return getSupabaseAdminClient() as any;
}

/** Retourne le rôle associé au mot de passe saisi, ou null s'il est invalide (comparaisons en temps constant). */
export async function checkAdminPassword(password: string): Promise<AdminRole | null> {
  if (!password) return null;
  if (ADMIN_PASSWORD && sameSecret(password, ADMIN_PASSWORD)) return "admin";
  if (GERANTE_PASSWORD && sameSecret(password, GERANTE_PASSWORD)) return "gerante";
  const { data } = await db().from("app_settings").select("value").eq("key", "admin_password_hashes").maybeSingle();
  let hashes: Partial<Record<AdminRole, string>> = {};
  try {
    hashes = typeof data?.value === "string" ? JSON.parse(data.value) : (data?.value ?? {});
  } catch {
    hashes = {};
  }
  if (hashes.admin && verifyPassword(password, hashes.admin)) return "admin";
  if (hashes.gerante && verifyPassword(password, hashes.gerante)) return "gerante";
  if (hashes.borne && verifyPassword(password, hashes.borne)) return "borne";
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

/** Rôle brut de la session, y compris « borne ». */
export async function getSessionAdminRole(): Promise<AdminRole | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return getSessionRole(token);
}

/** Rôle de la session en cours (route handlers — ne peut pas rediriger). La borne n'est jamais un rôle d'admin :
 *  null pour elle, pour que toute vérification existante la refuse. */
export async function getCurrentAdminRole(): Promise<StaffRole | null> {
  const role = await getSessionAdminRole();
  return role === "borne" ? null : role;
}

/** À appeler en haut de chaque Server Component/Route admin. Redirige vers
 *  /admin si non connecté. Avec `roles`, redirige vers /admin/aujourdhui si
 *  le rôle de la session n'est pas autorisé pour cette page (ex. Revenus,
 *  réservé à "admin"). Retourne le rôle pour un usage éventuel dans la page. */
export async function requireAdmin(options?: { roles?: AdminRole[] }): Promise<StaffRole> {
  const raw = await getSessionAdminRole();
  if (!raw) redirect("/admin");
  if (raw === "borne") {
    // Pages du sondage seulement : elles n'utilisent pas le rôle rendu.
    if (options?.roles?.includes("borne")) return "gerante";
    redirect(KIOSK_HOME);
  }
  const role: StaffRole = raw;
  if (options?.roles && !options.roles.includes(role)) redirect("/admin/aujourdhui");
  return role;
}

/** Vérifie l'auth dans les route handlers (ne peut pas utiliser redirect).
 *  Avec `roles`, retourne false si le rôle de la session n'est pas
 *  autorisé — à utiliser sur TOUTE route API exposant des données
 *  financières, en plus du masquage de la navigation côté client. */
export async function isAdminRequest(options?: { roles?: AdminRole[] }): Promise<boolean> {
  const role = await getSessionAdminRole();
  if (!role) return false;
  if (role === "borne") return !!options?.roles?.includes("borne");
  if (options?.roles && !options.roles.includes(role)) return false;
  return true;
}

/** Changer un code d'accès (JP, 19 nov. 2026) : JP le tape lui-même dans l'admin (Outils › Codes d'accès) ; seul le
 *  hachage est gardé dans app_settings « admin_password_hashes ». Pour le code administrateur, le code actuel est
 *  demandé. 8 caractères au moins (6 chiffres pour la borne). */
export async function changeAccessCode(input: { target: AdminRole; current: string; next: string }): Promise<void> {
  const { hashPassword } = await import("@/lib/password");
  const next = input.next.trim();
  const min = input.target === "borne" ? 6 : 8;
  if (next.length < min) throw new Error(`Le nouveau code doit avoir au moins ${min} caractères.`);
  if ((await checkAdminPassword(input.current)) !== "admin") throw new Error("Ton code administrateur actuel n'est pas le bon.");
  const other = await checkAdminPassword(next);
  if (other && other !== input.target) throw new Error("Ce code est déjà utilisé par un autre accès : choisis-en un autre.");
  const { data } = await db().from("app_settings").select("value").eq("key", "admin_password_hashes").maybeSingle();
  let hashes: Partial<Record<AdminRole, string>> = {};
  try {
    hashes = typeof data?.value === "string" ? JSON.parse(data.value) : (data?.value ?? {});
  } catch {
    hashes = {};
  }
  hashes[input.target] = hashPassword(next);
  const { CLUB_ID } = await import("@/lib/club");
  const row = { key: "admin_password_hashes", value: JSON.stringify(hashes), updated_at: new Date().toISOString() };
  const { data: existing } = await db().from("app_settings").select("key").eq("key", "admin_password_hashes").maybeSingle();
  const { error } = existing ? await db().from("app_settings").update(row).eq("key", "admin_password_hashes") : await db().from("app_settings").insert({ club_id: CLUB_ID, ...row });
  if (error) throw new Error(error.message);
}

/* ── Code administrateur oublié (JP, 20 nov. 2026) ─────────────────────────────────────────────── */

const RESET_MINUTES = 30;

/** Le courriel de JP pour le lien de récupération : sa fiche d'éducateur (app_settings « coach_admin_id »). */
async function adminRecoveryEmail(): Promise<string | null> {
  const { data: setting } = await db().from("app_settings").select("value").eq("key", "coach_admin_id").maybeSingle();
  const coachId = typeof setting?.value === "string" ? setting.value : null;
  if (!coachId) return null;
  const { data: coach } = await db().from("coaches").select("email").eq("id", coachId).maybeSingle();
  return coach?.email?.trim() || null;
}

/** Envoie à JP un lien à usage unique (30 minutes) pour choisir un nouveau code. Au plus 3 demandes par heure. */
export async function sendAdminCodeReset(): Promise<boolean> {
  const to = await adminRecoveryEmail();
  if (!to) return false;
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db().from("admin_code_resets").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= 3) return false;
  const { randomBytes } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  const { error } = await db().from("admin_code_resets").insert({ token, expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString() });
  if (error) throw new Error(error.message);
  const { env } = await import("@/lib/env");
  const { getResendClient } = await import("@/lib/resend");
  const url = `${env.publicSiteUrl}/admin/code-oublie/${token}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour JP,</p><p>Tu as demandé un nouveau code pour l'espace administrateur de New Valkyria. Ce lien est valable ${RESET_MINUTES} minutes et ne sert qu'une fois.</p><p><a href="${url}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">Choisir mon nouveau code</a></p><p style="font-size:13px;color:#666">Si ce n'est pas toi, ignore ce courriel : ton code actuel reste le même.</p></div>`;
  const text = `Bonjour JP,\n\nTu as demandé un nouveau code pour l'espace administrateur de New Valkyria. Ce lien est valable ${RESET_MINUTES} minutes et ne sert qu'une fois :\n${url}\n\nSi ce n'est pas toi, ignore ce courriel : ton code actuel reste le même.`;
  const res = await getResendClient().emails.send({ to, subject: "Ton nouveau code administrateur (New Valkyria)", html, text } as never);
  const err = (res as { error?: { message: string } | null })?.error;
  if (err) throw new Error(err.message);
  return true;
}

export async function checkAdminCodeReset(token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return false;
  const { data } = await db().from("admin_code_resets").select("expires_at, used_at").eq("token", token).maybeSingle();
  return Boolean(data && !data.used_at && Date.parse(data.expires_at) > Date.now());
}

/** JP choisit son nouveau code avec le lien reçu (le lien est ensuite inutilisable). */
export async function consumeAdminCodeReset(token: string, next: string): Promise<void> {
  if (!(await checkAdminCodeReset(token))) throw new Error("Ce lien n'est plus valable. Demande un nouveau lien.");
  const code = next.trim();
  if (code.length < 8) throw new Error("Le nouveau code doit avoir au moins 8 caractères.");
  const other = await checkAdminPassword(code);
  if (other && other !== "admin") throw new Error("Ce code est déjà utilisé par un autre accès : choisis-en un autre.");
  const { hashPassword } = await import("@/lib/password");
  const { data } = await db().from("app_settings").select("value").eq("key", "admin_password_hashes").maybeSingle();
  let hashes: Partial<Record<AdminRole, string>> = {};
  try {
    hashes = typeof data?.value === "string" ? JSON.parse(data.value) : (data?.value ?? {});
  } catch {
    hashes = {};
  }
  hashes.admin = hashPassword(code);
  const { error } = await db().from("app_settings").update({ value: JSON.stringify(hashes), updated_at: new Date().toISOString() }).eq("key", "admin_password_hashes");
  if (error) throw new Error(error.message);
  await db().from("admin_code_resets").update({ used_at: new Date().toISOString() }).eq("token", token);
}
