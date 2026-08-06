import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AssignmentStatus, CoachActivity, CoachAssignment } from "@/lib/coaches-repo";

function db() {
  return getSupabaseAdminClient() as any;
}

/* ── Activités du coach ───────────────────────────────────────────── */

export interface CoachActivityWithAssignment {
  activity: CoachActivity;
  assignment: CoachAssignment;
  otherCoaches: { id: string; first_name: string; last_name: string }[];
}

export async function getCoachActivities(coachId: string): Promise<CoachActivityWithAssignment[]> {
  const { data, error } = await db()
    .from("coach_assignments")
    .select("*, activity:coach_activities(*)")
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as (CoachAssignment & { activity: CoachActivity })[];
  const activityIds = rows.map((r) => r.activity_id);
  if (activityIds.length === 0) return [];

  const { data: allAssignments, error: err2 } = await db()
    .from("coach_assignments")
    .select("activity_id, coach:coaches(id, first_name, last_name)")
    .in("activity_id", activityIds);
  if (err2) throw new Error(err2.message);

  const othersByActivity = new Map<string, { id: string; first_name: string; last_name: string }[]>();
  for (const row of (allAssignments ?? []) as any[]) {
    const list = othersByActivity.get(row.activity_id) ?? [];
    if (row.coach.id !== coachId) list.push(row.coach);
    othersByActivity.set(row.activity_id, list);
  }

  return rows
    .map((r) => ({ activity: r.activity, assignment: r, otherCoaches: othersByActivity.get(r.activity_id) ?? [] }))
    .sort((a, b) => `${b.activity.activity_date} ${b.activity.start_time}`.localeCompare(`${a.activity.activity_date} ${a.activity.start_time}`));
}

export async function getCoachActivityById(coachId: string, activityId: string): Promise<CoachActivityWithAssignment | null> {
  const all = await getCoachActivities(coachId);
  return all.find((a) => a.activity.id === activityId) ?? null;
}

/* ── Joueuses des groupes de ce coach ─────────────────────────────── */

export interface CoachPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  birthYear: string | null;
  advancedGroup: boolean;
  status: string;
}

/** Toutes les joueuses inscrites (payées/confirmées) dans une catégorie où
 *  ce coach a au moins une activité — dérivé dynamiquement, sans table de
 *  rattachement séparée. */
export async function getCoachPlayers(coachId: string, seasonId: string): Promise<CoachPlayer[]> {
  const activities = await getCoachActivities(coachId);
  const categories = Array.from(new Set(activities.map((a) => a.activity.category).filter((c): c is string => Boolean(c))));
  if (categories.length === 0) return [];

  const { data, error } = await db()
    .from("registrations")
    .select("id, player_first_name, player_last_name, category_id, advanced_group, status")
    .eq("season_id", seasonId)
    .eq("is_trial", false)
    .in("status", ["paid", "confirmed"])
    .in("category_id", categories);
  if (error) throw new Error(error.message);

  return ((data ?? []) as any[])
    .map((r) => ({
      registrationId: r.id,
      firstName: r.player_first_name ?? "",
      lastName: r.player_last_name ?? "",
      birthYear: r.category_id,
      advancedGroup: r.advanced_group,
      status: r.status
    }))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
}

/** Fiche minimale d'une joueuse — volontairement limitée (jamais de prix,
 *  paiement ou coordonnées parent) : c'est tout ce dont un entraîneur a
 *  besoin pour la fiche joueuse. */
export interface PlayerProfile {
  registrationId: string;
  firstName: string;
  lastName: string;
  birthYear: string | null;
  advancedGroup: boolean;
}

export async function getPlayerProfile(registrationId: string): Promise<PlayerProfile | null> {
  const { data, error } = await db()
    .from("registrations")
    .select("id, player_first_name, player_last_name, category_id, advanced_group")
    .eq("id", registrationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    registrationId: data.id,
    firstName: data.player_first_name ?? "",
    lastName: data.player_last_name ?? "",
    birthYear: data.category_id,
    advancedGroup: data.advanced_group
  };
}

/* ── Effectif attendu (joueuses de la catégorie + essais du jour) ──── */

export interface RosterPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  birthYear: string | null;
  isTrial: boolean;
  advancedGroup: boolean;
}

