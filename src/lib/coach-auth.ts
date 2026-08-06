import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const COACH_COOKIE_NAME = "nv_coach_session";
export const COACH_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 heures

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

/** Vérifie identifiant + mot de passe, retourne le compte si valide. */
export async function verifyCoachLogin(username: string, password: string): Promise<CoachAccount | null> {
  const { data } = await db()
    .from("coaches")
    .select("id, first_name, last_name, email, username, password_hash, status")
    .eq("username", username)
    .maybeSingle();
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
