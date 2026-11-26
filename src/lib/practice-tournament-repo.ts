import { cleanCategory } from "@/lib/coach-portal-repo";
import { getActivity } from "@/lib/coaches-repo";
import { QUICK_CRITERIA } from "@/lib/coach-report";
import { captainTaskFor, type PastTeam } from "@/lib/practice-teams-core";
import { getTeamHistory, saveTeams } from "@/lib/practice-teams-repo";
import { getSurveyData } from "@/lib/practice-survey-repo";
import { parseResult, parseSettings, TOURNAMENT_COLORS, type Results, type TournamentSettings, type TournamentTeam } from "@/lib/practice-tournament";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate } from "@/lib/season-themes-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { themeForGroup } from "@/lib/theme-quiz-core";

/** Tournoi de fin de pratique (table `practice_tournaments`, une ligne par pratique). Règles : practice-tournament.ts.
 *  Les équipes sont aussi écrites dans `practice_teams` pour que le site se souvienne de qui était avec qui et de
 *  qui a été capitaine. Utilisé par la borne (code 180180), le portail des éducateurs et l'admin. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface TournamentState {
  settings: TournamentSettings;
  teams: TournamentTeam[];
  results: Results;
  present: string[];
  updatedAt: string | null;
}

export interface TournamentContext {
  activityId: string;
  title: string;
  /** Les filles attendues (groupes à la même heure au même endroit réunis), avec leur note moyenne. */
  players: { id: string; name: string; rating: number | null; absent: boolean }[];
  /** Qui a été avec qui et qui a été capitaine (6 derniers mois) : la borne forme les équipes même sans réseau. */
  history: PastTeam[];
  theme: string | null;
  captainTask: string;
  saved: TournamentState | null;
}

const nice = (s: string) => s.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

/** Note moyenne de chaque fille sur ses 10 dernières évaluations (Ball mastery, Prestation, Attitude, de 1 à 5). */
async function ratingsOf(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data } = await db().from("player_evaluations").select("registration_id, ratings, created_at").in("registration_id", ids).order("created_at", { ascending: false }).limit(3000);
  const per = new Map<string, number[]>();
  for (const e of (data ?? []) as any[]) {
    const list = per.get(e.registration_id) ?? [];
    if (list.length >= 10) continue;
    const v = QUICK_CRITERIA.map((c) => Number(e.ratings?.[c])).filter((x) => x >= 1 && x <= 5);
    if (v.length) list.push(v.reduce((s, x) => s + x, 0) / v.length);
    per.set(e.registration_id, list);
  }
  return new Map([...per.entries()].filter(([, v]) => v.length).map(([id, v]) => [id, Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100]));
}

const toState = (row: any): TournamentState | null =>
  row ? { settings: row.settings, teams: row.teams ?? [], results: row.results ?? {}, present: row.present ?? [], updatedAt: row.updated_at ?? null } : null;

export async function getTournament(activityId: string): Promise<TournamentState | null> {
  const { data, error } = await db().from("practice_tournaments").select("*").eq("activity_id", activityId).maybeSingle();
  if (error) throw new Error(error.message);
  return toState(data);
}

/** Tout ce qu'il faut pour former les équipes et jouer le tournoi, même hors réseau. */
export async function getTournamentContext(activityId: string): Promise<TournamentContext | null> {
  const data = await getSurveyData(activityId);
  if (!data) return null;
  const ids = data.roster.map((p) => p.registrationId);
  const date = String(data.activity.activity_date).slice(0, 10);
  const [ratings, history, theme, saved] = await Promise.all([
    ratingsOf(ids),
    // Seulement les pratiques jusqu'à aujourd'hui : les équipes préparées d'avance pour plus tard ne sont pas « déjà faites ».
    getTeamHistory(ids, activityId).then((h) => h.filter((t) => t.date && t.date <= date)).catch(() => []),
    getThemeForDate(SEASON_DB_ID, new Date(`${date}T12:00:00`)).catch(() => null),
    getTournament(activityId)
  ]);
  const themeText = theme ? themeForGroup(theme, cleanCategory(data.activity.category)) ?? theme.theme : null;
  const absent = new Set(data.attendance.filter((a: any) => a.status === "absent").map((a: any) => a.registration_id));
  const firsts = data.roster.map((p) => nice(p.firstName));
  return {
    activityId,
    title: data.label,
    players: data.roster.map((p, i) => {
      const first = firsts[i];
      // Prénom seul, sauf si deux filles ont le même : alors l'initiale du nom.
      const twin = firsts.filter((f) => f === first).length > 1;
      return { id: p.registrationId, name: twin ? `${first} ${p.lastName.trim().charAt(0).toUpperCase()}.` : first, rating: ratings.get(p.registrationId) ?? null, absent: absent.has(p.registrationId) };
    }),
    history,
    theme: themeText,
    captainTask: captainTaskFor(themeText),
    saved
  };
}

