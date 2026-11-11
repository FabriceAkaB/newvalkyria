import { CLUB_ID } from "@/lib/club";
import {
  analysisIsEmpty,
  hasLessonIn,
  lessonLine,
  lessonMarker,
  lessonNotesFrom,
  mergeLessonIntoNotes,
  nextWeekStart,
  ourNameFor,
  parseFixture,
  summarizeLessons,
  type LessonMatchInput,
  type MatchLessons,
  buildPlayerStats,
  buildRoster,
  categoryLabel,
  endOrDefault,
  slotActivityTitle,
  matchDayLabel,
  matchEndMinute,
  matchLengthMinutes,
  missingFor,
  nextStatus,
  normalizeAnalysis,
  OUR_NAME,
  ourTeamLabel,
  pairSlotsWithActivities,
  safeVideoFileName,
  seasonRange,
  seasonStartYear,
  tidyOpponent,
  type MatchAnalysis,
  type MatchCard,
  type MatchParticipation,
  type MatchStatus,
  type PlayerIdentity,
  type PlayerStat,
  type RosterRow,
  type StatsMatch
} from "@/lib/match-results-core";
import { listMatches, type MatchRow } from "@/lib/referees-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Section Matchs (Mandalart P1.8.05 à P1.8.07) : « Nos matchs », fiche d'un match, vidéos et
 *  statistiques des joueuses. Un match = une activité Match/Tournoi d'Entraînements
 *  (coach_activities + match_details), une plage vendue de Vente de matchs (match_slots +
 *  réservation payée, résultat dans match_slot_results), ou les deux reliées.
 *  Alignement, temps de jeu et évaluations se notent dans l'activité (portail et Entraînements) ;
 *  ici on ne fait que les lire. Règles pures : match-results-core.ts. */

export const MATCH_VIDEO_BUCKET = "match-videos";
/** Durée du lien signé de lecture d'une vidéo déposée (Loi 25 : lien court, recréé à chaque visite ;
 *  2 h pour regarder un match complet sans que la lecture coupe). */
export const VIDEO_LINK_SECONDS = 2 * 60 * 60;

function db() {
  return getSupabaseAdminClient() as any;
}

const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const hhmm = (t: unknown) => (t ? String(t).slice(0, 5) : null);
const day = (d: unknown) => String(d ?? "").slice(0, 10);

