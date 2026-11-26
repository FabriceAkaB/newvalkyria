import { getBulletinReport, type BulletinReportData } from "@/lib/bulletin-repo";
import { getPlayerAttendanceHistory, getPlayerObjectives, getPlayerProfile, getPlayerRoutines, getCoachPlayers, type PlayerObjective, type PlayerRoutine } from "@/lib/coach-portal-repo";
import { getFamilyParcours, type FamilyParcours } from "@/lib/family-passport-repo";
import { canWatch } from "@/lib/match-videos-core";
import { listMatchVideos, posterOf } from "@/lib/match-videos";
import { loadExpectedPlayers } from "@/lib/mcs-robot-runner";
import { personKey } from "@/lib/mcs-rules";
import { alignAttendance, attendanceRate, NO_ANSWER } from "@/lib/player-attendance";
import { listBadges, type ListBadge, type SurveyRow } from "@/lib/player-dossier";
import { getPlayerReports, type PlayerReport } from "@/lib/player-reports-repo";
import { getChampionTitles, getPointsSummaries, type PointsSummary } from "@/lib/player-points-repo";
import type { ChampionTitle } from "@/lib/champion-titles";
import type { PlayerIncident } from "@/lib/player-incidents-repo";
import { getPlayerIncidents } from "@/lib/player-incidents-repo";
import { getSheetsForRegistrations } from "@/lib/player-sheet-repo";
import type { SheetAnswers } from "@/lib/player-sheet";
import { getFamilyProgressVideos, getPlayerVideoFiche, type PlayerVideoFiche, type ProgressVideo } from "@/lib/progress-videos-repo";
import type { Checkpoint } from "@/lib/progress-videos";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import type { SeasonSummary } from "@/lib/season-summary";
import { getSeasonSummary } from "@/lib/season-summary-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Dossier complet d'une joueuse pour l'équipe d'éducateurs (JP, 26 nov. 2026). Tout est lu EN PARALLÈLE ; jamais de
 *  prix, de paiement ni de coordonnées du parent. Les notes internes des éducateurs restent à l'équipe ; la section
 *  « Ce que voit la famille » est préparée avec l'audience « parent » (sans notes, mêmes règles que /compte/progression). */

function db() {
  return getSupabaseAdminClient() as any;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const day = (v: unknown) => String(v ?? "").slice(0, 10);
const shift = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const cap = (x: string) => x.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
const slotLabel = (s: { day: string; start_time: string } | undefined) => (s ? `${s.day} ${String(s.start_time).slice(0, 5).replace(":", " h ")}` : null);

/* ── La liste : toutes les filles de l'Académie ───────────────────────────────────────────────────────────── */

export interface DossierListPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  category: string | null;
  advanced: boolean;
  /** Plage de la saison (« Lundi 18 h 00 »). */
  group: string | null;
  photoUrl: string | null;
  /** Dans un groupe où cet éducateur a une activité. */
  mine: boolean;
  badges: ListBadge[];
}

