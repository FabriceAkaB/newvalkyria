/** Matchs et pratiques filmés avec la caméra Veo (demande de JP, 7 nov. 2026).
 *
 *  Les vidéos restent chez Veo (rien n'est hébergé par le site) : on garde le lien du fichier 1080p, l'image d'aperçu,
 *  les périodes et les temps forts (buts, tirs… détectés par Veo) pour un lecteur où l'on saute directement au moment.
 *  - Match : dans l'espace client des familles de l'équipe et des joueuses présentes (`/compte/matchs`).
 *  - Pratique : seulement les éducateurs assignés, sur la page de l'activité du portail (le jour de l'évaluation).
 *  - Les administrateurs voient tout dans `/admin/matchs/videos`.
 *  Seuls les enregistrements Veo dont le titre commence par « Newval » sont rangés (robot : veo-robot.ts).
 *  Règles pures : match-videos-core.ts. */

import { CLUB_ID } from "@/lib/club";
import { canWatch, classifyRecording, highlightsFromVeo, isNewvalRecording, montrealParts, periodsFromVeo, type VideoCandidate, type VideoHighlight, type VideoPeriod } from "@/lib/match-videos-core";
import { loadExpectedPlayers, loadTeamTargets, openRobotSession } from "@/lib/mcs-robot-runner";
import { personKey } from "@/lib/mcs-rules";
import { getChildrenForParent, getVerifiedParentEmail } from "@/lib/parent-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface MatchVideo {
  id: string;
  kind: "match" | "pratique";
  activity_id: string | null;
  team_id: string | null;
  mcs_event_id: number | null;
  match_date: string | null;
  title: string;
  veo_title: string | null;
  veo_slug: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  status: "pret" | "a-classer" | "erreur" | "importation" | "traitement";
  duration_s: number | null;
  error: string | null;
  published: boolean;
  participant_keys: string[];
  periods: VideoPeriod[];
  highlights: VideoHighlight[];
  created_at: string;
}

const COLS = "id, kind, activity_id, team_id, mcs_event_id, match_date, title, veo_title, veo_slug, video_url, thumbnail_url, status, duration_s, error, published, participant_keys, periods, highlights, created_at";
const norm = (r: any): MatchVideo => ({ ...r, match_date: r.match_date ? String(r.match_date).slice(0, 10) : null, participant_keys: r.participant_keys ?? [], periods: r.periods ?? [], highlights: r.highlights ?? [] });

