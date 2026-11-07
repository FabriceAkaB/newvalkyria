import { CLUB_ID } from "@/lib/club";
import { decryptSecret, encryptSecret } from "@/lib/mail-config";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Compte Veo (caméra des matchs et des pratiques) : JP le tape lui-même dans l'admin, comme le robot MonClubSportif.
 *  Le mot de passe est chiffré dans `app_settings` et n'est jamais renvoyé à l'écran. Sert à aller chercher les
 *  enregistrements Veo (liste, fichier vidéo 1080p) pour les ranger dans le site sans que JP ait à se reconnecter. */

function db() {
  return getSupabaseAdminClient() as any;
}

const EMAIL_KEY = "veo_email";
const PASSWORD_KEY = "veo_password_enc";
const CLUB_KEY = "veo_club_slug";

async function setting(key: string): Promise<{ value: string | null; updated_at: string | null } | null> {
  const { data } = await db().from("app_settings").select("value, updated_at").eq("club_id", CLUB_ID).eq("key", key).maybeSingle();
  return data ?? null;
}

/** Ce que l'écran peut montrer : le courriel (masqué), le club Veo et la date, jamais le mot de passe. */
export async function getVeoStatus(): Promise<{ email: string; club: string | null; updatedAt: string | null } | null> {
  const [email, pass, club] = await Promise.all([setting(EMAIL_KEY), setting(PASSWORD_KEY), setting(CLUB_KEY)]);
  if (!email?.value || !pass?.value) return null;
  const [user, domain] = email.value.split("@");
  return { email: `${user.slice(0, 2)}…@${domain ?? ""}`, club: club?.value ?? null, updatedAt: pass.updated_at };
}

/** Pour le serveur seulement. */
export async function getVeoCredentials(): Promise<{ email: string; password: string; club: string | null } | null> {
  const [email, pass, club] = await Promise.all([setting(EMAIL_KEY), setting(PASSWORD_KEY), setting(CLUB_KEY)]);
  if (!email?.value || !pass?.value) return null;
  return { email: email.value, password: decryptSecret(pass.value), club: club?.value ?? null };
}

export async function saveVeoCredentials(email: string, password: string, club: string | null): Promise<void> {
  const now = new Date().toISOString();
  const rows = [
    { club_id: CLUB_ID, key: EMAIL_KEY, value: email.trim().toLowerCase(), updated_at: now },
    { club_id: CLUB_ID, key: PASSWORD_KEY, value: encryptSecret(password), updated_at: now }
  ];
  if (club) rows.push({ club_id: CLUB_ID, key: CLUB_KEY, value: club.trim(), updated_at: now });
  const { error } = await db().from("app_settings").upsert(rows, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
}
