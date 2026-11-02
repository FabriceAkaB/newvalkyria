import { CLUB_ID } from "@/lib/club";
import type { ObservationCriterion } from "@/lib/coach-observations";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Observations filmées mensuelles des coachs (P1.4.03). */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface CoachObservation {
  id: string;
  coach_id: string;
  coach_name: string;
  activity_id: string | null;
  activity_label: string | null;
  observed_on: string;
  video_url: string | null;
  scores: Partial<Record<ObservationCriterion, number>>;
  total: number | null;
  strengths: string | null;
  to_improve: string | null;
  next_focus: string | null;
  shared_at: string | null;
}

export async function listObservations(opts: { coachId?: string; sharedOnly?: boolean } = {}): Promise<CoachObservation[]> {
  let q = db()
    .from("coach_observations")
    .select("*, coach:coaches(first_name, last_name), activity:coach_activities(title, category, activity_type, activity_date)")
    .eq("club_id", CLUB_ID)
    .order("observed_on", { ascending: false });
  if (opts.coachId) q = q.eq("coach_id", opts.coachId);
  if (opts.sharedOnly) q = q.not("shared_at", "is", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((o) => ({
    ...o,
    observed_on: String(o.observed_on).slice(0, 10),
    coach_name: `${o.coach?.first_name ?? ""} ${o.coach?.last_name ?? ""}`.trim(),
    activity_label: o.activity ? `${o.activity.title || o.activity.category || o.activity.activity_type} (${String(o.activity.activity_date).slice(0, 10)})` : null
  }));
}

export interface ObservationInput {
  coachId: string;
  activityId: string | null;
  observedOn: string;
  videoUrl: string | null;
  scores: Record<ObservationCriterion, number>;
  total: number;
  strengths: string | null;
  toImprove: string | null;
  nextFocus: string | null;
  share: boolean;
}

export async function saveObservation(input: ObservationInput, id?: string): Promise<string> {
  const row = {
    club_id: CLUB_ID,
    coach_id: input.coachId,
    activity_id: input.activityId,
    observed_on: input.observedOn,
    video_url: input.videoUrl,
    scores: input.scores,
    total: input.total,
    strengths: input.strengths,
    to_improve: input.toImprove,
    next_focus: input.nextFocus,
    shared_at: input.share ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const q = id ? db().from("coach_observations").update(row).eq("id", id).eq("club_id", CLUB_ID).select("id").single() : db().from("coach_observations").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function setObservationShared(id: string, shared: boolean): Promise<void> {
  const { error } = await db().from("coach_observations").update({ shared_at: shared ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

/** Coachs qui ont eu au moins une activité (présents) dans le mois, et leurs activités récentes (pour lier l'observation). */
export async function coachActivitiesInRange(from: string, to: string): Promise<{ coachId: string; activityId: string; label: string; date: string }[]> {
  const { data, error } = await db()
    .from("coach_assignments")
    .select("coach_id, status, activity:coach_activities(id, activity_date, start_time, title, category, activity_type)")
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .filter((a) => a.activity && String(a.activity.activity_date).slice(0, 10) >= from && String(a.activity.activity_date).slice(0, 10) <= to && a.status !== "absent")
    .map((a) => ({
      coachId: a.coach_id,
      activityId: a.activity.id,
      date: String(a.activity.activity_date).slice(0, 10),
      label: `${String(a.activity.activity_date).slice(0, 10)} ${String(a.activity.start_time).slice(0, 5)} · ${a.activity.title || a.activity.category || a.activity.activity_type}`
    }))
    .sort((x, y) => y.date.localeCompare(x.date));
}