export async function listMatchVideos(): Promise<(MatchVideo & { teamName: string | null })[]> {
  const [teams, { data }] = await Promise.all([loadTeamTargets(), db().from("match_videos").select(COLS).eq("club_id", CLUB_ID).order("match_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })]);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  return ((data ?? []) as any[]).map((r) => ({ ...norm(r), teamName: r.team_id ? name.get(r.team_id) ?? null : null }));
}

const toMin = (t: string | null | undefined) => {
  const [h, m] = String(t ?? "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

/** Les activités d'un jour : matchs et pratiques des équipes (MonClubSportif) et pratiques du portail (site). */
export async function candidatesOn(date: string): Promise<VideoCandidate[]> {
  const [teams, { data: evs }, { data: times }, { data: acts }] = await Promise.all([
    loadTeamTargets(),
    db().from("delivery_events").select("team_id, mcs_event_id, title, kind, cancelled").eq("club_id", CLUB_ID).eq("event_date", date).is("removed_at", null),
    db().from("mcs_events").select("key, start_time").eq("event_date", date),
    db().from("coach_activities").select("id, start_time, title, category, activity_type, organization").eq("activity_date", date)
  ]);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  const startOf = new Map<number, number>();
  for (const e of (times ?? []) as any[]) {
    const id = Number(String(e.key).match(/^(?:event|game)-(\d+)@/)?.[1]);
    const m = toMin(e.start_time);
    if (id && m !== null) startOf.set(id, m);
  }
  const fromMcs: VideoCandidate[] = ((evs ?? []) as any[])
    .filter((e) => !e.cancelled && name.has(e.team_id) && (e.kind === "match" || e.kind === "pratique"))
    .map((e) => ({ kind: e.kind, teamId: e.team_id, teamName: name.get(e.team_id)!, mcsEventId: Number(e.mcs_event_id), activityId: null, title: String(e.title ?? ""), startMin: startOf.get(Number(e.mcs_event_id)) ?? null }));
  const fromSite: VideoCandidate[] = ((acts ?? []) as any[])
    .filter((a) => !a.organization)
    .map((a) => ({ kind: a.activity_type === "Match" ? "match" : "pratique", teamId: null, teamName: String(a.title ?? a.category ?? "Pratique"), mcsEventId: null, activityId: a.id, title: String(a.activity_type ?? ""), startMin: toMin(a.start_time) }));
  return [...fromMcs, ...fromSite];
}

/** Joueuses présentes au match d'après MonClubSportif (clés de nom) ; vide si la grille ne montre pas ce match. */
async function participantsFromMcs(teamId: string | null, eventId: number | null): Promise<string[]> {
  if (!teamId || !eventId) return [];
  const team = (await loadTeamTargets()).find((t) => t.id === teamId);
  if (!team?.mcs_team_id || !team.mcs_season_id) return [];
  try {
    const s = await openRobotSession();
    if (!s) return [];
    const grid = await s.presencesAll(team.mcs_team_id, team.mcs_season_id);
    if (!grid.events.some((e) => e.id === eventId)) return [];
    return grid.rows.filter((r) => r.states[eventId] === "present" || r.states[eventId] === "late").map((r) => personKey(r.name, ""));
  } catch {
    return [];
  }
}

const placeTitle = (c: Pick<VideoCandidate, "teamName" | "kind">) => `${c.teamName} — ${c.kind === "match" ? "match" : "pratique"}`;

/** Ce que la ligne devient une fois rangée : un match est tout de suite dans l'espace client des familles. */
async function placement(c: Pick<VideoCandidate, "kind" | "teamId" | "teamName" | "mcsEventId" | "activityId">) {
  return {
    kind: c.kind,
    team_id: c.teamId,
    mcs_event_id: c.mcsEventId,
    activity_id: c.activityId,
    title: placeTitle(c),
    status: "pret",
    error: null,
    published: c.kind === "match",
    published_at: c.kind === "match" ? new Date().toISOString() : null,
    participant_keys: c.kind === "match" ? await participantsFromMcs(c.teamId, c.mcsEventId) : []
  };
}

/* ── Veo ─────────────────────────────────────────────────────────────────── */

export interface VeoRecording {
  slug: string;
  title: string;
  /** Début de l'enregistrement (ISO, avec fuseau). */
  start: string;
  durationS: number | null;
  /** Fichier vidéo 1080p (c.veocdn.com/…/video.mp4), null si Veo le prépare encore. */
  mp4: string | null;
  thumbnail: string | null;
  periods: unknown;
  highlights: unknown;
}

export interface VeoImportResult {
  title: string;
  date: string;
  outcome: "rangee" | "deja" | "a-classer" | "ignoree" | "en-preparation" | "erreur";
  where?: string;
  reason?: string;
}

/** Range les enregistrements Veo « Newval » : match → familles de l'équipe, pratique → éducateurs. Un enregistrement
 *  déjà connu garde sa place ; seuls ses temps forts, périodes et liens sont remis à jour (Veo en ajoute après coup). */
export async function importVeoRecordings(recs: VeoRecording[], opts: { dryRun?: boolean } = {}): Promise<VeoImportResult[]> {
  const { data: existing } = await db().from("match_videos").select("id, veo_slug, title, status").eq("club_id", CLUB_ID).not("veo_slug", "is", null);
  const known = new Map(((existing ?? []) as any[]).map((r) => [String(r.veo_slug), r]));
  const out: VeoImportResult[] = [];
  for (const r of recs) {
    const { date, startMin } = montrealParts(r.start);
    if (!isNewvalRecording(r.title)) {
      out.push({ title: r.title, date, outcome: "ignoree", reason: "Le titre ne commence pas par « Newval »." });
      continue;
    }
    if (!r.mp4) {
      out.push({ title: r.title, date, outcome: "en-preparation", reason: "Veo prépare encore la vidéo : elle sera rangée au prochain passage." });
      continue;
    }
    const media = { video_url: r.mp4, thumbnail_url: r.thumbnail, periods: periodsFromVeo(r.periods), highlights: highlightsFromVeo(r.highlights), duration_s: r.durationS ? Math.round(r.durationS) : null, veo_title: r.title.trim(), updated_at: new Date().toISOString() };
    const prev = known.get(r.slug);
    if (prev) {
      if (!opts.dryRun) await db().from("match_videos").update(media).eq("id", prev.id);
      out.push({ title: r.title, date, outcome: prev.status === "a-classer" ? "a-classer" : "deja", where: prev.status === "a-classer" ? undefined : prev.title });
      continue;
    }
    const { candidate, reason } = classifyRecording({ title: r.title, startMin }, await candidatesOn(date));
    const row = { club_id: CLUB_ID, source: "veo", source_url: `https://app.veo.co/matches/${r.slug}/`, veo_slug: r.slug, match_date: date, created_by: "veo", ...media };
    if (!opts.dryRun) {
      const insert = candidate ? { ...row, ...(await placement(candidate)) } : { ...row, kind: /pratique|practice|entrainement/i.test(r.title) ? "pratique" : "match", title: r.title.trim(), status: "a-classer", error: reason, published: false };
      const { error } = await db().from("match_videos").insert(insert);
      if (error) {
        out.push({ title: r.title, date, outcome: "erreur", reason: error.message });
        continue;
      }
    }
    out.push(candidate ? { title: r.title, date, outcome: "rangee", where: placeTitle(candidate) } : { title: r.title, date, outcome: "a-classer", reason });
  }
  return out;
}

/* ── Admin ───────────────────────────────────────────────────────────────── */

/** Ranger à la main une vidéo « à classer » (ou la déplacer) : une activité de ce jour-là, ou une équipe. */
export async function assignVideo(id: string, target: { kind: "match" | "pratique"; teamId: string | null; mcsEventId: number | null; activityId: string | null; teamName: string }): Promise<void> {
  const { error } = await db().from("match_videos").update({ ...(await placement(target)), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setVideoPublished(id: string, published: boolean): Promise<void> {
  const { error } = await db().from("match_videos").update({ published, published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("kind", "match");
  if (error) throw new Error(error.message);
}

/** Retirer du site (la vidéo reste dans Veo). */
export async function deleteVideo(id: string): Promise<void> {
  const { error } = await db().from("match_videos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface PlayerData {
  title: string;
  date: string | null;
  url: string;
  poster: string | null;
  duration_s: number | null;
  periods: VideoPeriod[];
  highlights: VideoHighlight[];
}

const toPlayer = (v: MatchVideo): PlayerData | null => (v.video_url ? { title: v.title, date: v.match_date, url: v.video_url, poster: v.thumbnail_url, duration_s: v.duration_s, periods: v.periods, highlights: v.highlights } : null);

async function getVideo(id: string): Promise<MatchVideo | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db().from("match_videos").select(COLS).eq("id", id).maybeSingle();
  return data ? norm(data) : null;
}

export async function adminPlayerData(id: string): Promise<PlayerData | null> {
  const v = await getVideo(id);
  return v ? toPlayer(v) : null;
}

/* ── Familles ───────────────────────────────────────────────────────────── */

/** Les joueuses d'un compte parent (courriel confirmé seulement) : clés de nom et équipes MonClubSportif. */
async function familyOf(userId: string): Promise<{ keys: string[]; teamIds: string[] }> {
  const email = (await getVerifiedParentEmail(userId))?.toLowerCase();
  if (!email) return { keys: [], teamIds: [] };
  const [players, children] = await Promise.all([loadExpectedPlayers(), getChildrenForParent(userId)]);
  const childKeys = new Set(children.filter((c) => c.player_id).map((c) => personKey(c.first_name, c.last_name)));
  const mine = players.filter((p) => p.parentEmail?.toLowerCase() === email || childKeys.has(p.key));
  return { keys: [...new Set([...mine.map((p) => p.key), ...childKeys])], teamIds: [...new Set(mine.flatMap((p) => p.teams.map((t) => t.id)))] };
}

export interface FamilyVideo {
  id: string;
  date: string | null;
  title: string;
  teamName: string | null;
  duration_s: number | null;
  poster: string | null;
  goals: number;
}

export async function videosForParent(userId: string): Promise<{ verified: boolean; videos: FamilyVideo[] }> {
  const verified = Boolean(await getVerifiedParentEmail(userId));
  if (!verified) return { verified, videos: [] };
  const [family, all] = await Promise.all([familyOf(userId), listMatchVideos()]);
  return {
    verified,
    videos: all.filter((v) => canWatch(v, family)).map((v) => ({ id: v.id, date: v.match_date, title: v.title, teamName: v.teamName, duration_s: v.duration_s, poster: v.thumbnail_url, goals: v.highlights.filter((h) => h.type === "goal").length }))
  };
}

/** Le lecteur pour cette famille, ou null si elle n'y a pas droit. Chaque ouverture est notée (qui a vu quoi). */
export async function playerDataForParent(userId: string, videoId: string): Promise<PlayerData | null> {
  const [family, v] = await Promise.all([familyOf(userId), getVideo(videoId)]);
  if (!v || !canWatch(v, family)) return null;
  await db().from("match_video_views").insert({ video_id: videoId, parent_user_id: userId });
  return toPlayer(v);
}

/* ── Éducateurs : les pratiques (et matchs) de leurs activités ─────────────── */

/** Les vidéos rangées d'une activité du portail, pour sa page (étape « Après », le jour de l'évaluation). */
export async function videosForActivity(activityId: string): Promise<{ id: string; title: string }[]> {
  const { data } = await db().from("match_videos").select("id, title").eq("activity_id", activityId).eq("status", "pret").order("created_at");
  return (data ?? []) as any[];
}

/** Lecteur pour un éducateur assigné à l'activité de la vidéo (l'appelant donne ses activités). */
export async function playerDataForCoach(videoId: string, allowedActivityIds: string[]): Promise<PlayerData | null> {
  const v = await getVideo(videoId);
  if (!v || v.status !== "pret" || !v.activity_id || !allowedActivityIds.includes(v.activity_id)) return null;
  return toPlayer(v);
}

/** Toutes les heures : chaque vidéo rangée répond-elle encore chez Veo ? Un fichier expiré ou retiré passe en
 *  « erreur » (plus montré aux familles ni aux éducateurs) ; s'il revient, la vidéo est remise en place. */
export async function checkVideoFiles(): Promise<{ checked: number; broken: number; back: number }> {
  const { data } = await db().from("match_videos").select("id, status, video_url, error").eq("club_id", CLUB_ID).in("status", ["pret", "erreur"]).not("video_url", "is", null);
  let broken = 0;
  let back = 0;
  const LOST = "Le fichier n'est plus disponible chez Veo (expiré ou retiré).";
  for (const r of (data ?? []) as any[]) {
    const ok = await fetch(r.video_url, { method: "HEAD", cache: "no-store" }).then((x) => x.ok).catch(() => null);
    if (ok === null) continue; // réseau : on revérifie à l'heure suivante
    if (!ok && r.status === "pret") {
      broken++;
      await db().from("match_videos").update({ status: "erreur", error: LOST, updated_at: new Date().toISOString() }).eq("id", r.id);
    } else if (ok && r.status === "erreur" && r.error === LOST) {
      back++;
      await db().from("match_videos").update({ status: "pret", error: null, updated_at: new Date().toISOString() }).eq("id", r.id);
    }
  }
  return { checked: (data ?? []).length, broken, back };
}
