import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const COACH_COOKIE_NAME = "nv_coach_session";
// 30 jours (JP, 20 nov. 2026) : 12 heures faisaient expirer la connexion pendant le rapport du lendemain.
export const COACH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function db() {
  return getSupabaseAdminClient() as any;
}

export interface CoachAccount {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  username: string;
}

/** Vérifie identifiant (ou courriel) + mot de passe, retourne le compte si valide. */
export async function verifyCoachLogin(username: string, password: string): Promise<CoachAccount | null> {
  const id = username.trim();
  const { data: rows } = await db()
    .from("coaches")
    .select("id, first_name, last_name, email, username, password_hash, status")
    .or(id.includes("@") ? `email.ilike.${id.replace(/[,()]/g, "")}` : `username.eq.${id.replace(/[,()]/g, "")}`)
    .limit(2);
  const data = ((rows ?? []) as any[]).length === 1 ? (rows as any[])[0] : null;
  if (!data || !data.password_hash || data.status !== "active") return null;
  if (!verifyPassword(password, data.password_hash)) return null;
  return { id: data.id, first_name: data.first_name, last_name: data.last_name, email: data.email, username: data.username };
}

/** Fixe/modifie les identifiants d'un entraîneur — appelé depuis l'admin
 *  (fiche entraîneur), jamais par le coach lui-même dans cette phase. */
export async function setCoachCredentials(coachId: string, username: string, password: string): Promise<void> {
  const { error } = await db()
    .from("coaches")
    .update({ username, password_hash: hashPassword(password) })
    .eq("id", coachId);
  if (error) throw new Error(error.message);
}

/* ── Mot de passe choisi par l'éducateur (JP, 18 nov. 2026) ──────────────────────────────────────────────── */

export const MIN_PASSWORD = 8;
const RESET_HOURS = { oubli: 2, invitation: 24 * 7 } as const;

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Au moins ${MIN_PASSWORD} caractères.`;
  if (!/[0-9]/.test(pw) || !/[a-zA-ZÀ-ÿ]/.test(pw)) return "Au moins une lettre et un chiffre.";
  return null;
}

/** Crée un lien personnel pour choisir son mot de passe (« oubli » : 2 h ; « invitation » : 7 jours) et l'envoie par
 *  courriel. Rend toujours vrai pour un courriel inconnu (on ne dit jamais si un courriel existe). */
export async function sendPasswordLink(email: string, purpose: "oubli" | "invitation"): Promise<boolean> {
  const { data: coach } = await db().from("coaches").select("id, first_name, email, status").ilike("email", email.trim()).eq("status", "active").maybeSingle();
  if (!coach?.email) return false;
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db().from("coach_password_resets").select("id", { count: "exact", head: true }).eq("coach_id", coach.id).gte("created_at", since);
  if ((count ?? 0) >= 5) return false;
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + RESET_HOURS[purpose] * 3_600_000).toISOString();
  const { error } = await db().from("coach_password_resets").insert({ coach_id: coach.id, token, purpose, expires_at: expires });
  if (error) throw new Error(error.message);
  const { env } = await import("@/lib/env");
  const { getResendClient } = await import("@/lib/resend");
  const url = `${env.publicSiteUrl}/entraineur/mot-de-passe/${token}`;
  const first = String(coach.first_name ?? "").trim();
  const intro = purpose === "invitation" ? "Ton accès à l'Espace Technique de New Valkyria est prêt : tes pratiques et leur plan (à imprimer), le rapport après chaque pratique, ta paie, ton contrat, ta formation et une boîte à suggestions. Choisis ton mot de passe : tu te connecteras ensuite avec ce courriel, sur newvalkyria.com (Espace coach)." : "Tu as demandé un nouveau mot de passe pour l'Espace Technique de New Valkyria.";
  const until = purpose === "invitation" ? "Ce lien est valide 7 jours." : "Ce lien est valide 2 heures. Si ce n'est pas toi, ignore ce courriel.";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour${first ? ` ${first}` : ""},</p><p>${intro}</p><p><a href="${url}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">Choisir mon mot de passe</a></p><p style="font-size:13px;color:#666">Ou copie ce lien : <a href="${url}">${url}</a><br>${until}</p><p>L'équipe New Valkyria</p></div>`;
  const text = `Bonjour${first ? ` ${first}` : ""},\n\n${intro}\n\nChoisir mon mot de passe : ${url}\n${until}\n\nL'équipe New Valkyria`;
  const res = await getResendClient().emails.send({ to: coach.email, subject: purpose === "invitation" ? "Ton accès à l'Espace Technique New Valkyria" : "Ton nouveau mot de passe (Espace Technique)", html, text } as never);
  const err = (res as { error?: { message: string } | null })?.error;
  if (err) throw new Error(err.message);
  return true;
}

