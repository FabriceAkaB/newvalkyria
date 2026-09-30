import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const MATCH_POSITIONS = ["GB", "AD", "DC", "AG", "MDC", "MC", "MOC", "AiD", "AiG", "AT"] as const;
export type MatchPosition = (typeof MATCH_POSITIONS)[number];

export type MatchStatus = "scheduled" | "live" | "completed" | "cancelled";
export type ConvocationStatus = "convoked" | "confirmed" | "declined" | "absent";

export interface MatchDetails {
  activity_id: string;
  opponent_name: string;
  home_away: "home" | "away";
  formation: string | null;
  status: MatchStatus;
  final_score_us: number | null;
  final_score_them: number | null;
  created_at: string;
  updated_at: string;
}

export async function getMatchDetails(activityId: string): Promise<MatchDetails | null> {
  const { data, error } = await db().from("match_details").select("*").eq("activity_id", activityId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as MatchDetails | null;
}

export async function upsertMatchDetails(activityId: string, input: {
  opponentName: string;
  homeAway: "home" | "away";
  formation: string | null;
}): Promise<void> {
  const { error } = await db().from("match_details").upsert({
    activity_id: activityId,
    opponent_name: input.opponentName,
    home_away: input.homeAway,
    formation: input.formation
  });
  if (error) throw new Error(error.message);
}

export async function updateMatchStatus(activityId: string, status: MatchStatus): Promise<void> {
  const { error } = await db().from("match_details").update({ status, updated_at: new Date().toISOString() }).eq("activity_id", activityId);
  if (error) throw new Error(error.message);
}

export async function updateMatchScore(activityId: string, finalScoreUs: number | null, finalScoreThem: number | null): Promise<void> {
  const { error } = await db().from("match_details").update({ final_score_us: finalScoreUs, final_score_them: finalScoreThem, updated_at: new Date().toISOString() }).eq("activity_id", activityId);
  if (error) throw new Error(error.message);
}

/* ── Effectif disponible (mêmes règles que getExpectedRoster, avec photo) ── */

export interface MatchRosterPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isTrial: boolean;
  advancedGroup: boolean;
}

export async function getMatchRoster(seasonId: string, category: string | null, activityDate: string): Promise<MatchRosterPlayer[]> {
  if (!category) return [];
  const supabase = db();

  const { data: regular, error: e1 } = await supabase
    .from("registrations")
    .select("id, player_first_name, player_last_name, is_trial, advanced_group, players(photo_url)")
    .eq("season_id", seasonId)
    .eq("category_id", category)
    .eq("is_trial", false)
    .in("status", ["paid", "confirmed"]);
  if (e1) throw new Error(e1.message);

  const { data: trials, error: e2 } = await supabase
    .from("registrations")
    .select("id, player_first_name, player_last_name, is_trial, advanced_group, players(photo_url)")
    .eq("season_id", seasonId)
    .eq("is_trial", true)
    .eq("trial_date", activityDate);
  if (e2) throw new Error(e2.message);

  const rows = [...(regular ?? []), ...(trials ?? [])] as any[];
  return rows.map((r) => ({
    registrationId: r.id,
    firstName: r.player_first_name ?? "",
    lastName: r.player_last_name ?? "",
    photoUrl: r.players?.photo_url ?? null,
    isTrial: r.is_trial,
    advancedGroup: r.advanced_group
  }));
}

/* ── Convocations ──────────────────────────────────────────────── */

export interface MatchConvocation {
  id: string;
  activity_id: string;
  registration_id: string;
  status: ConvocationStatus;
}

export async function getConvocations(activityId: string): Promise<MatchConvocation[]> {
  const { data, error } = await db().from("match_convocations").select("*").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchConvocation[];
}

export async function setConvocation(activityId: string, registrationId: string, status: ConvocationStatus): Promise<void> {
  const { error } = await db().from("match_convocations").upsert(
    { activity_id: activityId, registration_id: registrationId, status },
    { onConflict: "activity_id,registration_id" }
  );
  if (error) throw new Error(error.message);
}

export async function removeConvocation(activityId: string, registrationId: string): Promise<void> {
  const { error } = await db().from("match_convocations").delete().eq("activity_id", activityId).eq("registration_id", registrationId);
  if (error) throw new Error(error.message);
}

/* ── Alignement visuel (formation) ────────────────────────────────
 *  Mêmes coordonnées en pourcentage (0-100) que le constructeur de
 *  schémas d'exercice — réutilise le même principe de terrain SVG. */

export interface MatchLineupSlot {
  id: string;
  activity_id: string;
  registration_id: string;
  position_code: string | null;
  x: number | null;
  y: number | null;
  is_starter: boolean;
}

export async function getLineup(activityId: string): Promise<MatchLineupSlot[]> {
  const { data, error } = await db().from("match_lineup_slots").select("*").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchLineupSlot[];
}