export async function getDossierPlayers(coachId: string, seasonId: string = SEASON_DB_ID): Promise<DossierListPlayer[]> {
  const { data: regs, error } = await db()
    .from("registrations")
    .select("id, player_first_name, player_last_name, category_id, advanced_group, time_slot_template_id, player_id")
    .eq("season_id", seasonId)
    .eq("is_trial", false)
    .in("status", ["paid", "confirmed"]);
  if (error) throw new Error(error.message);
  const rows = (regs ?? []) as any[];
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const since = shift(today(), -28);
  const playerIds = [...new Set(rows.map((r) => r.player_id).filter(Boolean))];
  const slotIds = [...new Set(rows.map((r) => r.time_slot_template_id).filter(Boolean))];
  const [mine, { data: slots }, { data: players }, { data: evals }, { data: att }, { data: inc }, { data: acts }] = await Promise.all([
    getCoachPlayers(coachId, seasonId).catch(() => []),
    slotIds.length ? db().from("time_slot_templates").select("id, day, start_time").in("id", slotIds) : Promise.resolve({ data: [] }),
    playerIds.length ? db().from("players").select("id, photo_url").in("id", playerIds) : Promise.resolve({ data: [] }),
    db().from("player_evaluations").select("registration_id, activity:coach_activities(activity_date)").in("registration_id", ids).limit(10000),
    db().from("activity_player_attendance").select("registration_id, status, activity_id, activity:coach_activities!inner(id, activity_date, activity_type, mcs_expected, mcs_cancelled)").in("registration_id", ids).gte("activity.activity_date", since).lte("activity.activity_date", today()).limit(10000),
    db().from("player_incidents").select("registration_id, status").in("registration_id", ids).neq("status", "fermee"),
    // Pratiques lues dans MonClubSportif (filles attendues) : le dénominateur des présences récentes.
    db().from("coach_activities").select("id, activity_date, activity_type, mcs_expected, mcs_cancelled").eq("activity_type", "Pratique").not("mcs_expected", "is", null).gte("activity_date", since).lt("activity_date", today()).limit(2000)
  ]);
  const mineIds = new Set(mine.map((m) => m.registrationId));
  const slot = new Map(((slots ?? []) as any[]).map((s) => [s.id, s]));
  const photo = new Map(((players ?? []) as any[]).map((p) => [p.id, p.photo_url as string | null]));
  const lastEval = new Map<string, string>();
  for (const e of (evals ?? []) as any[]) {
    const d = day(e.activity?.activity_date);
    if (d && d > (lastEval.get(e.registration_id) ?? "")) lastEval.set(e.registration_id, d);
  }
  // Présences des 4 dernières semaines, MonClubSportif faisant foi (player-attendance.ts).
  const asAlign = (a: any) => ({ id: a.id, date: day(a.activity_date), mcsExpected: Array.isArray(a.mcs_expected) ? a.mcs_expected : null, mcsCancelled: !!a.mcs_cancelled });
  const expectedActs = ((acts ?? []) as any[]).map(asAlign);
  const rowsByReg = new Map<string, any[]>();
  for (const a of (att ?? []) as any[]) if (a.activity?.activity_type === "Pratique") rowsByReg.set(a.registration_id, [...(rowsByReg.get(a.registration_id) ?? []), a]);
  const recent = new Map<string, { present: number; total: number }>();
  for (const id of ids) {
    const list = rowsByReg.get(id) ?? [];
    const { keep, missing } = alignAttendance(id, list.map((a) => ({ activityId: a.activity_id, status: String(a.status), activity: asAlign(a.activity) })), expectedActs, today());
    const r = attendanceRate([...keep.map((i) => String(list[i].status)), ...missing.map(() => NO_ANSWER)]);
    if (r.total) recent.set(id, { present: r.present, total: r.total });
  }
  const hurt = new Set(((inc ?? []) as any[]).map((i) => i.registration_id));
  const now = today();
  return rows
    .map((r) => ({
      registrationId: r.id,
      firstName: cap(String(r.player_first_name ?? "")),
      lastName: cap(String(r.player_last_name ?? "")),
      category: r.category_id ?? null,
      advanced: Boolean(r.advanced_group),
      group: slotLabel(slot.get(r.time_slot_template_id)),
      photoUrl: r.player_id ? photo.get(r.player_id) ?? null : null,
      mine: mineIds.has(r.id),
      badges: listBadges({ lastEvaluation: lastEval.get(r.id) ?? null, recent: recent.get(r.id) ?? { present: 0, total: 0 }, openIncident: hurt.has(r.id) }, now)
    }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName, "fr") || a.lastName.localeCompare(b.lastName, "fr"));
}

/* ── Le dossier d'une joueuse ─────────────────────────────────────────────────────────────────────────────── */

export interface DossierAttendance {
  activityId: string;
  date: string;
  start: string;
  type: string;
  group: string;
  status: string;
}

export interface DossierMatchEval {
  id: string;
  date: string;
  title: string;
  coach: string;
  position: string | null;
  scale: number;
  score: number | null;
  criteria: Record<string, number>;
  strengths: string | null;
  toImprove: string | null;
  comment: string | null;
}

export interface DossierMatchVideo {
  id: string;
  date: string | null;
  title: string;
  teamName: string | null;
  poster: string | null;
}

