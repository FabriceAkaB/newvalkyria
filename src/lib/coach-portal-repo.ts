import { cleanNote, computeReport, feedbackByWeek, PARTICIPATED, QUICK_CRITERIA, REPORT_REQUIRED_TYPES, REPORT_RULE_START, watchReasons, type FeedbackWeek, type ReportStatus } from "@/lib/coach-report";
import type { CoachActivity, CoachAssignment } from "@/lib/coaches-repo";
import type { SurveyAnswer } from "@/lib/practice-survey";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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

/** Catégorie d'une activité sans le préfixe « Filles » ni le suffixe « avancé » (activités créées depuis Pratiques). */
export const cleanCategory = (c: string | null | undefined) => (c ?? "").replace(/^Filles\s+/i, "").replace(/\s*avancé$/i, "").trim() || null;

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
  const categories = Array.from(new Set(activities.map((a) => cleanCategory(a.activity.category)).filter((c): c is string => Boolean(c))));
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
  /** Photo de la fiche joueuse (déposée par la famille), pour que l'éducateur reconnaisse chaque fille. */
  photoUrl: string | null;
}

export interface RosterSlot {
  id: string;
  day: string;
  start_time: string;
  cats: string[];
}

export interface RosterRegistration {
  id: string;
  player_first_name: string | null;
  player_last_name: string | null;
  category_id: string | null;
  is_trial: boolean;
  trial_date: string | null;
  advanced_group: boolean;
  status: string;
  time_slot_template_id: string | null;
  players?: { photo_url: string | null } | null;
}

const WEEK_DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const toMinutes = (t: string) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Joueuses attendues à une activité. Si l'activité tombe sur une plage de la saison (même jour, début à
 *  15 minutes près, même année de naissance), ce sont les inscrites de cette plage — et non toute la catégorie,
 *  qui peut être répartie sur plusieurs soirs. Sinon, toutes les inscrites de la catégorie. Plus les essais du jour. */
export function rosterForActivity(activity: { activity_date: string; start_time: string; category: string | null }, slots: RosterSlot[], regs: RosterRegistration[]): RosterPlayer[] {
  const category = cleanCategory(activity.category);
  if (!category) return [];
  const years = category.match(/\d{4}/g) ?? [];
  const date = String(activity.activity_date).slice(0, 10);
  const day = WEEK_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const start = toMinutes(activity.start_time);
  const atTime = slots.filter((s) => s.day === day && Math.abs(toMinutes(s.start_time) - start) <= 15);
  const matched = years.length ? atTime.filter((s) => s.cats.some((c) => years.some((y) => c.includes(y)))) : atTime;
  const slotIds = new Set(matched.map((s) => s.id));
  const inGroup = (r: RosterRegistration) => (slotIds.size ? (r.time_slot_template_id ? slotIds.has(r.time_slot_template_id) : r.category_id === category) : r.category_id === category);

  return regs
    .filter((r) =>
      r.is_trial
        ? String(r.trial_date ?? "").slice(0, 10) === date && !["cancelled", "unavailable"].includes(r.status) && inGroup(r)
        : ["paid", "confirmed"].includes(r.status) && inGroup(r)
    )
    .map((r) => ({
      registrationId: r.id,
      firstName: r.player_first_name ?? "",
      lastName: r.player_last_name ?? "",
      birthYear: r.category_id,
      isTrial: r.is_trial,
      advancedGroup: r.advanced_group,
      photoUrl: r.players?.photo_url ?? null
    }))
    .sort((a, b) => Number(a.isTrial) - Number(b.isTrial) || a.firstName.localeCompare(b.firstName, "fr"));
}

const ROSTER_COLUMNS = "id, player_first_name, player_last_name, category_id, is_trial, trial_date, advanced_group, status, time_slot_template_id, players(photo_url)";

export async function loadRosterSources(seasonId: string = SEASON_DB_ID): Promise<{ slots: RosterSlot[]; regs: RosterRegistration[] }> {
  const [{ data: templates, error: e1 }, { data: cats, error: e2 }, { data: regs, error: e3 }] = await Promise.all([
    db().from("time_slot_templates").select("id, day, start_time, active").eq("active", true),
    db().from("time_slot_template_categories").select("time_slot_template_id, category_id"),
    db().from("registrations").select(ROSTER_COLUMNS).eq("season_id", seasonId).not("status", "in", "(cancelled,unavailable)")
  ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3).message);
  const slots = ((templates ?? []) as any[]).map((t) => ({
    id: t.id,
    day: t.day,
    start_time: String(t.start_time),
    cats: ((cats ?? []) as any[]).filter((c) => c.time_slot_template_id === t.id).map((c) => String(c.category_id))
  }));
  return { slots, regs: (regs ?? []) as RosterRegistration[] };
}

