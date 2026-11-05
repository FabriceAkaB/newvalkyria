import { CLUB_ID } from "@/lib/club";
import { normalizeRules, type McsRules } from "@/lib/mcs-rules";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Règles MonClubSportif du club, enregistrées dans `app_settings` (clé `mcs_rules`), une par club. */

const KEY = "mcs_rules";

function db() {
  return getSupabaseAdminClient() as any;
}

export async function getMcsRules(clubId = CLUB_ID): Promise<McsRules> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", clubId).eq("key", KEY).maybeSingle();
  let parsed: unknown = null;
  try {
    parsed = data?.value ? JSON.parse(data.value) : null;
  } catch {
    parsed = null;
  }
  return normalizeRules(parsed);
}

export async function saveMcsRules(input: unknown, clubId = CLUB_ID): Promise<McsRules> {
  const rules = normalizeRules(input);
  const { error } = await db()
    .from("app_settings")
    .upsert({ club_id: clubId, key: KEY, value: JSON.stringify(rules), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
  return rules;
}