/** Le lien est-il encore bon ? Rend le prénom pour saluer l'éducateur. */
export async function checkPasswordLink(token: string): Promise<{ coachId: string; firstName: string } | null> {
  const { data } = await db().from("coach_password_resets").select("coach_id, expires_at, used_at, coach:coaches(first_name, status)").eq("token", token).maybeSingle();
  if (!data || data.used_at || Date.parse(data.expires_at) < Date.now() || data.coach?.status !== "active") return null;
  return { coachId: data.coach_id, firstName: data.coach?.first_name ?? "" };
}

/** Fixe le mot de passe choisi (l'identifiant devient le courriel s'il n'y en avait pas) et use le lien. */
export async function consumePasswordLink(token: string, password: string): Promise<string> {
  const link = await checkPasswordLink(token);
  if (!link) throw new Error("Ce lien n'est plus valide : demande-en un nouveau.");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const { data: coach } = await db().from("coaches").select("username, email").eq("id", link.coachId).single();
  const { error } = await db().from("coaches").update({ password_hash: hashPassword(password), username: coach?.username ?? String(coach?.email ?? "").toLowerCase() }).eq("id", link.coachId);
  if (error) throw new Error(error.message);
  await db().from("coach_password_resets").update({ used_at: new Date().toISOString() }).eq("token", token);
  return link.coachId;
}

/** L'éducateur change lui-même son mot de passe (Mon dossier). */
export async function changeCoachPassword(coachId: string, current: string, next: string): Promise<void> {
  const { data } = await db().from("coaches").select("password_hash").eq("id", coachId).single();
  if (!data?.password_hash || !verifyPassword(current, data.password_hash)) throw new Error("Mot de passe actuel incorrect.");
  const problem = passwordProblem(next);
  if (problem) throw new Error(problem);
  const { error } = await db().from("coaches").update({ password_hash: hashPassword(next) }).eq("id", coachId);
  if (error) throw new Error(error.message);
}

export async function createCoachSession(coachId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + COACH_SESSION_TTL_SECONDS * 1000).toISOString();
  const { error } = await db().from("coach_sessions").insert({ token, coach_id: coachId, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return token;
}

export async function deleteCoachSession(token: string): Promise<void> {
  await db().from("coach_sessions").delete().eq("token", token);
}

async function getSessionCoachId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const { data } = await db().from("coach_sessions").select("coach_id, expires_at").eq("token", token).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  return data.coach_id as string;
}

/** À appeler en haut de chaque page de l'espace entraîneur. Redirige vers
 *  /entraineur si non connecté. Retourne l'id du coach connecté. */
export async function requireCoach(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COACH_COOKIE_NAME)?.value;
  const coachId = await getSessionCoachId(token);
  if (!coachId) redirect("/entraineur");
  return coachId;
}

/** Pour les route handlers (ne peut pas rediriger). */
export async function getCurrentCoachId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COACH_COOKIE_NAME)?.value;
  return getSessionCoachId(token);
}
