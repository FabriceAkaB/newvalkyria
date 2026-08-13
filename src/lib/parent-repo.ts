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
  /** Entité joueuse canonique — jamais reliée automatiquement (rapprochement
   *  nom/DOB saisi par un parent trop risqué sans confirmation humaine).
   *  Reste null tant qu'un futur écran de confirmation ne l'a pas posé. */
  player_id: string | null;
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

/* ── Rattachement à une inscription réelle (entité joueuse) ───────
 *  Jamais automatique — le parent doit confirmer lui-même quelle joueuse
 *  (retrouvée parmi les vraies inscriptions de son compte) correspond à
 *  ce profil enfant. Voir l'audit du 12 août 2026 : fusionner ça en
 *  silence serait risqué (fratrie, orthographe différente...). ── */

export interface PlayerCandidate {
  playerId: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  registrationCount: number;
}

export async function getPlayerCandidatesForEmail(parentEmail: string): Promise<PlayerCandidate[]> {
  const { data, error } = await db()
    .from("registrations")
    .select("player_id, player_first_name, player_last_name, player_dob")
    .eq("parent_email", parentEmail)
    .not("player_id", "is", null);
  if (error) throw new Error(error.message);

  const byPlayer = new Map<string, PlayerCandidate>();
  for (const r of (data ?? []) as any[]) {
    const existing = byPlayer.get(r.player_id);
    if (existing) existing.registrationCount += 1;
    else byPlayer.set(r.player_id, { playerId: r.player_id, firstName: r.player_first_name, lastName: r.player_last_name, dob: r.player_dob, registrationCount: 1 });
  }
  return Array.from(byPlayer.values());
}

/** Confirme qu'un profil enfant correspond à cette joueuse — scopé au
 *  compte du parent connecté, jamais modifiable pour un autre parent. */
export async function linkChildToPlayer(childId: string, userId: string, playerId: string): Promise<void> {
  const { error } = await db()
    .from("children")
    .update({ player_id: playerId, updated_at: new Date().toISOString() })
    .eq("id", childId)
    .eq("parent_user_id", userId);
  if (error) throw new Error(error.message);
}

export async function unlinkChildFromPlayer(childId: string, userId: string): Promise<void> {
  const { error } = await db()
    .from("children")
    .update({ player_id: null, updated_at: new Date().toISOString() })
    .eq("id", childId)
    .eq("parent_user_id", userId);
  if (error) throw new Error(error.message);
}

export interface PlayerRegistrationSummary {
  id: string;
  seasonId: string;
  programId: string | null;
  categoryId: string | null;
  status: string;
  isTrial: boolean;
}

/** Toutes les inscriptions (toutes saisons) d'une joueuse déjà reliée à un
 *  profil enfant — c'est ce qui permet d'afficher calendrier/présences/
 *  évaluations/paiements sans jamais exposer les inscriptions d'une autre
 *  famille : l'appelant doit avoir vérifié au préalable que ce player_id
 *  appartient bien à un enfant du parent connecté. */
export async function getRegistrationsForPlayer(playerId: string): Promise<PlayerRegistrationSummary[]> {
  const { data, error } = await db()
    .from("registrations")
    .select("id, season_id, program_id, category_id, status, is_trial")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    seasonId: r.season_id,
    programId: r.program_id,
    categoryId: r.category_id,
    status: r.status,
    isTrial: r.is_trial
  }));
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