export async function getExpectedRoster(seasonId: string, category: string | null, activityDate: string): Promise<RosterPlayer[]> {
  if (!category) return [];
  const supabase = db();

  const { data: regular, error: e1 } = await supabase
    .from("registrations")
    .select("id, player_first_name, player_last_name, category_id, is_trial, advanced_group, status")
    .eq("season_id", seasonId)
    .eq("category_id", category)
    .eq("is_trial", false)
    .in("status", ["paid", "confirmed"]);
  if (e1) throw new Error(e1.message);

  const { data: trials, error: e2 } = await supabase
    .from("registrations")
    .select("id, player_first_name, player_last_name, category_id, is_trial, advanced_group, status")
    .eq("season_id", seasonId)
    .eq("is_trial", true)
    .eq("trial_date", activityDate);
  if (e2) throw new Error(e2.message);

  const rows = [...(regular ?? []), ...(trials ?? [])] as any[];
  return rows.map((r) => ({
    registrationId: r.id,
    firstName: r.player_first_name ?? "",
    lastName: r.player_last_name ?? "",
    birthYear: r.category_id,
    isTrial: r.is_trial,
    advancedGroup: r.advanced_group
  }));
}

/* ── Présences des joueuses ──────────────────────────────────────── */

export type PlayerAttendanceStatus = "present" | "absent" | "injured" | "late" | "left_early";

export interface PlayerAttendance {
  id: string;
  activity_id: string;
  registration_id: string;
  status: PlayerAttendanceStatus;
}

export async function getActivityAttendance(activityId: string): Promise<PlayerAttendance[]> {
  const { data, error } = await db().from("activity_player_attendance").select("*").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerAttendance[];
}

export async function setPlayerAttendance(activityId: string, registrationId: string, status: PlayerAttendanceStatus): Promise<void> {
  const { error } = await db()
    .from("activity_player_attendance")
    .upsert({ activity_id: activityId, registration_id: registrationId, status, updated_at: new Date().toISOString() }, { onConflict: "activity_id,registration_id" });
  if (error) throw new Error(error.message);
}

/* ── Évaluations ──────────────────────────────────────────────────── */

export interface PlayerEvaluation {
  id: string;
  activity_id: string;
  registration_id: string;
  coach_id: string;
  ratings: Record<string, number>;
  comment: string | null;
  created_at: string;
}

export const EVALUATION_CRITERIA = [
  "Attitude", "Effort", "Écoute", "Concentration", "Technique", "Dribble", "Passe", "Contrôle",
  "Tir", "Vitesse", "Compréhension du jeu", "Progression", "Confiance", "Communication", "Intensité", "Esprit d'équipe"
] as const;

export async function getActivityEvaluations(activityId: string): Promise<PlayerEvaluation[]> {
  const { data, error } = await db().from("player_evaluations").select("*").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerEvaluation[];
}

export async function getPlayerEvaluations(registrationId: string): Promise<(PlayerEvaluation & { activity: CoachActivity; coach: { first_name: string; last_name: string } })[]> {
  const { data, error } = await db()
    .from("player_evaluations")
    .select("*, activity:coach_activities(*), coach:coaches(first_name, last_name)")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as any;
}

export async function saveEvaluation(input: {
  activityId: string;
  registrationId: string;
  coachId: string;
  ratings: Record<string, number>;
  comment: string | null;
}): Promise<void> {
  const { error } = await db()
    .from("player_evaluations")
    .upsert(
      {
        activity_id: input.activityId,
        registration_id: input.registrationId,
        coach_id: input.coachId,
        ratings: input.ratings,
        comment: input.comment,
        updated_at: new Date().toISOString()
      },
      { onConflict: "activity_id,registration_id,coach_id" }
    );
  if (error) throw new Error(error.message);
}

/* ── Objectifs individuels ───────────────────────────────────────── */

export interface PlayerObjective {
  id: string;
  registration_id: string;
  objective: string;
  active: boolean;
  created_at: string;
}

export async function getPlayerObjectives(registrationId: string): Promise<PlayerObjective[]> {
  const { data, error } = await db()
    .from("player_objectives")
    .select("*")
    .eq("registration_id", registrationId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerObjective[];
}

export async function addPlayerObjective(registrationId: string, objective: string, coachId: string): Promise<void> {
  const { error } = await db().from("player_objectives").insert({ registration_id: registrationId, objective, created_by: coachId });
  if (error) throw new Error(error.message);
}

export async function deactivatePlayerObjective(id: string): Promise<void> {
  const { error } = await db().from("player_objectives").update({ active: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Historique de présence d'une joueuse ────────────────────────── */

export async function getPlayerAttendanceHistory(registrationId: string): Promise<(PlayerAttendance & { activity: CoachActivity })[]> {
  const { data, error } = await db()
    .from("activity_player_attendance")
    .select("*, activity:coach_activities(*)")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as any;
}