/** Enregistre le tournoi tel qu'il est sur l'écran (réglages, équipes, scores). Les équipes vont aussi dans
 *  `practice_teams` quand elles changent : c'est l'historique des équipes et des capitaines. */
export async function saveTournament(activityId: string, raw: unknown, by: string): Promise<TournamentState> {
  const body = (raw ?? {}) as Record<string, unknown>;
  const settings = parseSettings(body.settings);
  if (!settings) throw new Error("Réglages du tournoi invalides.");
  const data = await getSurveyData(activityId);
  if (!data) throw new Error("Pratique introuvable.");
  const known = new Set(data.roster.map((p) => p.registrationId));
  const used = new Set<string>();
  const teams: TournamentTeam[] = (Array.isArray(body.teams) ? body.teams : []).slice(0, 12).map((t: any, i: number) => {
    const members = (Array.isArray(t?.members) ? t.members : []).filter((m: unknown): m is string => typeof m === "string" && known.has(m) && !used.has(m));
    members.forEach((m: string) => used.add(m));
    const color = TOURNAMENT_COLORS.includes(String(t?.color)) ? String(t.color) : TOURNAMENT_COLORS[i % TOURNAMENT_COLORS.length];
    return { label: color, color, members, captain: typeof t?.captain === "string" && members.includes(t.captain) ? t.captain : null, joker: members.length > settings.format };
  });
  if (teams.filter((t) => t.members.length).length < 2) throw new Error("Il faut au moins 2 équipes.");
  const results: Results = {};
  for (const [id, r] of Object.entries((body.results ?? {}) as Record<string, unknown>)) {
    const parsed = parseResult(r);
    if (parsed && /^[a-z0-9-]{1,8}$/.test(id)) results[id] = parsed;
  }
  const present = (Array.isArray(body.present) ? body.present : []).filter((p: unknown): p is string => typeof p === "string" && known.has(p));
  const before = await getTournament(activityId);
  const theme = typeof body.theme === "string" ? body.theme.slice(0, 200) : null;
  const captainTask = captainTaskFor(theme);
  const row = { activity_id: activityId, settings, teams, results, present, theme, captain_task: captainTask, updated_by: by, updated_at: new Date().toISOString() };
  const { error } = await db()
    .from("practice_tournaments")
    .upsert(before ? row : { ...row, created_by: by }, { onConflict: "activity_id" });
  if (error) throw new Error(error.message);
  const sig = (ts: TournamentTeam[]) => JSON.stringify(ts.map((t) => [t.color, [...t.members].sort(), t.captain]));
  if (!before || sig(before.teams) !== sig(teams)) {
    await saveTeams(
      activityId,
      "equipe",
      teams.filter((t) => t.members.length).map((t) => ({ label: t.label, members: t.members, captain: t.captain, captainTask, color: t.color })),
      by
    );
  }
  return (await getTournament(activityId))!;
}

/** « Nouveau tournoi » : efface le tournoi de la pratique (les équipes enregistrées restent dans l'historique). */
export async function deleteTournament(activityId: string): Promise<void> {
  const { error } = await db().from("practice_tournaments").delete().eq("activity_id", activityId);
  if (error) throw new Error(error.message);
}

/** GET / PUT / DELETE communs aux trois portes (borne, portail, admin), une fois l'accès vérifié. */
export async function handleTournamentRequest(method: string, activityId: string, body: unknown, by: string): Promise<Response> {
  const json = (d: unknown, status = 200) => Response.json(d, { status });
  try {
    if (method === "GET") {
      const ctx = await getTournamentContext(activityId);
      return ctx ? json({ context: ctx }) : json({ error: "Pratique introuvable" }, 404);
    }
    if (method === "DELETE") {
      await deleteTournament(activityId);
      return json({ ok: true });
    }
    if (!(await getActivity(activityId))) return json({ error: "Pratique introuvable" }, 404);
    return json({ tournament: await saveTournament(activityId, body, by) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erreur" }, 422);
  }
}