export async function getActivityRoster(activity: { activity_date: string; start_time: string; category: string | null }, seasonId: string = SEASON_DB_ID): Promise<RosterPlayer[]> {
  if (!activity.category) return [];
  const { slots, regs } = await loadRosterSources(seasonId);
  return rosterForActivity(activity, slots, regs);
}

/** Ancienne signature (catégorie + date) : passe par la même règle que getActivityRoster. */
export async function getExpectedRoster(seasonId: string, category: string | null, activityDate: string, startTime = "00:00"): Promise<RosterPlayer[]> {
  return getActivityRoster({ activity_date: activityDate, start_time: startTime, category }, seasonId);
}

/* ── Présences des joueuses ──────────────────────────────────────── */

export type PlayerAttendanceStatus = "present" | "absent" | "injured" | "late" | "left_early";

export interface PlayerAttendance {
  id: string;
  activity_id: string;
  registration_id: string;
  status: PlayerAttendanceStatus;
  /** Routine de fin : note de la pratique donnée par la joueuse, sur 10. */
  practice_rating: number | null;
  /** Routine de fin : fatigue de la joueuse, sur 10. */
  fatigue: number | null;
  /** Sondage de fin : ce qu'elle aimerait avoir plus (clés de WANTS_MORE) et un mot libre. */
  wants_more?: string[] | null;
  wants_more_note?: string | null;
}

