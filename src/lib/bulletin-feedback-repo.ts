import type { BulletinPeriod } from "@/lib/bulletin-report";
import type { FeedbackInput, Useful } from "@/lib/bulletin-feedback";
import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Sondage court après chaque bulletin (P4.8.11). Règles : bulletin-feedback.ts. Table : bulletin_feedback. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface MyFeedback {
  useful: Useful;
  missing: string | null;
  updatedAt: string;
}

/** La réponse de ce parent pour ce bulletin, s'il a déjà répondu. */
export async function getMyFeedback(parentUserId: string, registrationId: string, period: BulletinPeriod): Promise<MyFeedback | null> {
  const { data } = await db()
    .from("bulletin_feedback")
    .select("useful, missing, updated_at")
    .eq("parent_user_id", parentUserId)
    .eq("registration_id", registrationId)
    .eq("period", period)
    .maybeSingle();
  return data ? { useful: data.useful, missing: data.missing ?? null, updatedAt: data.updated_at } : null;
}

/** Enregistre ou remplace la réponse du parent (une par parent, par fille et par bulletin). */
export async function saveFeedback(parentUserId: string, parentEmail: string | null, input: FeedbackInput): Promise<void> {
  const row = {
    club_id: CLUB_ID,
    parent_user_id: parentUserId,
    parent_email: parentEmail,
    registration_id: input.registrationId,
    period: input.period,
    useful: input.useful,
    missing: input.missing,
    updated_at: new Date().toISOString()
  };
  const { error } = await db().from("bulletin_feedback").upsert(row, { onConflict: "parent_user_id,registration_id,period" });
  if (error) throw new Error(error.message);
}

export interface FeedbackListRow {
  id: string;
  period: BulletinPeriod;
  useful: Useful;
  missing: string | null;
  updatedAt: string;
  parentName: string | null;
  parentEmail: string | null;
  playerName: string;
  category: string | null;
}

/** Toutes les réponses (admin), les plus récentes d'abord. */
export async function listFeedback(limit = 300): Promise<FeedbackListRow[]> {
  const { data, error } = await db()
    .from("bulletin_feedback")
    .select("id, period, useful, missing, updated_at, parent_email, registration:registrations(player_first_name, player_last_name, parent_name, category_id)")
    .eq("club_id", CLUB_ID)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    period: r.period,
    useful: r.useful,
    missing: r.missing ?? null,
    updatedAt: r.updated_at,
    parentName: r.registration?.parent_name ?? null,
    parentEmail: r.parent_email ?? null,
    playerName: `${String(r.registration?.player_first_name ?? "").trim()} ${String(r.registration?.player_last_name ?? "").trim()}`.trim() || "Joueuse",
    category: r.registration?.category_id ?? null
  }));
}