export interface PlayerDossier {
  registrationId: string;
  firstName: string;
  lastName: string;
  category: string | null;
  advanced: boolean;
  group: string | null;
  photoUrl: string | null;
  seasonId: string | null;
  attendance: DossierAttendance[];
  reports: PlayerReport[];
  survey: SurveyRow[];
  /** Les fois où une autre fille l'a nommée au sondage (« Quelqu'un t'a aidée ? »). */
  namedByPeers: { date: string; name: string }[];
  matchEvals: DossierMatchEval[];
  matchVideos: DossierMatchVideo[];
  videos: PlayerVideoFiche | null;
  familyVideos: { checkpoints: Checkpoint[]; videos: ProgressVideo[] } | null;
  parcours: FamilyParcours | null;
  objectives: PlayerObjective[];
  routines: PlayerRoutine[];
  sheet: { answers: SheetAnswers; updatedAt: string | null } | null;
  incidents: PlayerIncident[];
  points: PointsSummary | null;
  titles: ChampionTitle[];
  summary: SeasonSummary | null;
  /** Bulletin de mi-saison tel qu'il se remplit (audience équipe : avec les notes). */
  bulletin: BulletinReportData | null;
  /** Le bulletin que la famille voit aujourd'hui (audience parent : flou tant qu'il n'est pas remis). */
  familyBulletin: BulletinReportData | null;
}

/** Les matchs filmés où elle apparaît : même règle que l'espace famille (équipe MonClubSportif ou présente au match). */
async function matchVideosFor(firstName: string, lastName: string): Promise<DossierMatchVideo[]> {
  const key = personKey(firstName, lastName);
  const [expected, all] = await Promise.all([loadExpectedPlayers().catch(() => []), listMatchVideos()]);
  const teamIds = expected.find((p) => p.key === key)?.teams.map((t) => t.id) ?? [];
  const mine = all.filter((v) => canWatch(v, { keys: [key], teamIds }));
  return Promise.all(mine.map(async (v) => ({ id: v.id, date: v.match_date, title: v.title, teamName: v.teamName, poster: await posterOf(v).catch(() => null) })));
}