export async function getActivityAttendance(activityId: string): Promise<PlayerAttendance[]> {
  const { data, error } = await db().from("activity_player_attendance").select("*").eq("activity_id", activityId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerAttendance[];
}

export async function setPlayerAttendance(activityId: string, registrationId: string | string[], status: PlayerAttendanceStatus): Promise<void> {
  const ids = Array.isArray(registrationId) ? registrationId : [registrationId];
  if (!ids.length) return;
  const now = new Date().toISOString();
  const { error } = await db()
    .from("activity_player_attendance")
    .upsert(ids.map((id) => ({ activity_id: activityId, registration_id: id, status, updated_at: now })), { onConflict: "activity_id,registration_id" });
  if (error) throw new Error(error.message);
}

/** Sondage de fin : plaisir et fatigue (sur 10) et ce que la joueuse aimerait avoir plus, saisis par l'éducateur ou JP.
 *  Crée la ligne de présence (présente) si elle n'avait pas encore été marquée. */
export async function setPlayerFeedback(activityId: string, registrationId: string, answer: SurveyAnswer): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("activity_player_attendance")
    .upsert(
      {
        activity_id: activityId,
        registration_id: registrationId,
        practice_rating: answer.practiceRating,
        fatigue: answer.fatigue,
        wants_more: answer.wantsMore,
        wants_more_note: answer.wantsMoreNote,
        feedback_at: now,
        updated_at: now
      },
      { onConflict: "activity_id,registration_id" }
    );
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

/** Critères connus, dans l'ordre d'affichage : d'abord les 3 échelles de l'évaluation rapide (après chaque
 *  pratique), puis les critères de l'ancienne grille détaillée, gardés pour l'historique. */
export const EVALUATION_CRITERIA = [
  ...QUICK_CRITERIA,
  "Effort", "Écoute", "Concentration", "Technique", "Dribble", "Passe", "Contrôle",
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

/* ── Routines maison ──────────────────────────────────────────────
 *  Liste d'exercices de la bibliothèque partagée assignée à une joueuse
 *  pour pratiquer entre les séances — même convention que les objectifs
 *  (désactivation, pas de suppression, pour garder l'historique). */

export interface PlayerRoutine {
  id: string;
  registration_id: string;
  title: string;
  notes: string | null;
  exercise_ids: string[];
  active: boolean;
  created_at: string;
}

export async function getPlayerRoutines(registrationId: string): Promise<PlayerRoutine[]> {
  const { data, error } = await db()
    .from("player_routines")
    .select("*")
    .eq("registration_id", registrationId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlayerRoutine[];
}

export async function addPlayerRoutine(registrationId: string, input: { title: string; notes: string | null; exerciseIds: string[] }, coachId: string): Promise<void> {
  const { error } = await db().from("player_routines").insert({
    registration_id: registrationId,
    title: input.title,
    notes: input.notes,
    exercise_ids: input.exerciseIds,
    created_by: coachId
  });
  if (error) throw new Error(error.message);
}

export async function deactivatePlayerRoutine(id: string): Promise<void> {
  const { error } = await db().from("player_routines").update({ active: false }).eq("id", id);
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


/* ── Bulletin de progression — agrégat en lecture seule des données déjà
 *  enregistrées ci-dessus (présences, évaluations, objectifs). N'invente
 *  jamais rien : une moyenne n'est calculée que sur les critères réellement
 *  notés au moins une fois, aucun texte n'est généré automatiquement. ── */

export interface BulletinCriterionAverage {
  criterion: string;
  average: number;
  count: number;
}

export interface BulletinTrend {
  criterion: string;
  /** Moyenne des 3 premières évaluations de la saison et des 3 dernières (null s'il en manque). */
  start: number | null;
  recent: number | null;
}

export interface BulletinData {
  player: PlayerProfile;
  attendanceCounts: Record<PlayerAttendanceStatus, number>;
  totalActivities: number;
  criteriaAverages: BulletinCriterionAverage[];
  /** Évolution des 3 échelles de l'évaluation rapide sur la saison. */
  trends: BulletinTrend[];
  /** Routine de fin : moyenne des notes de pratique et de la fatigue données par la joueuse (sur 10). */
  feedback: { count: number; rating: number | null; fatigue: number | null };
  evaluations: (PlayerEvaluation & { activity: CoachActivity; coach: { first_name: string; last_name: string } })[];
  objectives: PlayerObjective[];
  /** Les notes des éducateurs sont des notes de travail internes (elles peuvent parler d'autres enfants) :
   *  la version parent ne les contient pas. */
  showNotes: boolean;
}

export async function getBulletinData(registrationId: string, audience: "equipe" | "parent" = "equipe"): Promise<BulletinData | null> {
  const player = await getPlayerProfile(registrationId);
  if (!player) return null;

  const [attendance, evaluations, objectives] = await Promise.all([
    getPlayerAttendanceHistory(registrationId),
    getPlayerEvaluations(registrationId),
    getPlayerObjectives(registrationId)
  ]);

  const attendanceCounts: Record<PlayerAttendanceStatus, number> = { present: 0, absent: 0, injured: 0, late: 0, left_early: 0 };
  for (const a of attendance) attendanceCounts[a.status] += 1;

  const sums = new Map<string, { sum: number; count: number }>();
  for (const ev of evaluations) {
    for (const [criterion, value] of Object.entries(ev.ratings)) {
      const s = sums.get(criterion) ?? { sum: 0, count: 0 };
      s.sum += value;
      s.count += 1;
      sums.set(criterion, s);
    }
  }
  const criteriaAverages: BulletinCriterionAverage[] = EVALUATION_CRITERIA.filter((c) => sums.has(c)).map((c) => {
    const s = sums.get(c)!;
    return { criterion: c, average: Math.round((s.sum / s.count) * 10) / 10, count: s.count };
  });

  const chronological = [...evaluations].sort((a, b) => String(a.activity?.activity_date).localeCompare(String(b.activity?.activity_date)));
  const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10 : null);
  const trends: BulletinTrend[] = QUICK_CRITERIA.map((c) => {
    const vals = chronological.map((e) => Number(e.ratings?.[c])).filter((v) => v >= 1 && v <= 5);
    return { criterion: c, start: vals.length >= 4 ? avg(vals.slice(0, 3)) : null, recent: vals.length >= 4 ? avg(vals.slice(-3)) : null };
  }).filter((t) => t.start !== null);

  const ratings = attendance.map((a) => a.practice_rating).filter((v): v is number => v != null);
  const fatigues = attendance.map((a) => a.fatigue).filter((v): v is number => v != null);

  return {
    player,
    attendanceCounts,
    totalActivities: attendance.length,
    criteriaAverages,
    trends,
    feedback: { count: Math.max(ratings.length, fatigues.length), rating: avg(ratings), fatigue: avg(fatigues) },
    evaluations: audience === "parent" ? evaluations.map((e) => ({ ...e, comment: null })) : evaluations,
    objectives,
    showNotes: audience !== "parent"
  };
}

/* ── Accès de l'éducateur (strict nécessaire) ─────────────────────────
 *  Un éducateur ne voit et ne touche que les joueuses de ses groupes (ou à l'essai le jour d'une de ses
 *  activités), et seulement les activités où il est assigné. Jamais de prix, de paiement ni de parent. */

export async function coachCanSeePlayer(coachId: string, registrationId: string): Promise<boolean> {
  const [activities, { data: reg }] = await Promise.all([
    getCoachActivities(coachId),
    db().from("registrations").select("id, category_id, is_trial, trial_date").eq("id", registrationId).maybeSingle()
  ]);
  if (!reg) return false;
  const categories = new Set(activities.map((a) => cleanCategory(a.activity.category)).filter(Boolean));
  if (reg.category_id && categories.has(reg.category_id)) return true;
  return Boolean(reg.is_trial && reg.trial_date && activities.some((a) => String(a.activity.activity_date).slice(0, 10) === String(reg.trial_date).slice(0, 10)));
}

/** Joueuse d'un objectif ou d'une routine, pour vérifier l'accès avant de le retirer. */
export async function registrationOfItem(table: "player_objectives" | "player_routines", id: string): Promise<string | null> {
  const { data } = await db().from(table).select("registration_id").eq("id", id).maybeSingle();
  return (data?.registration_id as string | undefined) ?? null;
}

/** L'activité de ce coach et ses joueuses attendues, ou null si l'activité ne lui appartient pas. */
export async function getCoachActivityWithRoster(coachId: string, activityId: string): Promise<(CoachActivityWithAssignment & { roster: RosterPlayer[] }) | null> {
  const entry = await getCoachActivityById(coachId, activityId);
  if (!entry) return null;
  return { ...entry, roster: await getActivityRoster(entry.activity) };
}

/* ── Contrôle de qualité des notes ─────────────────────────────────── */

const playerName = (r: { player_first_name?: string | null; player_last_name?: string | null } | null | undefined) =>
  `${r?.player_first_name ?? ""} ${r?.player_last_name ?? ""}`.replace(/\s+/g, " ").trim() || "une joueuse";

/** Notes déjà écrites pour les autres joueuses de cette activité (tous les éducateurs). */
export async function getActivityNotes(activityId: string, exceptRegistrationId: string): Promise<{ playerName: string; note: string }[]> {
  const { data, error } = await db()
    .from("player_evaluations")
    .select("registration_id, comment, registration:registrations(player_first_name, player_last_name)")
    .eq("activity_id", activityId)
    .neq("registration_id", exceptRegistrationId)
    .not("comment", "is", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ playerName: playerName(r.registration), note: cleanNote(r.comment) }));
}

/** Notes écrites par ce même éducateur dans ses autres séances des 6 derniers mois. */
export async function getCoachPreviousNotes(coachId: string, exceptActivityId: string): Promise<{ playerName: string; note: string; date: string }[]> {
  const since = new Date(Date.now() - 183 * 86400000).toISOString();
  const { data, error } = await db()
    .from("player_evaluations")
    .select("comment, activity_id, activity:coach_activities(activity_date), registration:registrations(player_first_name, player_last_name)")
    .eq("coach_id", coachId)
    .neq("activity_id", exceptActivityId)
    .not("comment", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ playerName: playerName(r.registration), note: cleanNote(r.comment), date: String(r.activity?.activity_date ?? "").slice(0, 10) }));
}

