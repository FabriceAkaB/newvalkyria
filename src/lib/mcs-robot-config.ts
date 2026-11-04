import { CLUB_ID } from "@/lib/club";
import { decryptSecret, encryptSecret } from "@/lib/mail-config";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Compte robot MonClubSportif (agent A12) : JP le tape lui-même dans l'admin, sans passer par Vercel. Le mot de passe
 *  est chiffré dans `app_settings` (même chiffrement que la boîte d'envoi Gmail) et n'est jamais renvoyé à l'écran. */

function db() {
  return getSupabaseAdminClient() as any;
}

const EMAIL_KEY = "mcs_robot_email";
const PASSWORD_KEY = "mcs_robot_password_enc";

async function setting(key: string): Promise<{ value: string | null; updated_at: string | null } | null> {
  const { data } = await db().from("app_settings").select("value, updated_at").eq("club_id", CLUB_ID).eq("key", key).maybeSingle();
  return data ?? null;
}

/** Ce que l'écran peut montrer : le courriel du robot (masqué) et la date, jamais le mot de passe. */
export async function getRobotStatus(): Promise<{ email: string; updatedAt: string | null } | null> {
  const [email, pass] = await Promise.all([setting(EMAIL_KEY), setting(PASSWORD_KEY)]);
  if (!email?.value || !pass?.value) return null;
  const [user, domain] = email.value.split("@");
  return { email: `${user.slice(0, 2)}…@${domain ?? ""}`, updatedAt: pass.updated_at };
}

/** Pour le robot seulement (côté serveur). */
export async function getRobotCredentials(): Promise<{ email: string; password: string } | null> {
  const [email, pass] = await Promise.all([setting(EMAIL_KEY), setting(PASSWORD_KEY)]);
  if (!email?.value || !pass?.value) return null;
  return { email: email.value, password: decryptSecret(pass.value) };
}

export async function saveRobotCredentials(email: string, password: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("app_settings")
    .upsert(
      [
        { club_id: CLUB_ID, key: EMAIL_KEY, value: email.trim().toLowerCase(), updated_at: now },
        { club_id: CLUB_ID, key: PASSWORD_KEY, value: encryptSecret(password), updated_at: now }
      ],
      { onConflict: "club_id,key" }
    );
  if (error) throw new Error(error.message);
}

export async function clearRobotCredentials(): Promise<void> {
  await db().from("app_settings").delete().eq("club_id", CLUB_ID).in("key", [EMAIL_KEY, PASSWORD_KEY]);
}