export async function getPlayerDossier(registrationId: string): Promise<PlayerDossier | null> {
  if (!/^[0-9a-f-]{36}$/i.test(registrationId)) return null;
  const { data: reg } = await db()
    .from("registrations")
    .select("id, season_id, player_first_name, player_last_name, category_id, advanced_group, time_slot_template_id, player_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return null;
  const firstName = cap(String(reg.player_first_name ?? ""));
  const lastName = cap(String(reg.player_last_name ?? ""));
  const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

  const [
    profile,
    attendance,
    reports,
    { data: slot },
    { data: player },
    { data: named },
    { data: mevals },
    matchVideos,
    videos,
    familyVideos,
    parcours,
    objectives,
    routines,
    sheets,
    { data: sheetRow },
    incidents,
    points,
    titles,
    summary,
    bulletin,
    familyBulletin
  ] = await Promise.all([
    getPlayerProfile(registrationId),
    getPlayerAttendanceHistory(registrationId),
    safe(getPlayerReports(registrationId), []),
    reg.time_slot_template_id ? db().from("time_slot_templates").select("day, start_time").eq("id", reg.time_slot_template_id).maybeSingle() : Promise.resolve({ data: null }),
    reg.player_id ? db().from("players").select("photo_url").eq("id", reg.player_id).maybeSingle() : Promise.resolve({ data: null }),
    db().from("activity_player_attendance").select("registration_id, registration:registrations(player_first_name, player_last_name), activity:coach_activities(activity_date)").contains("peer_helpers", [registrationId]).limit(500),
    db().from("match_player_evaluations").select("*, activity:coach_activities(activity_date, title, category), coach:coaches(first_name, last_name)").eq("registration_id", registrationId).order("created_at", { ascending: false }),
    safe(matchVideosFor(firstName, lastName), []),
    safe(getPlayerVideoFiche(registrationId), null),
    safe(getFamilyProgressVideos([registrationId]).then((m) => m.get(registrationId) ?? null), null),
    safe(getFamilyParcours([registrationId]).then((m) => m.get(registrationId) ?? null), null),
    safe(getPlayerObjectives(registrationId), []),
    safe(getPlayerRoutines(registrationId), []),
    safe(getSheetsForRegistrations([registrationId]), new Map<string, SheetAnswers>()),
    db().from("player_family_sheets").select("updated_at").eq("registration_id", registrationId).maybeSingle(),
    safe(getPlayerIncidents(registrationId), []),
    safe(getPointsSummaries([registrationId]).then((m) => m.get(registrationId) ?? null), null),
    safe(getChampionTitles([registrationId]).then((m) => m.get(registrationId) ?? []), []),
    safe(getSeasonSummary(registrationId, { audience: "equipe" }), null),
    safe(getBulletinReport(registrationId, { period: "mi-saison", audience: "equipe" }), null),
    safe(getBulletinReport(registrationId, { audience: "parent" }), null)
  ]);
  if (!profile) return null;

  // Noms des coachs et des filles nommés au sondage (la borne garde des identifiants).
  const coachIds = new Set<string>();
  const peerIds = new Set<string>();
  for (const a of attendance as any[]) {
    for (const c of a.coach_helpers ?? []) coachIds.add(c);
    for (const p of a.peer_helpers ?? []) peerIds.add(p);
  }
  const [{ data: coaches }, { data: peers }] = await Promise.all([
    coachIds.size ? db().from("coaches").select("id, first_name").in("id", [...coachIds]) : Promise.resolve({ data: [] }),
    peerIds.size ? db().from("registrations").select("id, player_first_name, player_last_name").in("id", [...peerIds]) : Promise.resolve({ data: [] })
  ]);
  const coachName = new Map(((coaches ?? []) as any[]).map((c) => [c.id, cap(String(c.first_name ?? ""))]));
  const shortName = (f: unknown, l: unknown) => `${cap(String(f ?? ""))} ${cap(String(l ?? "")).charAt(0)}.`.trim();
  const peerName = new Map(((peers ?? []) as any[]).map((p) => [p.id, shortName(p.player_first_name, p.player_last_name)]));

  const groupOf = (a: any) => String(a?.title || a?.category || a?.activity_type || "Pratique");
  const att = ((attendance ?? []) as any[])
    .filter((a) => a.activity)
    .sort((a, b) => `${day(b.activity.activity_date)} ${b.activity.start_time}`.localeCompare(`${day(a.activity.activity_date)} ${a.activity.start_time}`));

  return {
    registrationId,
    firstName,
    lastName,
    category: reg.category_id ?? null,
    advanced: Boolean(reg.advanced_group),
    group: slotLabel(slot ?? undefined),
    photoUrl: player?.photo_url ?? null,
    seasonId: reg.season_id ?? null,
    attendance: att.map((a) => ({ activityId: a.activity_id, date: day(a.activity.activity_date), start: String(a.activity.start_time ?? "").slice(0, 5), type: String(a.activity.activity_type ?? ""), group: groupOf(a.activity), status: a.status })),
    reports,
    survey: att
      .filter((a) => a.feedback_at || a.practice_rating != null || a.fatigue != null || a.coach_helped != null || a.peer_helped != null || a.theme_answer != null)
      .map((a) => ({
        date: day(a.activity.activity_date),
        group: groupOf(a.activity),
        status: a.status,
        practiceRating: a.practice_rating ?? null,
        fatigue: a.fatigue ?? null,
        coachHelped: a.coach_helped ?? null,
        coachHelpers: ((a.coach_helpers ?? []) as string[]).map((id) => coachName.get(id) ?? "Coach"),
        peerHelped: a.peer_helped ?? null,
        peerHelpers: ((a.peer_helpers ?? []) as string[]).map((id) => peerName.get(id) ?? "Une coéquipière"),
        themeAnswer: a.theme_answer ?? null,
        themeExpected: a.theme_expected ?? null,
        themeCorrect: a.theme_correct ?? null
      })),
    namedByPeers: ((named ?? []) as any[])
      .map((n) => ({ date: day(n.activity?.activity_date), name: shortName(n.registration?.player_first_name, n.registration?.player_last_name) }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    matchEvals: ((mevals ?? []) as any[]).map((m) => ({
      id: m.id,
      date: day(m.activity?.activity_date),
      title: String(m.activity?.title || m.activity?.category || "Match"),
      coach: `${cap(String(m.coach?.first_name ?? ""))} ${cap(String(m.coach?.last_name ?? ""))}`.trim(),
      position: m.position_code ?? null,
      scale: Number(m.scale ?? 10),
      score: m.score ?? null,
      criteria: (m.criteria ?? {}) as Record<string, number>,
      strengths: m.strengths ?? null,
      toImprove: m.to_improve ?? null,
      comment: m.comment ?? null
    })),
    matchVideos,
    videos,
    familyVideos,
    parcours,
    objectives,
    routines,
    sheet: sheets.get(registrationId) ? { answers: sheets.get(registrationId)!, updatedAt: sheetRow?.updated_at ? day(sheetRow.updated_at) : null } : null,
    incidents,
    points,
    titles,
    summary,
    bulletin,
    familyBulletin
  };
}
