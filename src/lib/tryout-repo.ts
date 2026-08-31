import { findOrCreatePlayer } from "@/lib/players-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { CriterionConfig, CriterionScoreInput, ThresholdsConfig } from "@/lib/tryout-scoring";

function db() {
  return getSupabaseAdminClient() as any;
}

export type TryoutEventStatus = "brouillon" | "en_cours" | "termine" | "archive";
export type TryoutAttendanceStatus = "attendu" | "present" | "absent" | "en_retard" | "parti_tot" | "blesse";

export interface TryoutEvent {
  id: string;
  name: string;
  event_date: string;
  start_time: string | null;
  location: string | null;
  terrain_id: string | null;
  status: TryoutEventStatus;
  age_category: string | null;
  organizer_notes: string | null;
  duplicated_from_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllEvents(): Promise<TryoutEvent[]> {
  const { data, error } = await db().from("tryout_events").select("*").order("event_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TryoutEvent[];
}

export async function getEventById(id: string): Promise<TryoutEvent | null> {
  const { data, error } = await db().from("tryout_events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as TryoutEvent | null;
}

export interface CreateEventInput {
  name: string;
  eventDate: string;
  startTime?: string | null;
  location?: string | null;
  terrainId?: string | null;
  ageCategory?: string | null;
  organizerNotes?: string | null;
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  const { data, error } = await db()
    .from("tryout_events")
    .insert({
      name: input.name,
      event_date: input.eventDate,
      start_time: input.startTime || null,
      location: input.location || null,
      terrain_id: input.terrainId || null,
      age_category: input.ageCategory || null,
      organizer_notes: input.organizerNotes || null
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateEvent(
  id: string,
  patch: Partial<{
    name: string;
    eventDate: string;
    startTime: string | null;
    location: string | null;
    terrainId: string | null;
    status: TryoutEventStatus;
    ageCategory: string | null;
    organizerNotes: string | null;
  }>
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) columnPatch.name = patch.name;
  if (patch.eventDate !== undefined) columnPatch.event_date = patch.eventDate;
  if (patch.startTime !== undefined) columnPatch.start_time = patch.startTime;
  if (patch.location !== undefined) columnPatch.location = patch.location;
  if (patch.terrainId !== undefined) columnPatch.terrain_id = patch.terrainId;
  if (patch.status !== undefined) columnPatch.status = patch.status;
  if (patch.ageCategory !== undefined) columnPatch.age_category = patch.ageCategory;
  if (patch.organizerNotes !== undefined) columnPatch.organizer_notes = patch.organizerNotes;
  const { error } = await db().from("tryout_events").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Duplique la structure d'un événement (équipes + configuration des
 *  critères si elle est surchargée) — jamais les athlètes ni les notes,
 *  comme demandé en section 2. */
export async function duplicateEvent(id: string, newName: string, newDate: string): Promise<string> {
  const supabase = db();
  const source = await getEventById(id);
  if (!source) throw new Error("Événement introuvable");

  const newId = await createEvent({
    name: newName,
    eventDate: newDate,
    location: source.location,
    terrainId: source.terrain_id,
    ageCategory: source.age_category
  });
  await db().from("tryout_events").update({ duplicated_from_id: id }).eq("id", newId);

  const { data: teams } = await supabase.from("tryout_teams").select("name, color_hex, display_order").eq("event_id", id);
  if (teams && teams.length > 0) {
    await supabase.from("tryout_teams").insert((teams as any[]).map((t) => ({ ...t, event_id: newId })));
  }

  const { data: config } = await supabase
    .from("tryout_criteria_config")
    .select("criteria, thresholds, double_scoring_enabled")
    .eq("event_id", id)
    .maybeSingle();
  if (config) {
    await supabase.from("tryout_criteria_config").insert({ ...config, event_id: newId });
  }

  return newId;
}

export async function archiveEvent(id: string): Promise<void> {
  await updateEvent(id, { status: "archive" });
}

/** Nombre de participantes par événement — pour la liste des événements. */
export async function getParticipantCounts(): Promise<Record<string, number>> {
  const { data, error } = await db().from("tryout_participants").select("event_id");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { event_id: string }[]) {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  }
  return counts;
}

export interface TryoutTeam {
  id: string;
  event_id: string;
  name: string;
  color_hex: string;
  display_order: number;
}

export async function getTeamsForEvent(eventId: string): Promise<TryoutTeam[]> {
  const { data, error } = await db().from("tryout_teams").select("*").eq("event_id", eventId).order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as TryoutTeam[];
}

export async function createTeam(eventId: string, name: string, colorHex: string): Promise<string> {
  const supabase = db();
  const { count } = await supabase.from("tryout_teams").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  const { data, error } = await supabase
    .from("tryout_teams")
    .insert({ event_id: eventId, name, color_hex: colorHex, display_order: count ?? 0 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteTeam(id: string): Promise<void> {
  await db().from("tryout_participants").update({ team_id: null }).eq("team_id", id);
  const { error } = await db().from("tryout_teams").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface TryoutParticipant {
  id: string;
  event_id: string;
  player_id: string;
  bib_number: number | null;
  team_id: string | null;
  attendance_status: TryoutAttendanceStatus;
  quick_note: string | null;
  primary_position_observed: string | null;
  is_trial: boolean;
  sweetheart: boolean;
  insufficient_data: boolean;
  current_club: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface TryoutParticipantWithPlayer extends TryoutParticipant {
  player_first_name: string;
  player_last_name: string;
  player_dob: string | null;
  player_photo_url: string | null;
}

export async function getParticipantsForEvent(eventId: string): Promise<TryoutParticipantWithPlayer[]> {
  const { data, error } = await db()
    .from("tryout_participants")
    .select("*, player:players(first_name, last_name, dob, photo_url)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    player_first_name: row.player?.first_name ?? "",
    player_last_name: row.player?.last_name ?? "",
    player_dob: row.player?.dob ?? null,
    player_photo_url: row.player?.photo_url ?? null
  }));
}

/** Ajoute une athlète déjà connue (players existant) à l'événement. Si elle
 *  y est déjà (unique(event_id, player_id)), ne fait rien et renvoie la
 *  ligne existante — jamais de doublon (section 3). */
export async function addParticipant(eventId: string, playerId: string): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase
    .from("tryout_participants")
    .insert({ event_id: eventId, player_id: playerId })
    .select("id")
    .single();
  if (!error) return data.id as string;
  if (error.code === "23505") {
    const { data: existing } = await supabase
      .from("tryout_participants")
      .select("id")
      .eq("event_id", eventId)
      .eq("player_id", playerId)
      .single();
    return existing.id as string;
  }
  throw new Error(error.message);
}

export async function removeParticipant(participantId: string): Promise<void> {
  const { error } = await db().from("tryout_participants").delete().eq("id", participantId);
  if (error) throw new Error(error.message);
}

/** Une source d'inscription possible pour l'ajout en lot — peu importe la
 *  saison ou le système (Été 2026/leads, Automne-Hiver/registrations,
 *  Sport-Études), pour transférer facilement des inscrites existantes vers
 *  un événement d'évaluation sans les chercher une par une. */
export type BulkAddSource =
  | { type: "ete2026" }
  | { type: "automne_hiver"; programId?: string }
  | { type: "automne_hiver_trials" }
  | { type: "sport_etudes" };

async function resolvePlayerIdsForSource(source: BulkAddSource): Promise<string[]> {
  const supabase = db();

  if (source.type === "ete2026") {
    const { data, error } = await supabase.from("leads").select("player_id").neq("status", "cancelled").not("player_id", "is", null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.player_id as string);
  }

  if (source.type === "automne_hiver" || source.type === "automne_hiver_trials") {
    let query = supabase.from("registrations").select("player_id").eq("season_id", "automne-hiver-2026").neq("status", "cancelled").not("player_id", "is", null);
    if (source.type === "automne_hiver_trials") query = query.eq("is_trial", true);
    else if (source.programId) query = query.eq("program_id", source.programId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.player_id as string);
  }

  // sport_etudes
  const { data, error } = await supabase.from("sport_etudes_registrations").select("player_id").in("status", ["confirmed", "paid"]).not("player_id", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.player_id as string);
}

/** Transfère toutes les athlètes d'une source (n'importe quelle saison) vers
 *  l'événement d'un coup — remplace la recherche une par une pour un
 *  transfert en lot. */
export async function bulkAddBySource(eventId: string, source: BulkAddSource): Promise<{ added: number; skipped: number }> {
  const supabase = db();
  const playerIds = await resolvePlayerIdsForSource(source);
  const isTrial = source.type === "automne_hiver_trials";

  let added = 0;
  let skipped = 0;
  for (const playerId of Array.from(new Set(playerIds))) {
    const { error: insertError } = await supabase.from("tryout_participants").insert({ event_id: eventId, player_id: playerId, is_trial: isTrial });
    if (insertError && insertError.code === "23505") skipped++;
    else if (insertError) throw new Error(insertError.message);
    else added++;
  }
  return { added, skipped };
}

export interface ExternalPlayerInput {
  firstName: string;
  lastName: string;
  dob: string;
  primaryPosition?: string | null;
  currentClub?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
}

/** Crée un athlète externe/essai directement dans la base d'athlètes
 *  principale (players) — jamais une table parallèle (section 3) — puis
 *  l'ajoute à l'événement avec ses infos de contact captées ici. */
export async function createExternalPlayerAndAdd(eventId: string, input: ExternalPlayerInput): Promise<{ playerId: string; participantId: string }> {
  const supabase = db();
  const { data: created, error: insertErr } = await supabase
    .from("players")
    .insert({ first_name: input.firstName, last_name: input.lastName, dob: input.dob, verified: true })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);
  const playerId = created.id as string;

  const { data: participant, error: partErr } = await supabase
    .from("tryout_participants")
    .insert({
      event_id: eventId,
      player_id: playerId,
      is_trial: true,
      primary_position_observed: input.primaryPosition || null,
      current_club: input.currentClub || null,
      parent_name: input.parentName || null,
      parent_email: input.parentEmail || null,
      parent_phone: input.parentPhone || null
    })
    .select("id")
    .single();
  if (partErr) throw new Error(partErr.message);

  return { playerId, participantId: participant.id as string };
}

export interface CsvImportRow {
  firstName: string;
  lastName: string;
  dob: string | null;
  parentEmail: string;
  parentPhone: string;
}

export interface CsvImportResult {
  added: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/** Import CSV en lot (section 3) — réutilise findOrCreatePlayer pour éviter
 *  les doublons avec des athlètes déjà connus de la même famille. */
export async function importCsvParticipants(eventId: string, rows: CsvImportRow[]): Promise<CsvImportResult> {
  const result: CsvImportResult = { added: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName || !row.lastName) {
      result.errors.push({ row: i + 1, message: "Prénom et nom requis" });
      continue;
    }
    try {
      const playerId = await findOrCreatePlayer({
        firstName: row.firstName,
        lastName: row.lastName,
        dob: row.dob,
        parentEmail: row.parentEmail,
        parentPhone: row.parentPhone
      });
      if (!playerId) {
        result.errors.push({ row: i + 1, message: "Impossible de créer l'athlète" });
        continue;
      }
      const { error } = await db().from("tryout_participants").insert({
        event_id: eventId,
        player_id: playerId,
        parent_email: row.parentEmail || null,
        parent_phone: row.parentPhone || null
      });
      if (error && error.code === "23505") result.skipped++;
      else if (error) result.errors.push({ row: i + 1, message: error.message });
      else result.added++;
    } catch (err) {
      result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Erreur inconnue" });
    }
  }
  return result;
}

export interface AthleteSearchResult {
  playerId: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  photoUrl: string | null;
  currentProgram: string | null;
  alreadyAdded: boolean;
}

/** Recherche universelle (section 3) dans toute la base d'athlètes du club —
 *  nom, prénom, année de naissance — avec le programme actuel calculé au
 *  meilleur effort (Automne/Hiver > Été 2026 > Sport-Études) et un badge
 *  « déjà ajouté » pour cet événement précis. */
export async function searchAthletes(query: string, eventId: string): Promise<AthleteSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = db();

  const isYear = /^\d{4}$/.test(q);
  let playerQuery = supabase.from("players").select("id, first_name, last_name, dob, photo_url").limit(20);
  playerQuery = isYear
    ? playerQuery.gte("dob", `${q}-01-01`).lte("dob", `${q}-12-31`)
    : playerQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  const { data: playerRows, error } = await playerQuery;
  if (error) throw new Error(error.message);

  const playerIds = (playerRows ?? []).map((p: any) => p.id);
  if (playerIds.length === 0) return [];

  const [{ data: regRows }, { data: leadRows }, { data: seRows }, { data: participantRows }] = await Promise.all([
    supabase
      .from("registrations")
      .select("player_id, season_id, program_id")
      .in("player_id", playerIds)
      .eq("season_id", "automne-hiver-2026")
      .neq("status", "cancelled"),
    supabase.from("leads").select("player_id").in("player_id", playerIds).neq("status", "cancelled"),
    supabase.from("sport_etudes_registrations").select("player_id").in("player_id", playerIds).in("status", ["confirmed", "paid"]),
    supabase.from("tryout_participants").select("player_id").eq("event_id", eventId).in("player_id", playerIds)
  ]);

  const programIds = Array.from(new Set((regRows ?? []).map((r: any) => r.program_id).filter(Boolean)));
  const { data: programRows } = programIds.length
    ? await supabase.from("programs").select("id, name").eq("season_id", "automne-hiver-2026").in("id", programIds)
    : { data: [] as { id: string; name: string }[] };
  const programNameById = new Map<string, string>((programRows ?? []).map((p: any) => [p.id, p.name]));

  const addedIds = new Set((participantRows ?? []).map((r: any) => r.player_id));

  return (playerRows ?? []).map((p: any) => {
    const reg = (regRows ?? []).find((r: any) => r.player_id === p.id) as any;
    const hasLead = (leadRows ?? []).some((r: any) => r.player_id === p.id);
    const hasSportEtudes = (seRows ?? []).some((r: any) => r.player_id === p.id);
    let currentProgram: string | null = null;
    if (reg) currentProgram = programNameById.get(reg.program_id) ?? "Automne/Hiver 2026";
    else if (hasLead) currentProgram = "Été 2026";
    else if (hasSportEtudes) currentProgram = "Sport-Études";

    return {
      playerId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      dob: p.dob,
      photoUrl: p.photo_url,
      currentProgram,
      alreadyAdded: addedIds.has(p.id)
    };
  });
}

/* ── Évaluateurs ──────────────────────────────────────────────────── */

export interface TryoutEvaluator {
  id: string;
  event_id: string;
  coach_id: string | null;
  guest_name: string | null;
  coach_first_name?: string;
  coach_last_name?: string;
}

export async function getEvaluatorsForEvent(eventId: string): Promise<TryoutEvaluator[]> {
  const { data, error } = await db()
    .from("tryout_evaluators")
    .select("*, coach:coaches(first_name, last_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    coach_first_name: row.coach?.first_name,
    coach_last_name: row.coach?.last_name
  }));
}

export async function addEvaluator(eventId: string, input: { coachId?: string; guestName?: string }): Promise<string> {
  const { data, error } = await db()
    .from("tryout_evaluators")
    .insert({ event_id: eventId, coach_id: input.coachId || null, guest_name: input.guestName || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function removeEvaluator(id: string): Promise<void> {
  const { error } = await db().from("tryout_evaluators").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Configuration des critères ──────────────────────────────────── */

export interface TryoutCriteriaConfig {
  criteria: CriterionConfig[];
  thresholds: ThresholdsConfig;
  doubleScoringEnabled: boolean;
}

/** Configuration propre à l'événement si elle existe, sinon la config par
 *  défaut globale (event_id null) — voir section 7. */
export async function getCriteriaConfigForEvent(eventId: string): Promise<TryoutCriteriaConfig> {
  const supabase = db();
  const { data: eventConfig } = await supabase
    .from("tryout_criteria_config")
    .select("criteria, thresholds, double_scoring_enabled")
    .eq("event_id", eventId)
    .maybeSingle();
  if (eventConfig) {
    return { criteria: eventConfig.criteria, thresholds: eventConfig.thresholds, doubleScoringEnabled: eventConfig.double_scoring_enabled };
  }
  const { data: defaultConfig, error } = await supabase
    .from("tryout_criteria_config")
    .select("criteria, thresholds, double_scoring_enabled")
    .is("event_id", null)
    .single();
  if (error) throw new Error(error.message);
  return { criteria: defaultConfig.criteria, thresholds: defaultConfig.thresholds, doubleScoringEnabled: defaultConfig.double_scoring_enabled };
}

/* ── Évaluations (notes) ──────────────────────────────────────────── */

export interface TryoutEvaluation {
  id: string;
  participant_id: string;
  evaluator_id: string;
  criteria_scores: Record<string, CriterionScoreInput>;
  comment: string | null;
  comment_internal: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Toutes les évaluations de l'événement (tous évaluateurs confondus) — pour
 *  la grille de progression (section 10) et la détection d'écarts (section 9). */
export async function getEvaluationsForEvent(eventId: string): Promise<TryoutEvaluation[]> {
  const supabase = db();
  const { data: participantRows, error: partErr } = await supabase.from("tryout_participants").select("id").eq("event_id", eventId);
  if (partErr) throw new Error(partErr.message);
  const participantIds = (participantRows ?? []).map((r: any) => r.id);
  if (participantIds.length === 0) return [];
  const { data, error } = await supabase.from("tryout_evaluations").select("*").in("participant_id", participantIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as TryoutEvaluation[];
}

export async function getEvaluationsForParticipant(participantId: string): Promise<TryoutEvaluation[]> {
  const { data, error } = await db().from("tryout_evaluations").select("*").eq("participant_id", participantId);
  if (error) throw new Error(error.message);
  return (data ?? []) as TryoutEvaluation[];
}

export async function getEvaluation(participantId: string, evaluatorId: string): Promise<TryoutEvaluation | null> {
  const { data, error } = await db()
    .from("tryout_evaluations")
    .select("*")
    .eq("participant_id", participantId)
    .eq("evaluator_id", evaluatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TryoutEvaluation | null;
}

/** Sauvegarde une évaluation (upsert) — appelée à chaque tap sur une note
 *  (section 8 : "Sauvegarde automatique à chaque tap"). Journalise chaque
 *  changement de critère dans tryout_evaluation_history (section 9). */
export async function saveEvaluation(
  participantId: string,
  evaluatorId: string,
  patch: {
    criteriaScores?: Record<string, CriterionScoreInput>;
    comment?: string | null;
    commentInternal?: boolean;
    completed?: boolean;
    changedBy?: string | null;
  }
): Promise<TryoutEvaluation> {
  const supabase = db();
  const existing = await getEvaluation(participantId, evaluatorId);

  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.criteriaScores !== undefined) columnPatch.criteria_scores = patch.criteriaScores;
  if (patch.comment !== undefined) columnPatch.comment = patch.comment;
  if (patch.commentInternal !== undefined) columnPatch.comment_internal = patch.commentInternal;
  if (patch.completed !== undefined) columnPatch.completed_at = patch.completed ? new Date().toISOString() : null;

  let row: any;
  if (existing) {
    const { data, error } = await supabase.from("tryout_evaluations").update(columnPatch).eq("id", existing.id).select("*").single();
    if (error) throw new Error(error.message);
    row = data;

    if (patch.criteriaScores) {
      const historyRows: Record<string, unknown>[] = [];
      for (const [critId, newVal] of Object.entries(patch.criteriaScores)) {
        const oldVal = existing.criteria_scores?.[critId];
        const oldStr = oldVal ? JSON.stringify(oldVal) : null;
        const newStr = JSON.stringify(newVal);
        if (oldStr !== newStr) {
          historyRows.push({ evaluation_id: existing.id, changed_by: patch.changedBy ?? null, field: critId, old_value: oldStr, new_value: newStr });
        }
      }
      if (historyRows.length > 0) await supabase.from("tryout_evaluation_history").insert(historyRows);
    }
  } else {
    const { data, error } = await supabase
      .from("tryout_evaluations")
      .insert({ participant_id: participantId, evaluator_id: evaluatorId, criteria_scores: patch.criteriaScores ?? {}, ...columnPatch })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    row = data;
  }

  return row as TryoutEvaluation;
}

/* ── Présence (section 6) ────────────────────────────────────────── */

export async function updateAttendance(
  participantId: string,
  patch: {
    attendanceStatus?: TryoutAttendanceStatus;
    bibNumber?: number | null;
    teamId?: string | null;
    quickNote?: string | null;
    primaryPositionObserved?: string | null;
    sweetheart?: boolean;
    insufficientData?: boolean;
  }
): Promise<void> {
  const columnPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.attendanceStatus !== undefined) columnPatch.attendance_status = patch.attendanceStatus;
  if (patch.bibNumber !== undefined) columnPatch.bib_number = patch.bibNumber;
  if (patch.teamId !== undefined) columnPatch.team_id = patch.teamId;
  if (patch.quickNote !== undefined) columnPatch.quick_note = patch.quickNote;
  if (patch.primaryPositionObserved !== undefined) columnPatch.primary_position_observed = patch.primaryPositionObserved;
  if (patch.sweetheart !== undefined) columnPatch.sweetheart = patch.sweetheart;
  if (patch.insufficientData !== undefined) columnPatch.insufficient_data = patch.insufficientData;
  const { error } = await db().from("tryout_participants").update(columnPatch).eq("id", participantId);
  if (error) throw new Error(error.message);
}

/* ── Progression (section 10) ────────────────────────────────────── */

export interface EventProgress {
  totalParticipants: number;
  present: number;
  evaluationsCompleted: number;
}

export async function getEventProgress(eventId: string): Promise<EventProgress> {
  const supabase = db();
  const { data: participants, error } = await supabase
    .from("tryout_participants")
    .select("id, attendance_status")
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);

  const participantIds = (participants ?? []).map((p: any) => p.id);
  const present = (participants ?? []).filter((p: any) => p.attendance_status === "present").length;

  let evaluationsCompleted = 0;
  if (participantIds.length > 0) {
    const { count } = await supabase
      .from("tryout_evaluations")
      .select("id", { count: "exact", head: true })
      .in("participant_id", participantIds)
      .not("completed_at", "is", null);
    evaluationsCompleted = count ?? 0;
  }

  return { totalParticipants: (participants ?? []).length, present, evaluationsCompleted };
}

/* ── Commentaires rapides (section 8) ────────────────────────────── */

export interface QuickComment {
  id: string;
  text: string;
  active: boolean;
  display_order: number;
}

export async function getQuickComments(): Promise<QuickComment[]> {
  const { data, error } = await db().from("tryout_quick_comments").select("*").eq("active", true).order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as QuickComment[];
}