async function rows(q: PromiseLike<{ data: any[] | null; error: { message: string } | null }>): Promise<any[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Toutes les lignes, par pages de 1000 (limite de Supabase). */
async function allRows(build: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await rows(build().range(from, from + 999));
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/** Requête `in (...)` découpée en paquets (adresse de requête courte). */
async function inChunks(table: string, select: string, column: string, ids: string[]): Promise<any[]> {
  const unique = [...new Set(ids)];
  const out: any[] = [];
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    out.push(...(await allRows(() => db().from(table).select(select).in(column, chunk))));
  }
  return out;
}

/* ── Chargement et fusion des deux sources ─────────────────────── */

interface Loaded {
  cards: MatchCard[];
  slots: Map<string, MatchRow>;
  details: Map<string, any>;
}

function scorePair(primary: any, fallback: any): [number | null, number | null] {
  if (primary && primary.final_score_us !== null && primary.final_score_them !== null) return [primary.final_score_us, primary.final_score_them];
  if (fallback && fallback.final_score_us !== null && fallback.final_score_them !== null) return [fallback.final_score_us, fallback.final_score_them];
  return [primary?.final_score_us ?? fallback?.final_score_us ?? null, primary?.final_score_them ?? fallback?.final_score_them ?? null];
}

function mergedAnalysis(primary: unknown, fallback: unknown): MatchAnalysis {
  const a = normalizeAnalysis(primary);
  return analysisIsEmpty(a) ? normalizeAnalysis(fallback) : a;
}

async function loadAll(): Promise<Loaded> {
  const [acts, sold, slotResults, details, lineup, segments, evals] = await Promise.all([
    allRows(() => db().from("coach_activities").select("id, activity_date, start_time, end_time, location, category, activity_type, title, video_url, organization").in("activity_type", ["Match", "Tournoi"]).order("activity_date")),
    listMatches().then((all) => all.filter((m) => m.bookingStatus === "paid")),
    allRows(() => db().from("match_slot_results").select("*").eq("club_id", CLUB_ID)),
    allRows(() => db().from("match_details").select("*")),
    allRows(() => db().from("match_lineup_slots").select("activity_id, registration_id")),
    allRows(() => db().from("match_playtime_segments").select("activity_id, registration_id")),
    allRows(() => db().from("match_player_evaluations").select("activity_id, registration_id"))
  ]);

  const detailsBy = new Map<string, any>(details.map((d: any) => [d.activity_id, d]));
  const resultsBy = new Map<string, any>(slotResults.map((r: any) => [r.match_slot_id, r]));
  const slotsBy = new Map<string, MatchRow>(sold.map((s) => [s.id, s]));
  const players = new Map<string, Set<string>>();
  for (const r of [...lineup, ...segments, ...evals]) {
    if (!players.has(r.activity_id)) players.set(r.activity_id, new Set());
    players.get(r.activity_id)!.add(r.registration_id);
  }

  const pairs = pairSlotsWithActivities(
    acts.map((a: any) => ({ id: a.id, date: day(a.activity_date), start: hhmm(a.start_time), linkedSlotId: detailsBy.get(a.id)?.match_slot_id ?? null })),
    sold.map((s) => ({ id: s.id, date: s.date, start: s.start }))
  );
  const pairedSlots = new Set(pairs.values());

  const cards: MatchCard[] = [];
  for (const a of acts) {
    const d = detailsBy.get(a.id) ?? null;
    const slotId = pairs.get(a.id) ?? null;
    const slot = slotId ? slotsBy.get(slotId) ?? null : null;
    const sr = slotId ? resultsBy.get(slotId) ?? null : null;
    const [scoreUs, scoreThem] = scorePair(d, sr);
    const status: MatchStatus = d?.status && d.status !== "scheduled" ? d.status : sr?.status ?? d?.status ?? "scheduled";
    // Match hors Académie (ex. Saint-Gabriel) : notre équipe est l'organisation, l'adversaire est dans le titre.
    const organization: string | null = a.organization?.trim() || null;
    const ourName = ourNameFor(organization);
    const fixture = parseFixture(a.title, ourName);
    cards.push({
      id: a.id,
      activityId: a.id,
      slotId,
      kind: a.activity_type === "Tournoi" ? "Tournoi" : "Match",
      date: day(a.activity_date),
      start: hhmm(a.start_time),
      end: hhmm(a.end_time),
      // L'équipe de la plage vendue (« Équipe 2016-2017 intermédiaire (filles) ») est plus précise que la catégorie de l'activité.
      category: ourTeamLabel(slot?.ourTeam) ?? categoryLabel(a.category),
      location: a.location ?? slot?.location ?? null,
      field: slot?.field ?? null,
      opponent: d?.opponent_name?.trim() || sr?.opponent_name || tidyOpponent(slot?.opponent) || fixture?.opponent || (a.activity_type === "Tournoi" ? a.title?.trim() || null : null),
      opponentLogo: d?.opponent_logo_url ?? sr?.opponent_logo_url ?? slot?.opponentLogo ?? null,
      homeAway: d ? (d.home_away === "away" ? "away" : "home") : fixture?.homeAway ?? "home",
      status,
      scoreUs,
      scoreThem,
      summary: d?.summary ?? sr?.summary ?? null,
      analysis: mergedAnalysis(d?.analysis, sr?.analysis),
      videoUrl: d?.video_url ?? sr?.video_url ?? null,
      videoPath: d?.video_path ?? sr?.video_path ?? null,
      activityVideoUrl: a.video_url ?? null,
      playerCount: players.get(a.id)?.size ?? 0,
      ourName,
      organization
    });
  }
  for (const s of sold) {
    if (pairedSlots.has(s.id)) continue;
    const sr = resultsBy.get(s.id) ?? null;
    cards.push({
      id: s.id,
      activityId: null,
      slotId: s.id,
      kind: "Match",
      date: s.date,
      start: s.start,
      end: s.end,
      category: ourTeamLabel(s.ourTeam),
      location: s.location,
      field: s.field,
      opponent: sr?.opponent_name || tidyOpponent(s.opponent),
      opponentLogo: sr?.opponent_logo_url ?? s.opponentLogo ?? null,
      homeAway: "home",
      status: (sr?.status as MatchStatus) ?? "scheduled",
      scoreUs: sr?.final_score_us ?? null,
      scoreThem: sr?.final_score_them ?? null,
      summary: sr?.summary ?? null,
      analysis: normalizeAnalysis(sr?.analysis),
      videoUrl: sr?.video_url ?? null,
      videoPath: sr?.video_path ?? null,
      activityVideoUrl: null,
      playerCount: 0,
      ourName: OUR_NAME,
      organization: null
    });
  }
  cards.sort((x, y) => x.date.localeCompare(y.date) || (x.start ?? "").localeCompare(y.start ?? ""));
  return { cards, slots: slotsBy, details: detailsBy };
}

/** Tous nos matchs (joués, à venir, annulés), du plus ancien au plus récent. */
export async function listMatchCards(): Promise<MatchCard[]> {
  return (await loadAll()).cards;
}

/** Un match par son identifiant (activité ou plage vendue, même reliées). */
async function findCard(id: string): Promise<{ card: MatchCard; loaded: Loaded } | null> {
  const loaded = await loadAll();
  const card = loaded.cards.find((c) => c.id === id) ?? loaded.cards.find((c) => c.slotId === id || c.activityId === id) ?? null;
  return card ? { card, loaded } : null;
}

/* ── Fiche d'un match ──────────────────────────────────────────── */

export interface MatchSheet {
  card: MatchCard;
  /** Joueuses du match (alignement, temps de jeu, évaluations) ; vide si rien n'a été noté. */
  roster: RosterRow[];
  /** Le temps de jeu a-t-il été noté (chronomètre du portail) ? */
  timed: boolean;
  /** Lien signé (court) pour lire la vidéo déposée. */
  videoSignedUrl: string | null;
  referees: string[];
  /** Nom de l'adversaire tiré de la réservation (plage vendue). */
  bookingOpponent: string | null;
  /** Résumé des notes du match : forces, à corriger, joueuses à surveiller, 3 priorités. */
  lessons: MatchLessons;
  /** Où vont les priorités : le thème de la semaine qui suit le match. */
  lessonTarget: LessonTarget;
}

export interface LessonTarget {
  weekStart: string;
  /** Thème déjà prévu cette semaine-là (plan de l'année), s'il y en a un. */
  theme: string | null;
  /** Les priorités de ce match sont déjà dans les notes du thème. */
  added: boolean;
}

export async function getMatchSheet(id: string): Promise<MatchSheet | null> {
  const found = await findCard(id);
  if (!found) return null;
  const { card, loaded } = found;
  let roster: RosterRow[] = [];
  let timed = false;
  let evalNotes: { player: string; scale: number; score: number | null; comment: string | null }[] = [];
  if (card.activityId) {
    const [lineup, segments, evals] = await Promise.all([
      rows(db().from("match_lineup_slots").select("registration_id, is_starter, position_code").eq("activity_id", card.activityId)),
      rows(db().from("match_playtime_segments").select("registration_id, minute_in, minute_out").eq("activity_id", card.activityId).order("minute_in")),
      rows(db().from("match_player_evaluations").select("registration_id, scale, score, comment").eq("activity_id", card.activityId))
    ]);
    const regIds = [...new Set([...lineup, ...segments, ...evals].map((r: any) => r.registration_id))];
    const regs = regIds.length ? await inChunks("registrations", "id, player_first_name, player_last_name", "id", regIds) : [];
    const names = Object.fromEntries(regs.map((r: any) => [r.id, `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.replace(/\s+/g, " ").trim() || "Joueuse"]));
    timed = segments.length > 0;
    roster = buildRoster({ lineup, segments, evaluations: evals }, matchEndMinute(matchLengthMinutes(card.start, card.end), segments), names);
    evalNotes = evals.map((e: any) => ({ player: names[e.registration_id] ?? "Joueuse", scale: e.scale, score: e.score, comment: e.comment }));
  }
  const slot = card.slotId ? loaded.slots.get(card.slotId) ?? null : null;
  let videoSignedUrl: string | null = null;
  if (card.videoPath) {
    const { data } = await db().storage.from(MATCH_VIDEO_BUCKET).createSignedUrl(card.videoPath, VIDEO_LINK_SECONDS);
    videoSignedUrl = data?.signedUrl ?? null;
  }
  return {
    card,
    roster,
    timed,
    videoSignedUrl,
    referees: slot ? slot.assignments.filter((a) => a.status === "reserve" && a.referee).map((a) => `${a.referee!.first_name} ${a.referee!.last_name}`) : [],
    bookingOpponent: slot ? tidyOpponent(slot.opponent) : null,
    lessons: summarizeLessons([{ matchId: card.id, notes: lessonNotesFrom(evalNotes, card.analysis, card.summary) }]),
    lessonTarget: await getLessonTarget(card)
  };
}

/* ── Leçons des matchs → thème de la semaine prochaine ─────────── */

async function themeRow(weekStart: string): Promise<{ id: string; theme: string; notes: string | null } | null> {
  const { data, error } = await db().from("season_themes").select("id, theme, notes").eq("season_id", SEASON_DB_ID).eq("week_start_date", weekStart).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function getLessonTarget(card: MatchCard, today = todayLocal()): Promise<LessonTarget> {
  const weekStart = nextWeekStart(card.date, today);
  const row = await themeRow(weekStart);
  return { weekStart, theme: row?.theme ?? null, added: hasLessonIn(row?.notes, lessonMarker(card)) };
}

/** Où iraient les priorités d'un match (sans charger alignement ni vidéo) : pour le panneau d'après-match. */
export async function getLessonTargetById(id: string): Promise<LessonTarget | null> {
  const found = await findCard(id);
  return found ? getLessonTarget(found.card) : null;
}

/** Écrit les 3 priorités du match dans les notes du thème de la semaine qui suit (season_themes).
 *  Le thème prévu reste ; la ligne du même match est remplacée, jamais doublée. Les éducateurs
 *  la voient dans la pratique du jour (portail, étape « Avant »). */
export async function applyLessonsToNextWeek(id: string, today = todayLocal()): Promise<{ weekStart: string; theme: string; line: string; created: boolean }> {
  const sheet = await getMatchSheet(id);
  if (!sheet) throw new Error("Match introuvable");
  const { card, lessons } = sheet;
  if (!lessons.priorities.length) throw new Error("Aucune priorité à ajouter : notez d'abord les commentaires des joueuses ou l'analyse du match.");
  const weekStart = nextWeekStart(card.date, today);
  const line = lessonLine({ date: card.date, opponent: card.opponent, category: card.organization ? card.ourName : card.category }, lessons.priorities);
  const row = await themeRow(weekStart);
  if (row) {
    const notes = mergeLessonIntoNotes(row.notes, line, lessonMarker(card));
    const { error } = await db().from("season_themes").update({ notes }).eq("id", row.id);
    if (error) throw new Error(error.message);
    return { weekStart, theme: row.theme, line, created: false };
  }
  // Aucune semaine prévue : la première priorité devient le thème de la semaine.
  const theme = `${lessons.priorities[0].label} (après le match)`;
  const { error } = await db().from("season_themes").upsert({ season_id: SEASON_DB_ID, week_start_date: weekStart, theme, notes: line }, { onConflict: "season_id,week_start_date" });
  if (error) throw new Error(error.message);
  return { weekStart, theme, line, created: true };
}

export interface RecentLessons {
  lessons: MatchLessons;
  /** Matchs résumés (les plus récents d'abord). */
  matches: Pick<MatchCard, "id" | "date" | "opponent" | "ourName" | "scoreUs" | "scoreThem">[];
}

/** « Leçons des derniers matchs » : les 5 derniers matchs joués qui ont des notes (commentaires, analyse, résumé). */
export async function getRecentLessons(cards: MatchCard[], limit = 5, today = todayLocal()): Promise<RecentLessons> {
  const played = cards.filter((c) => c.date <= today && c.status !== "cancelled").sort((a, b) => b.date.localeCompare(a.date) || (b.start ?? "").localeCompare(a.start ?? ""));
  const actIds = played.map((c) => c.activityId).filter((x): x is string => !!x);
  const evals = actIds.length ? await inChunks("match_player_evaluations", "activity_id, registration_id, scale, score, comment", "activity_id", actIds) : [];
  const regs = evals.length ? await inChunks("registrations", "id, player_first_name, player_last_name", "id", evals.map((e: any) => e.registration_id)) : [];
  const names = Object.fromEntries(regs.map((r: any) => [r.id, `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.replace(/\s+/g, " ").trim() || "Joueuse"]));
  const inputs: LessonMatchInput[] = [];
  const used: MatchCard[] = [];
  for (const c of played) {
    if (used.length >= limit) break;
    const mine = c.activityId ? evals.filter((e: any) => e.activity_id === c.activityId) : [];
    const notes = lessonNotesFrom(
      mine.map((e: any) => ({ player: names[e.registration_id] ?? "Joueuse", scale: e.scale, score: e.score, comment: e.comment })),
      c.analysis,
      c.summary
    );
    if (!notes.some((n) => n.text.trim() || n.note !== null)) continue;
    inputs.push({ matchId: c.id, notes });
    used.push(c);
  }
  return {
    lessons: summarizeLessons(inputs),
    matches: used.map((c) => ({ id: c.id, date: c.date, opponent: c.opponent, ourName: c.ourName, scoreUs: c.scoreUs, scoreThem: c.scoreThem }))
  };
}

/* ── Enregistrer ───────────────────────────────────────────────── */

export interface MatchSheetInput {
  scoreUs: number | null;
  scoreThem: number | null;
  cancelled: boolean;
  opponentName: string;
  homeAway: "home" | "away";
  opponentLogo: string;
  summary: string;
  analysis: MatchAnalysis;
  videoUrl: string;
}

const clean = (s: string | null | undefined) => (s ?? "").trim() || null;

/** Écrit des champs dans la fiche : match_details pour une activité (reliée à sa plage vendue),
 *  match_slot_results pour une plage vendue seule. */
async function writeFields(card: MatchCard, loaded: Loaded, fields: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  if (card.activityId) {
    const existing = loaded.details.get(card.activityId);
    const row: Record<string, unknown> = {
      activity_id: card.activityId,
      opponent_name: existing?.opponent_name ?? card.opponent ?? "Adversaire à confirmer",
      // Première fiche : on garde domicile/extérieur lu dans le titre (match hors Académie).
      ...(existing ? {} : { home_away: card.homeAway }),
      ...fields,
      updated_at: now
    };
    if (card.slotId) row.match_slot_id = card.slotId;
    const { error } = await db().from("match_details").upsert(row, { onConflict: "activity_id" });
    if (error) throw new Error(error.message);
    return;
  }
  if (!card.slotId) throw new Error("Match introuvable");
  const rest: Record<string, unknown> = { ...fields };
  delete rest.home_away;
  const { error } = await db()
    .from("match_slot_results")
    .upsert({ match_slot_id: card.slotId, club_id: CLUB_ID, ...rest, updated_at: now }, { onConflict: "match_slot_id" });
  if (error) throw new Error(error.message);
}

export async function saveMatchSheet(id: string, input: MatchSheetInput): Promise<MatchCard> {
  const found = await findCard(id);
  if (!found) throw new Error("Match introuvable");
  const { card, loaded } = found;
  // « En direct » n'existe que pour une activité (chronomètre du portail).
  const status = nextStatus(card.activityId || card.status !== "live" ? card.status : "scheduled", input);
  const analysis = { strengths: input.analysis.strengths.trim(), fixes: input.analysis.fixes.trim(), actions: input.analysis.actions.trim() };
  const fields: Record<string, unknown> = {
    status,
    final_score_us: input.scoreUs,
    final_score_them: input.scoreThem,
    summary: clean(input.summary),
    analysis: analysisIsEmpty(analysis) ? null : analysis,
    video_url: clean(input.videoUrl),
    opponent_logo_url: clean(input.opponentLogo),
    // Une vidéo déposée avant que l'activité soit reliée à la plage suit la fiche.
    video_path: card.videoPath
  };
  const name = clean(input.opponentName);
  if (card.activityId) {
    fields.opponent_name = name ?? card.opponent ?? "Adversaire à confirmer";
    fields.home_away = input.homeAway;
  } else {
    const bookingName = tidyOpponent(card.slotId ? loaded.slots.get(card.slotId)?.opponent : null);
    fields.opponent_name = name && name !== bookingName ? name : null;
  }
  await writeFields(card, loaded, fields);
  return { ...card, status, scoreUs: input.scoreUs, scoreThem: input.scoreThem };
}

/* ── Plage vendue sans activité : créer l'activité du match (alignement, chronomètre, évaluations) ── */

/** Catégories de la saison en cours (birth_categories) : l'effectif du match vient de la catégorie de l'activité. */
export async function listMatchCategories(): Promise<{ id: string; label: string }[]> {
  const list = await rows(db().from("birth_categories").select("id, label").eq("season_id", SEASON_DB_ID).order("id"));
  return list.map((c: any) => ({ id: String(c.id), label: String(c.label ?? c.id) }));
}

/** Crée l'activité « Match » d'une plage vendue (même date, heure et lieu), reliée à la plage par
 *  match_details.match_slot_id : la fiche garde son score, son résumé, son analyse et sa vidéo.
 *  Ensuite, convocations, alignement, chronomètre et évaluations se font dans l'activité. */
export async function createActivityForSlot(id: string, categoryId: string | null): Promise<{ activityId: string; outcome: "created" | "linked" | "existing" }> {
  const found = await findCard(id);
  if (!found) throw new Error("Match introuvable");
  const { card, loaded } = found;
  if (card.activityId) return { activityId: card.activityId, outcome: "existing" };
  const slot = card.slotId ? loaded.slots.get(card.slotId) ?? null : null;
  if (!slot) throw new Error("Plage introuvable");
  if (categoryId) {
    const ok = (await listMatchCategories()).some((c) => c.id === categoryId);
    if (!ok) throw new Error("Catégorie inconnue");
  }
  const title = slotActivityTitle(slot.ourTeam, card.opponent);
  // Une activité sans plan de séance existe déjà à cette heure (ex. créée par le robot MonClubSportif pour les
  // présences) : elle devient l'activité du match, pour ne jamais avoir deux activités pour le même match.
  const toMin = (t: unknown) => {
    const m = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : -9999;
  };
  // Même groupe seulement (une année de l'équipe dans la catégorie ou le titre), jamais la pratique d'un autre groupe.
  const years = String(slot.ourTeam ?? "").match(/\b20\d{2}\b/g) ?? [];
  const sameTime = (await rows(db().from("coach_activities").select("id, start_time, organization, activity_type, category, title").eq("activity_date", slot.date))).filter(
    (a: any) => !a.organization && Math.abs(toMin(a.start_time) - toMin(slot.start)) <= 15
  );
  const withBlocks = sameTime.length ? new Set((await inChunks("activity_session_blocks", "activity_id", "activity_id", sameTime.map((a: any) => a.id))).map((b: any) => b.activity_id)) : new Set<string>();
  const candidate = sameTime.length === 1 ? sameTime[0] : null;
  const reuse =
    candidate && !withBlocks.has(candidate.id) && years.some((y) => `${candidate.category ?? ""} ${candidate.title ?? ""}`.includes(y)) ? candidate : null;
  let activityId: string;
  let created = true;
  if (reuse) {
    activityId = reuse.id;
    created = false;
    const { error } = await db()
      .from("coach_activities")
      // La catégorie choisie remplace celle du robot (« 2016, 2017 avancé ») : l'effectif du match vient d'elle.
      .update({ activity_type: "Match", category: categoryId ?? reuse.category, title: title, updated_at: new Date().toISOString() })
      .eq("id", reuse.id);
    if (error) throw new Error(error.message);
  } else {
    const { createActivity } = await import("@/lib/coaches-repo");
    activityId = await createActivity({
      activityDate: slot.date,
      startTime: slot.start,
      endTime: endOrDefault(slot.start, slot.end),
      location: slot.location || null,
      category: categoryId,
      activityType: "Match",
      title,
      notes: null
    });
  }
  const sr = (await rows(db().from("match_slot_results").select("*").eq("match_slot_id", slot.id)))[0] ?? null;
  const { error } = await db()
    .from("match_details")
    .upsert(
      {
        activity_id: activityId,
        match_slot_id: slot.id,
        opponent_name: card.opponent ?? "Adversaire à confirmer",
        home_away: "home",
        status: card.status === "live" ? "scheduled" : card.status,
        final_score_us: card.scoreUs,
        final_score_them: card.scoreThem,
        summary: card.summary,
        analysis: analysisIsEmpty(card.analysis) ? null : card.analysis,
        video_url: card.videoUrl,
        video_path: card.videoPath,
        opponent_logo_url: sr?.opponent_logo_url ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "activity_id" }
    );
  if (error) {
    // Rien d'orphelin : sans fiche reliée, l'activité serait un deuxième match à la même heure.
    if (created) await db().from("coach_activities").delete().eq("id", activityId);
    else if (reuse) await db().from("coach_activities").update({ activity_type: reuse.activity_type, category: reuse.category, title: reuse.title }).eq("id", reuse.id);
    throw new Error(error.message);
  }
  return { activityId, outcome: created ? "created" : "linked" };
}

/* ── Vidéo déposée (compartiment privé, téléversement direct depuis le navigateur) ── */

let bucketReady = false;
async function ensureVideoBucket(): Promise<void> {
  if (bucketReady) return;
  const { error } = await db().storage.getBucket(MATCH_VIDEO_BUCKET);
  if (error) {
    const { error: createError } = await db().storage.createBucket(MATCH_VIDEO_BUCKET, { public: false, allowedMimeTypes: ["video/*"] });
    if (createError && !/already exists/i.test(createError.message)) throw new Error(createError.message);
  }
  bucketReady = true;
}

/** Prépare un lien de dépôt signé : le navigateur envoie le fichier directement au stockage,
 *  sans passer par le serveur du site. */
export async function createVideoUpload(id: string, file: { fileName: string; contentType: string }): Promise<{ path: string; signedUrl: string }> {
  const found = await findCard(id);
  if (!found) throw new Error("Match introuvable");
  if (!/^video\//i.test(file.contentType)) throw new Error("Choisissez un fichier vidéo (mp4, mov…).");
  await ensureVideoBucket();
  const path = `${CLUB_ID}/${found.card.id}/${Date.now()}-${safeVideoFileName(file.fileName)}`;
  const { data, error } = await db().storage.from(MATCH_VIDEO_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Lien de dépôt impossible à créer");
  return { path, signedUrl: data.signedUrl };
}

/** Relie le fichier déposé à la fiche (après vérification qu'il est bien arrivé) ; l'ancien fichier est retiré. */
export async function attachVideo(id: string, path: string): Promise<{ previous: string | null }> {
  const found = await findCard(id);
  if (!found) throw new Error("Match introuvable");
  const { card, loaded } = found;
  const folder = `${CLUB_ID}/${card.id}`;
  const name = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : "";
  if (!name || name.includes("/") || name.includes("..")) throw new Error("Fichier invalide");
  const { data, error } = await db().storage.from(MATCH_VIDEO_BUCKET).list(folder, { search: name, limit: 20 });
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((o: any) => o.name === name)) throw new Error("Le fichier n'est pas arrivé dans le stockage. Recommencez le dépôt.");
  const previous = card.videoPath;
  await writeFields(card, loaded, { video_path: path });
  if (previous && previous !== path) await db().storage.from(MATCH_VIDEO_BUCKET).remove([previous]);
  return { previous: previous && previous !== path ? previous : null };
}

/** Retire la vidéo déposée (fichier supprimé du stockage). Le lien vidéo, s'il y en a un, reste. */
export async function removeVideo(id: string): Promise<string | null> {
  const found = await findCard(id);
  if (!found) throw new Error("Match introuvable");
  const { card } = found;
  if (!card.videoPath) return null;
  const now = new Date().toISOString();
  if (card.activityId) {
    const { error } = await db().from("match_details").update({ video_path: null, updated_at: now }).eq("activity_id", card.activityId);
    if (error) throw new Error(error.message);
  }
  if (card.slotId) {
    const { error } = await db().from("match_slot_results").update({ video_path: null, updated_at: now }).eq("match_slot_id", card.slotId);
    if (error) throw new Error(error.message);
  }
  await db().storage.from(MATCH_VIDEO_BUCKET).remove([card.videoPath]);
  return card.videoPath;
}

/* ── Statistiques par joueuse ──────────────────────────────────── */

export interface PlayerStatsResult {
  season: number;
  stats: PlayerStat[];
  /** Matchs joués de la saison qui ont un alignement, un temps de jeu ou des évaluations. */
  trackedMatches: number;
  /** Matchs joués de la saison (activités Match/Tournoi d'Entraînements). */
  activityMatches: number;
  /** Matchs vendus joués sans activité (donc sans alignement possible). */
  slotOnlyMatches: number;
}

export type MatchScope = "academie" | "hors";

/** Matchs de l'Académie (New Valkyria) ou ceux que JP dirige ailleurs (organisation de l'activité). */
export const inScope = (c: Pick<MatchCard, "organization">, scope: MatchScope) => (scope === "hors" ? !!c.organization : !c.organization);

export async function getPlayerMatchStats(season = seasonStartYear(todayLocal()), today = todayLocal(), scope: MatchScope = "academie"): Promise<PlayerStatsResult> {
  const { from, to } = seasonRange(season);
  const inSeason = (await loadAll()).cards.filter((c) => inScope(c, scope) && c.date >= from && c.date <= to && c.status !== "cancelled" && c.date <= today);
  const cards = inSeason.filter((c) => c.activityId);
  const slotOnlyMatches = inSeason.length - cards.length;
  const ids = cards.map((c) => c.activityId!);
  if (!ids.length) return { season, stats: [], trackedMatches: 0, activityMatches: 0, slotOnlyMatches };
  const [lineup, segments, evals] = await Promise.all([
    inChunks("match_lineup_slots", "activity_id, registration_id, is_starter, position_code", "activity_id", ids),
    inChunks("match_playtime_segments", "activity_id, registration_id, minute_in, minute_out", "activity_id", ids),
    inChunks("match_player_evaluations", "activity_id, registration_id, scale, score, comment", "activity_id", ids)
  ]);
  const participation: Record<string, MatchParticipation> = {};
  for (const id of ids) participation[id] = { lineup: [], segments: [], evaluations: [] };
  for (const l of lineup) participation[l.activity_id]?.lineup.push(l);
  for (const s of segments) participation[s.activity_id]?.segments.push(s);
  for (const e of evals) participation[e.activity_id]?.evaluations.push(e);

  const regIds = [...lineup, ...segments, ...evals].map((r: any) => r.registration_id);
  const regs = regIds.length ? await inChunks("registrations", "id, player_id, player_first_name, player_last_name, player_dob", "id", regIds) : [];
  const people: Record<string, PlayerIdentity> = Object.fromEntries(
    regs.map((r: any) => [
      r.id,
      {
        key: r.player_id ?? r.id,
        name: `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.replace(/\s+/g, " ").trim() || "Joueuse",
        birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) || null : null
      }
    ])
  );
  const matches: StatsMatch[] = cards.map((c) => ({
    id: c.activityId!,
    date: c.date,
    opponent: c.opponent,
    scoreUs: c.scoreUs,
    scoreThem: c.scoreThem,
    endMinute: matchEndMinute(matchLengthMinutes(c.start, c.end), participation[c.activityId!]?.segments ?? []),
    cancelled: false
  }));
  const tracked = ids.filter((id) => {
    const p = participation[id];
    return p.lineup.length + p.segments.length + p.evaluations.length > 0;
  }).length;
  return { season, stats: buildPlayerStats(matches, participation, people), trackedMatches: tracked, activityMatches: ids.length, slotOnlyMatches };
}

/* ── Intégration : « Aujourd'hui » ─────────────────────────────── */

export interface MatchTodayItem {
  title: string;
  detail: string;
  meta: string;
  href: string;
  /** Score manquant (plus urgent qu'un résumé). */
  urgent: boolean;
}

/** Matchs joués depuis 45 jours dont le score ou le résumé manque, du plus récent au plus ancien. */
export async function getMatchResultsTodayItems(today = todayLocal()): Promise<MatchTodayItem[]> {
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 45 * 86_400_000).toISOString().slice(0, 10);
  return (await loadAll()).cards
    .filter((c) => c.date >= since)
    .map((c) => ({ c, miss: missingFor(c, today) }))
    .filter(({ miss }) => miss.includes("score") || miss.includes("résumé"))
    .sort((a, b) => b.c.date.localeCompare(a.c.date))
    .map(({ c, miss }) => ({
      title: `${miss.includes("score") ? "Entrer le score" : "Écrire le résumé"} : ${c.ourName} vs ${c.opponent ?? "adversaire à confirmer"}`,
      detail: [matchDayLabel(c.date), c.category].filter(Boolean).join(" · "),
      meta: `Manque : ${miss.join(", ")}`,
      href: `/admin/matchs/resultats/${c.id}`,
      urgent: miss.includes("score")
    }));
}
