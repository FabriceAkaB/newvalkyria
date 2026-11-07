import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  verified: boolean;
  created_at: string;
}

const ATHLETE_PHOTO_BUCKET = "athlete-photos";

/** Téléverse la photo permanente d'une athlète (profil canonique players,
 *  pas seulement l'événement du jour) — remplace la photo existante si
 *  elle en avait déjà une. Voir uploadChildPhoto (parent-repo.ts) pour le
 *  même patron côté espace parent. */
export async function uploadPlayerPhoto(playerId: string, file: File): Promise<string> {
  const supabase = db();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${playerId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ATHLETE_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(ATHLETE_PHOTO_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl as string;

  const { error: updateError } = await supabase.from("players").update({ photo_url: publicUrl }).eq("id", playerId);
  if (updateError) throw new Error(updateError.message);

  return publicUrl;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Trouve la joueuse existante correspondant à ce nom/DOB au sein de la même
 *  famille (email OU téléphone du parent déjà vus sur une autre inscription),
 *  sinon en crée une nouvelle. Ne fusionne jamais deux familles différentes —
 *  même logique que le backfill du 14 août 2026 (voir supabase/migrations). */
export async function findOrCreatePlayer(input: {
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  parentEmail: string;
  parentPhone: string;
}): Promise<string | null> {
  if (!input.firstName || !input.lastName) return null;

  const supabase = db();
  const firstKey = normalizeName(input.firstName);
  const lastKey = normalizeName(input.lastName);

  if (input.dob) {
    // Cherche parmi les inscriptions de cette famille (même email ou même
    // téléphone) une joueuse déjà liée avec le même nom+DOB normalisés.
    const { data: familyRegs, error } = await supabase
      .from("registrations")
      .select("player_id, player_first_name, player_last_name, player_dob")
      .or(`parent_email.eq.${input.parentEmail},parent_phone.eq.${input.parentPhone}`)
      .not("player_id", "is", null);
    if (!error && familyRegs) {
      const match = (familyRegs as any[]).find(
        (r) =>
          normalizeName(r.player_first_name ?? "") === firstKey &&
          normalizeName(r.player_last_name ?? "") === lastKey &&
          r.player_dob === input.dob
      );
      if (match) return match.player_id as string;
    }
  }

  const { data: created, error: insertErr } = await supabase
    .from("players")
    .insert({ first_name: input.firstName, last_name: input.lastName, dob: input.dob, verified: Boolean(input.dob) })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);
  return created.id as string;
}

/* ── Photo déposée par la famille avec un lien personnel (/photo/[jeton]), sans compte ───────────── */

export interface PhotoLinkPlayer {
  id: string;
  firstName: string;
  hasPhoto: boolean;
  imageConsent: boolean;
}

export async function getPlayerByPhotoToken(token: string): Promise<PhotoLinkPlayer | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data } = await db().from("players").select("id, first_name, photo_url, image_consent").eq("photo_token", token).maybeSingle();
  if (!data) return null;
  return { id: data.id, firstName: String(data.first_name ?? "").trim(), hasPhoto: Boolean(data.photo_url), imageConsent: Boolean(data.image_consent) };
}

/** Le jeton du lien photo d'une joueuse (créé au premier besoin, ensuite toujours le même). */
export async function ensurePhotoToken(playerId: string): Promise<string> {
  const { data } = await db().from("players").select("photo_token").eq("id", playerId).maybeSingle();
  if (data?.photo_token) return data.photo_token as string;
  const { randomBytes } = await import("node:crypto");
  const token = randomBytes(16).toString("hex");
  const { error } = await db().from("players").update({ photo_token: token }).eq("id", playerId);
  if (error) throw new Error(error.message);
  return token;
}

/** Accord photo ET vidéo (droit à l'image) donné ou refusé par la famille ; retirable en tout temps.
 *  `image_consent_at` = date de la réponse (oui ou non) ; null = la famille n'a jamais répondu. */
export async function setImageConsent(playerId: string, consent: boolean): Promise<void> {
  const { error } = await db()
    .from("players")
    .update({ image_consent: consent, image_consent_at: new Date().toISOString() })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}

/** Réponse du formulaire d'inscription, gardée sur l'inscription ; un déclencheur la recopie sur la joueuse. */
export async function setRegistrationImageConsent(table: "registrations" | "session_program_registrations", registrationId: string, consent: boolean): Promise<void> {
  const { error } = await db().from(table).update({ image_consent: consent }).eq("id", registrationId);
  if (error) throw new Error(error.message);
}

export type ConsentState = "oui" | "non" | "sans-reponse";
export const consentState = (p: { image_consent?: boolean | null; image_consent_at?: string | null }): ConsentState =>
  p.image_consent ? "oui" : p.image_consent_at ? "non" : "sans-reponse";