/* ── Rapports des activités (présences + évaluations), en lot ───────── */

export interface ReportActivity {
  id: string;
  activity_date: string;
  start_time: string;
  category: string | null;
  activity_type: string;
  organization?: string | null;
}

/** Rapport de chaque activité soumise à la règle (pratiques depuis REPORT_RULE_START). Les autres n'y sont pas. */
export async function getActivityReports(activities: ReportActivity[]): Promise<Map<string, ReportStatus>> {
  const concerned = activities.filter((a) => String(a.activity_date).slice(0, 10) >= REPORT_RULE_START && REPORT_REQUIRED_TYPES.includes(a.activity_type) && !a.organization);
  const out = new Map<string, ReportStatus>();
  if (!concerned.length) return out;
  const ids = concerned.map((a) => a.id);
  const [{ slots, regs }, { data: att, error: e1 }, { data: evals, error: e2 }] = await Promise.all([
    loadRosterSources(),
    db().from("activity_player_attendance").select("activity_id, registration_id, status, practice_rating, fatigue").in("activity_id", ids),
    db().from("player_evaluations").select("activity_id, registration_id, ratings, comment").in("activity_id", ids)
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2).message);
  for (const a of concerned) {
    const roster = rosterForActivity(a, slots, regs);
    out.set(
      a.id,
      computeReport({
        activity: a,
        roster: roster.map((p) => ({ registrationId: p.registrationId, name: `${p.firstName} ${p.lastName}`.trim() })),
        attendance: ((att ?? []) as any[]).filter((r) => r.activity_id === a.id),
        evaluations: ((evals ?? []) as any[]).filter((r) => r.activity_id === a.id)
      })
    );
  }
  return out;
}

