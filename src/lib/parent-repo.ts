import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

function auth() {
  return (getSupabaseAdminClient() as any).auth;
}

/** `signInWithPassword` mute la session active du client Supabase qui l'appelle —
 *  sur le client admin partagé (mis en cache), ça ferait passer toutes les requêtes
 *  suivantes de service_role à l'utilisateur qui vient de se connecter, et casserait
 *  les policies RLS "service_role only" des requêtes suivantes. On utilise donc un
 *  client jetable, jamais réutilisé, uniquement pour cet appel. */
function freshAuthClient() {
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false }
  }).auth;
}

const SESSION_TTL_DAYS = 30;

/* ── Comptes ───────────────────────────────────────────────────── */

export async function signUpParent(
  email: string,
  password: string,
  fullName: string
): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await auth().admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (error) {
    if (error.message?.toLowerCase().includes("already")) {
      return { error: "Un compte existe déjà avec ce courriel." };
    }
    return { error: error.message ?? "Impossible de créer le compte." };
  }
  return { userId: data.user.id as string };
}

export async function signInParent(email: string, password: string): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await freshAuthClient().signInWithPassword({ email, password });
  if (error || !data?.user) {
    return { error: "Courriel ou mot de passe incorrect." };
  }
  return { userId: data.user.id as string };
}

export async function getParentAccount(userId: string): Promise<{ email: string; fullName: string } | null> {
  const { data, error } = await auth().admin.getUserById(userId);
  if (error || !data?.user) return null;
  return {
    email: data.user.email ?? "",
    fullName: (data.user.user_metadata?.full_name as string) ?? ""
  };
}

/* ── Sessions ──────────────────────────────────────────────────── */

export async function createParentSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db().from("parent_sessions").insert({ token, user_id: userId, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return token;
}

export async function getParentSessionUserId(token: string): Promise<string | null> {
  const { data, error } = await db().from("parent_sessions").select("user_id, expires_at").eq("token", token).maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;
  return data.user_id as string;
}

export async function deleteParentSession(token: string): Promise<void> {
  await db().from("parent_sessions").delete().eq("token", token);
}

/* ── Enfants ───────────────────────────────────────────────────── */

export interface Child {
  id: string;
  parent_user_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  level: string | null;
  club: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function getChildrenForParent(userId: string): Promise<Child[]> {
  const { data, error } = await db()
    .from("children")
    .select("*")
    .eq("parent_user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Child[];
}

export async function createChild(
  userId: string,
  input: { firstName: string; lastName: string; dob: string; level: string | null; club: string | null }
): Promise<string> {
  const { data, error } = await db()
    .from("children")
    .insert({
      parent_user_id: userId,
      first_name: input.firstName,
      last_name: input.lastName,
      dob: input.dob,
      level: input.level,
      club: input.club
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateChild(
  id: string,
  userId: string,
  patch: Partial<{ firstName: string; lastName: string; dob: string; level: string | null; club: string | null }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.firstName !== undefined) columnPatch.first_name = patch.firstName;
  if (patch.lastName !== undefined) columnPatch.last_name = patch.lastName;
  if (patch.dob !== undefined) columnPatch.dob = patch.dob;
  if (patch.level !== undefined) columnPatch.level = patch.level;
  if (patch.club !== undefined) columnPatch.club = patch.club;

  const { error } = await db().from("children").update(columnPatch).eq("id", id).eq("parent_user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteChild(id: string, userId: string): Promise<void> {
  const { error } = await db().from("children").delete().eq("id", id).eq("parent_user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setChildPhoto(id: string, userId: string, photoUrl: string): Promise<void> {
  const { error } = await db()
    .from("children")
    .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("parent_user_id", userId);
  if (error) throw new Error(error.message);
}

const CHILD_PHOTO_BUCKET = "child-photos";

export async function uploadChildPhoto(id: string, userId: string, file: File): Promise<string> {
  const supabase = getSupabaseAdminClient() as any;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(CHILD_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(CHILD_PHOTO_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl as string;

  await setChildPhoto(id, userId, publicUrl);
  return publicUrl;
}