export async function setLineupSlot(activityId: string, registrationId: string, patch: {
  positionCode?: string | null;
  x?: number | null;
  y?: number | null;
  isStarter?: boolean;
}): Promise<void> {
  const existing = await db().from("match_lineup_slots").select("id").eq("activity_id", activityId).eq("registration_id", registrationId).maybeSingle();
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.positionCode !== undefined) columnPatch.position_code = patch.positionCode;
  if (patch.x !== undefined) columnPatch.x = patch.x;
  if (patch.y !== undefined) columnPatch.y = patch.y;
  if (patch.isStarter !== undefined) columnPatch.is_starter = patch.isStarter;

  if (existing.data) {
    const { error } = await db().from("match_lineup_slots").update(columnPatch).eq("id", existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db().from("match_lineup_slots").insert({
      activity_id: activityId,
      registration_id: registrationId,
      position_code: patch.positionCode ?? null,
      x: patch.x ?? null,
      y: patch.y ?? null,
      is_starter: patch.isStarter ?? true
    });
    if (error) throw new Error(error.message);
  }
}

export async function removeLineupSlot(activityId: string, registrationId: string): Promise<void> {
  const { error } = await db().from("match_lineup_slots").delete().eq("activity_id", activityId).eq("registration_id", registrationId);
  if (error) throw new Error(error.message);
}

/* ── Temps de jeu (chronomètre + substitutions) ───────────────────
 *  Une "entrée" ouverte (minute_out = null) = la joueuse est sur le
 *  terrain en ce moment. Le minutage total se recalcule en lecture, jamais
 *  stocké — pas de source de vérité dupliquée. */

export interface PlaytimeSegment {
  id: string;
  activity_id: string;
  registration_id: string;
  minute_in: number;
  minute_out: number | null;
}

export async function getPlaytimeSegments(activityId: string): Promise<PlaytimeSegment[]> {
  const { data, error } = await db().from("match_playtime_segments").select("*").eq("activity_id", activityId).order("minute_in");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlaytimeSegment[];
}

/** Fait entrer une joueuse sur le terrain — refuse si elle y est déjà. */
export async function substituteIn(activityId: string, registrationId: string, minute: number): Promise<void> {
  const { data: open } = await db().from("match_playtime_segments").select("id").eq("activity_id", activityId).eq("registration_id", registrationId).is("minute_out", null).maybeSingle();
  if (open) return;
  const { error } = await db().from("match_playtime_segments").insert({ activity_id: activityId, registration_id: registrationId, minute_in: minute });
  if (error) throw new Error(error.message);
}

/** Fait sortir une joueuse — ferme son segment ouvert le plus récent. */
export async function substituteOut(activityId: string, registrationId: string, minute: number): Promise<void> {
  const { data: open, error: e1 } = await db().from("match_playtime_segments").select("id").eq("activity_id", activityId).eq("registration_id", registrationId).is("minute_out", null).order("minute_in", { ascending: false }).limit(1).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!open) return;
  const { error } = await db().from("match_playtime_segments").update({ minute_out: minute }).eq("id", open.id);
  if (error) throw new Error(error.message);
}

/** Correction manuelle après-coup d'un segment (ex. minutage erroné en direct). */
export async function updatePlaytimeSegment(id: string, patch: { minuteIn?: number; minuteOut?: number | null }): Promise<void> {
  const columnPatch: Record<string, unknown> = {};
  if (patch.minuteIn !== undefined) columnPatch.minute_in = patch.minuteIn;
  if (patch.minuteOut !== undefined) columnPatch.minute_out = patch.minuteOut;
  const { error } = await db().from("match_playtime_segments").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePlaytimeSegment(id: string): Promise<void> {
  const { error } = await db().from("match_playtime_segments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function computeTotalMinutes(segments: PlaytimeSegment[], registrationId: string, matchEndMinute: number): number {
  return segments
    .filter((s) => s.registration_id === registrationId)
    .reduce((sum, s) => sum + ((s.minute_out ?? matchEndMinute) - s.minute_in), 0);
}

/* ── Évaluations post-match (par position, échelle configurable) ─── */

export interface MatchPlayerEvaluation {
  id: string;
  activity_id: string;
  registration_id: string;
  coach_id: string;
  position_code: string | null;
  scale: 10 | 100;
  score: number | null;
  comment: string | null;
}

export async function getMatchEvaluations(activityId: string): Promise<MatchPlayerEvaluation[]> {
  const { data, error } = await db().from("match_player_evaluations").select("*").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchPlayerEvaluation[];
}

export async function saveMatchEvaluation(input: {
  activityId: string;
  registrationId: string;
  coachId: string;
  positionCode: string | null;
  scale: 10 | 100;
  score: number | null;
  comment: string | null;
}): Promise<void> {
  const { error } = await db().from("match_player_evaluations").upsert(
    {
      activity_id: input.activityId,
      registration_id: input.registrationId,
      coach_id: input.coachId,
      position_code: input.positionCode,
      scale: input.scale,
      score: input.score,
      comment: input.comment,
      updated_at: new Date().toISOString()
    },
    { onConflict: "activity_id,registration_id,coach_id" }
  );
  if (error) throw new Error(error.message);
}