/** Relance de présence envoyée (une seule par assignation). */
export async function markPresenceReminded(assignmentIds: string[]): Promise<void> {
  if (!assignmentIds.length) return;
  const { error } = await db().from("coach_assignments").update({ reminder_sent_at: new Date().toISOString() }).in("id", assignmentIds);
  if (error) throw new Error(error.message);
}

/* ── Routine de fin : appréciation des joueuses par semaine ─────────── */

export async function getFeedbackWeeks(sinceISO?: string): Promise<FeedbackWeek[]> {
  let q = db()
    .from("activity_player_attendance")
    .select("practice_rating, fatigue, status, activity:coach_activities(activity_date)")
    .or("practice_rating.not.is.null,fatigue.not.is.null");
  if (sinceISO) q = q.gte("feedback_at", sinceISO);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return feedbackByWeek(
    ((data ?? []) as any[])
      .filter((r) => PARTICIPATED.includes(r.status) && r.activity?.activity_date)
      .map((r) => ({ date: String(r.activity.activity_date).slice(0, 10), practice_rating: r.practice_rating, fatigue: r.fatigue }))
  );
}

/* ── Briefing de 5 minutes avant la séance (P1.4.01) ─────────────────
 *  Les fiches joueuses à connaître avant de commencer : filles à suivre (attitude, fatigue, baisse),
 *  objectifs individuels, essais du jour, absentes la dernière fois. */

export interface BriefingPlayer {
  registrationId: string;
  name: string;
  isTrial: boolean;
  objectives: string[];
  watch: string[];
  absentLastTime: boolean;
}

export async function getBriefing(activity: { id: string; activity_date: string }, roster: RosterPlayer[]): Promise<BriefingPlayer[]> {
  const ids = roster.map((p) => p.registrationId);
  if (!ids.length) return [];
  const date = String(activity.activity_date).slice(0, 10);
  const [{ data: objectives }, { data: evals }, { data: att }] = await Promise.all([
    db().from("player_objectives").select("registration_id, objective").in("registration_id", ids).eq("active", true),
    db().from("player_evaluations").select("registration_id, ratings, activity:coach_activities(activity_date)").in("registration_id", ids),
    db().from("activity_player_attendance").select("registration_id, status, practice_rating, fatigue, activity_id, activity:coach_activities(activity_date)").in("registration_id", ids)
  ]);
  const before = (r: any) => {
    const d = String(r.activity?.activity_date ?? "").slice(0, 10);
    return d && d < date ? d : null;
  };
  return roster
    .map((p) => {
      const ev = ((evals ?? []) as any[]).filter((e) => e.registration_id === p.registrationId && before(e)).sort((a, b) => before(a)!.localeCompare(before(b)!));
      const at = ((att ?? []) as any[]).filter((a) => a.registration_id === p.registrationId && before(a) && a.activity_id !== activity.id).sort((a, b) => before(a)!.localeCompare(before(b)!));
      return {
        registrationId: p.registrationId,
        name: `${p.firstName} ${p.lastName}`.trim(),
        isTrial: p.isTrial,
        objectives: ((objectives ?? []) as any[]).filter((o) => o.registration_id === p.registrationId).map((o) => String(o.objective)),
        watch: watchReasons({
          evaluations: ev.map((e) => ({ date: before(e)!, ratings: e.ratings })),
          feedback: at.filter((a) => a.practice_rating != null || a.fatigue != null).map((a) => ({ date: before(a)!, practice_rating: a.practice_rating, fatigue: a.fatigue }))
        }),
        absentLastTime: at.length > 0 && at[at.length - 1].status === "absent"
      };
    })
    .filter((p) => p.isTrial || p.objectives.length || p.watch.length || p.absentLastTime)
    .sort((a, b) => b.watch.length - a.watch.length || Number(b.isTrial) - Number(a.isTrial) || a.name.localeCompare(b.name, "fr"));
}

export async function setSurpriseMoment(activityId: string, text: string | null): Promise<void> {
  const { error } = await db().from("coach_activities").update({ surprise_moment: text?.trim().slice(0, 1000) || null, updated_at: new Date().toISOString() }).eq("id", activityId);
  if (error) throw new Error(error.message);
}
