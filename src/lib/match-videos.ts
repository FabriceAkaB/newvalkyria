/** Matchs filmés dans l'espace client des familles (demande de JP, 7 nov. 2026).
 *
 *  Hébergement : Cloudflare Stream (la vidéo est convertie en plusieurs qualités, elle joue sans attendre sur un
 *  téléphone ; chaque lecture passe par un lien signé qui expire : une vidéo d'enfants n'est jamais publique).
 *  JP colle une fois l'identifiant du compte et une clé API dans l'admin (app_settings « cloudflare_stream », clé chiffrée).
 *
 *  Deux façons d'ajouter un match : un lien de téléchargement (Veo, Google Drive…) que Cloudflare va chercher lui-même,
 *  ou un fichier envoyé du navigateur directement chez Cloudflare (protocole tus, reprise si la connexion coupe).
 *  Règles pures : match-videos-core.ts. */

import { CLUB_ID } from "@/lib/club";
import { decryptSecret, encryptSecret } from "@/lib/mail-config";
import { canPublish, canWatch, classifyRecording, isNewvalRecording, montrealParts, streamHostOf, summarizeConsent, type ConsentSummary, type VideoCandidate } from "@/lib/match-videos-core";
import { loadExpectedPlayers, loadTeamTargets, openRobotSession } from "@/lib/mcs-robot-runner";
import { personKey } from "@/lib/mcs-rules";
import { getChildrenForParent, getVerifiedParentEmail } from "@/lib/parent-repo";
import { consentState } from "@/lib/players-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

const KEY = "cloudflare_stream";
const API = "https://api.cloudflare.com/client/v4";

interface StreamConfig {
  accountId: string;
  token: string;
  host: string | null;
}

export async function getStreamConfig(): Promise<StreamConfig | null> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", KEY).maybeSingle();
  if (!data?.value) return null;
  try {
    const v = JSON.parse(data.value);
    return { accountId: v.accountId, token: decryptSecret(v.token), host: v.host ?? null };
  } catch {
    return null;
  }
}

async function writeConfig(c: StreamConfig) {
  const value = JSON.stringify({ accountId: c.accountId, token: encryptSecret(c.token), host: c.host });
  const { error } = await db().from("app_settings").upsert({ club_id: CLUB_ID, key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
}

async function cf(c: StreamConfig, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}/accounts/${c.accountId}${path}`, { ...init, headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.errors?.[0]?.message ?? `Cloudflare a refusé (${res.status}).`);
  return json?.result;
}

/** Enregistre le compte Cloudflare Stream après avoir vérifié que la clé fonctionne. */
export async function saveStreamConfig(accountId: string, token: string): Promise<void> {
  const c = { accountId: accountId.trim(), token: token.trim(), host: null };
  if (!/^[a-f0-9]{32}$/.test(c.accountId)) throw new Error("L'identifiant du compte Cloudflare a 32 caractères (lettres a-f et chiffres).");
  await cf(c, "/stream?limit=1");
  await writeConfig(c);
}

export interface MatchVideo {
  id: string;
  kind: "match" | "pratique";
  activity_id: string | null;
  team_id: string | null;
  mcs_event_id: number | null;
  match_date: string;
  title: string;
  opponent: string | null;
  source: string;
  stream_uid: string | null;
  status: "importation" | "traitement" | "pret" | "erreur";
  duration_s: number | null;
  error: string | null;
  published: boolean;
  published_at: string | null;
  participant_keys: string[];
  created_at: string;
}

const COLS = "id, kind, activity_id, team_id, mcs_event_id, match_date, title, opponent, source, stream_uid, status, duration_s, error, published, published_at, participant_keys, created_at";
const norm = (r: any): MatchVideo => ({ ...r, match_date: String(r.match_date).slice(0, 10), participant_keys: r.participant_keys ?? [] });

/** Les matchs de l'équipe (MonClubSportif) qu'on peut associer à une vidéo : les 60 derniers jours et les 14 prochains. */
export async function getFilmableMatches(): Promise<{ teamId: string; teamName: string; mcsEventId: number | null; date: string; start: string; title: string }[]> {
  const from = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const [teams, { data }] = await Promise.all([loadTeamTargets(), db().from("delivery_events").select("team_id, mcs_event_id, title, event_date, kind, cancelled").eq("club_id", CLUB_ID).eq("kind", "match").is("removed_at", null).gte("event_date", from).lte("event_date", to)]);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  return ((data ?? []) as any[])
    .filter((e) => !e.cancelled && name.has(e.team_id))
    .map((e) => ({ teamId: e.team_id, teamName: name.get(e.team_id)!, mcsEventId: e.mcs_event_id ? Number(e.mcs_event_id) : null, date: String(e.event_date).slice(0, 10), start: "", title: String(e.title ?? "Match") }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.teamName.localeCompare(b.teamName));
}

/** Les joueuses de l'équipe (et les invitées présentes) avec leur accord photo et vidéo. */
export async function consentForVideo(v: Pick<MatchVideo, "team_id" | "participant_keys">): Promise<ConsentSummary & { total: number }> {
  const [players, { data: rows }] = await Promise.all([loadExpectedPlayers(), db().from("players").select("first_name, last_name, image_consent, image_consent_at")]);
  const state = new Map<string, ReturnType<typeof consentState>>();
  for (const p of (rows ?? []) as any[]) {
    const k = personKey(p.first_name, p.last_name);
    const s = consentState(p);
    // Une même joueuse en double dans la base : le « oui » ou le « non » répondu l'emporte sur l'absence de réponse.
    if (!state.has(k) || state.get(k) === "sans-reponse") state.set(k, s);
  }
  const keys = new Map<string, string>();
  for (const p of players) if (v.team_id && p.teams.some((t) => t.id === v.team_id)) keys.set(p.key, `${p.firstName} ${p.lastName}`.trim());
  for (const k of v.participant_keys ?? []) if (!keys.has(k)) keys.set(k, k.replace(/\b\w/g, (c) => c.toUpperCase()));
  const list = [...keys].map(([k, name]) => ({ name, state: state.get(k) ?? ("sans-reponse" as const) }));
  return { ...summarizeConsent(list), total: list.length };
}

export async function listMatchVideos(): Promise<(MatchVideo & { teamName: string | null })[]> {
  const [teams, { data }] = await Promise.all([loadTeamTargets(), db().from("match_videos").select(COLS).eq("club_id", CLUB_ID).order("match_date", { ascending: false })]);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  return ((data ?? []) as any[]).map((r) => ({ ...norm(r), teamName: r.team_id ? name.get(r.team_id) ?? null : null }));
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

interface NewVideo {
  kind?: "match" | "pratique";
  activityId?: string | null;
  teamId: string | null;
  mcsEventId: number | null;
  date: string;
  title: string;
  opponent?: string | null;
  by: string;
}

async function insertVideo(v: NewVideo, source: "veo" | "fichier" | "lien", sourceUrl: string | null, uid: string | null, status: MatchVideo["status"]): Promise<string> {
  const kind = v.kind ?? "match";
  const participant_keys = kind === "match" ? await participantsFromMcs(v.teamId, v.mcsEventId) : [];
  const { data, error } = await db()
    .from("match_videos")
    .insert({ club_id: CLUB_ID, kind, activity_id: v.activityId ?? null, team_id: v.teamId, mcs_event_id: v.mcsEventId, match_date: v.date, title: v.title, opponent: v.opponent ?? null, source, source_url: sourceUrl, stream_uid: uid, status, participant_keys, created_by: v.by })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Cloudflare va chercher la vidéo lui-même à ce lien (lien de téléchargement Veo, Drive, Dropbox…). */
export async function importVideoFromUrl(v: NewVideo & { url: string }): Promise<string> {
  const c = await getStreamConfig();
  if (!c) throw new Error("Branche d'abord le compte Cloudflare Stream (en haut de la page).");
  if (!/^https:\/\//.test(v.url)) throw new Error("Le lien doit commencer par https://");
  const r = await cf(c, "/stream/copy", { method: "POST", body: JSON.stringify({ url: v.url, requireSignedURLs: true, meta: { name: `${v.date} ${v.title}` } }) });
  return insertVideo(v, /veo/i.test(v.url) ? "veo" : "lien", v.url, r.uid, "importation");
}

/** Adresse d'envoi directe (tus) pour un fichier choisi dans le navigateur : le fichier ne passe pas par le site. */
export async function startFileUpload(v: NewVideo & { size: number; filename: string }): Promise<{ id: string; uploadUrl: string }> {
  const c = await getStreamConfig();
  if (!c) throw new Error("Branche d'abord le compte Cloudflare Stream (en haut de la page).");
  if (!(v.size > 0)) throw new Error("Fichier vide.");
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
  const res = await fetch(`${API}/accounts/${c.accountId}/stream?direct_user=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(v.size), "Upload-Metadata": `name ${b64(`${v.date} ${v.title}`)},requiresignedurls,filename ${b64(v.filename)}` },
    cache: "no-store"
  });
  const uploadUrl = res.headers.get("location");
  const uid = res.headers.get("stream-media-id");
  if (!res.ok || !uploadUrl || !uid) throw new Error(`Cloudflare a refusé l'envoi (${res.status}).`);
  const id = await insertVideo(v, "fichier", null, uid, "importation");
  return { id, uploadUrl };
}

/** Relit chez Cloudflare l'état des vidéos pas encore prêtes (importation, conversion). */
export async function refreshVideoStatuses(): Promise<void> {
  const c = await getStreamConfig();
  if (!c) return;
  const { data } = await db().from("match_videos").select("id, stream_uid, status").eq("club_id", CLUB_ID).in("status", ["importation", "traitement"]).not("stream_uid", "is", null);
  for (const r of (data ?? []) as any[]) {
    try {
      const v = await cf(c, `/stream/${r.stream_uid}`);
      const state = v?.status?.state as string | undefined;
      const status = v?.readyToStream ? "pret" : state === "error" ? "erreur" : state === "inprogress" || state === "queued" ? "traitement" : r.status;
      await db().from("match_videos").update({ status, duration_s: v?.duration > 0 ? Math.round(v.duration) : null, error: state === "error" ? v?.status?.errorReasonText ?? "Erreur de conversion" : null, updated_at: new Date().toISOString() }).eq("id", r.id);
      const host = streamHostOf(v?.playback?.hls);
      if (host && host !== c.host) await writeConfig({ ...c, host });
    } catch {
      /* on réessaie au prochain passage */
    }
  }
}

export async function publishVideo(id: string, publish: boolean, confirmed: boolean): Promise<{ ok: boolean; reason?: string }> {
  const { data: v } = await db().from("match_videos").select(COLS).eq("id", id).maybeSingle();
  if (!v) return { ok: false, reason: "Vidéo introuvable." };
  if (publish) {
    if (v.kind === "pratique") return { ok: false, reason: "Une pratique filmée reste pour les éducateurs : elle ne se publie pas aux familles." };
    if (v.status !== "pret") return { ok: false, reason: "La vidéo n'est pas encore prête chez Cloudflare." };
    const check = canPublish(await consentForVideo(norm(v)), confirmed);
    if (!check.ok) return check;
  }
  const { error } = await db().from("match_videos").update({ published: publish, published_at: publish ? new Date().toISOString() : null, consent_checked: publish ? true : v.consent_checked ?? false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteVideo(id: string): Promise<void> {
  const { data: v } = await db().from("match_videos").select("stream_uid").eq("id", id).maybeSingle();
  const c = await getStreamConfig();
  if (c && v?.stream_uid) await cf(c, `/stream/${v.stream_uid}`, { method: "DELETE" }).catch(() => null);
  await db().from("match_videos").delete().eq("id", id);
}

/* ── Côté famille ─────────────────────────────────────────────────────────── */

/** Les joueuses d'un compte parent (courriel confirmé seulement) : clés de nom et équipes MonClubSportif. */
async function familyOf(userId: string): Promise<{ keys: string[]; teamIds: string[]; names: string[] }> {
  const email = (await getVerifiedParentEmail(userId))?.toLowerCase();
  if (!email) return { keys: [], teamIds: [], names: [] };
  const [players, children] = await Promise.all([loadExpectedPlayers(), getChildrenForParent(userId)]);
  const childKeys = new Set(children.filter((c) => c.player_id).map((c) => personKey(c.first_name, c.last_name)));
  const mine = players.filter((p) => p.parentEmail?.toLowerCase() === email || childKeys.has(p.key));
  return { keys: [...new Set([...mine.map((p) => p.key), ...childKeys])], teamIds: [...new Set(mine.flatMap((p) => p.teams.map((t) => t.id)))], names: mine.map((p) => p.firstName) };
}

export interface FamilyVideo {
  id: string;
  date: string;
  title: string;
  opponent: string | null;
  teamName: string | null;
  duration_s: number | null;
}

export async function videosForParent(userId: string): Promise<{ verified: boolean; videos: FamilyVideo[] }> {
  const verified = Boolean(await getVerifiedParentEmail(userId));
  if (!verified) return { verified, videos: [] };
  const [family, all] = await Promise.all([familyOf(userId), listMatchVideos()]);
  return { verified, videos: all.filter((v) => v.kind === "match" && canWatch(v, family)).map((v) => ({ id: v.id, date: v.match_date, title: v.title, opponent: v.opponent, teamName: v.teamName, duration_s: v.duration_s })) };
}

/** Adresse du lecteur pour cette famille (lien signé, 4 h), ou null si elle n'y a pas droit. Chaque lecture est notée. */
export async function playerUrlFor(userId: string, videoId: string): Promise<string | null> {
  const [family, { data: v }, c] = await Promise.all([familyOf(userId), db().from("match_videos").select(COLS).eq("id", videoId).maybeSingle(), getStreamConfig()]);
  if (!v || !c || !v.stream_uid || v.kind !== "match" || !canWatch(norm(v), family)) return null;
  const url = await signedPlayerUrl(c, v.stream_uid);
  await db().from("match_video_views").insert({ video_id: videoId, parent_user_id: userId });
  return url;
}

async function signedPlayerUrl(c: StreamConfig, uid: string): Promise<string> {
  const r = await cf(c, `/stream/${uid}/token`, { method: "POST", body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 4 * 3600 }) });
  return c.host ? `https://${c.host}/${r.token}/iframe` : `https://iframe.videodelivery.net/${r.token}`;
}

/** Aperçu pour l'admin (toutes les vidéos, publiées ou non). */
export async function adminPlayerUrl(videoId: string): Promise<string | null> {
  const [{ data: v }, c] = await Promise.all([db().from("match_videos").select("stream_uid, status").eq("id", videoId).maybeSingle(), getStreamConfig()]);
  if (!v?.stream_uid || v.status !== "pret" || !c) return null;
  return signedPlayerUrl(c, v.stream_uid);
}

/* ── Côté éducateurs : les pratiques filmées ──────────────────────────────── */

/** Les pratiques des 60 derniers jours (activités de l'académie) qu'on peut associer à une vidéo. */
export async function getFilmablePractices(): Promise<{ activityId: string; date: string; start: string; title: string }[]> {
  const from = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const { data } = await db().from("coach_activities").select("id, activity_date, start_time, title, category, activity_type, organization").gte("activity_date", from).lte("activity_date", to).order("activity_date", { ascending: false }).order("start_time");
  return ((data ?? []) as any[])
    .filter((a) => a.activity_type !== "Match")
    .map((a) => ({ activityId: a.id, date: String(a.activity_date).slice(0, 10), start: String(a.start_time ?? "").slice(0, 5), title: `${a.title ?? a.category ?? "Pratique"}${a.organization ? ` (${a.organization})` : ""}` }));
}

/** Les vidéos prêtes d'une activité (pratique ou match), pour sa page dans le portail des éducateurs. */
export async function videosForActivity(activityId: string): Promise<{ id: string; title: string; duration_s: number | null }[]> {
  const { data } = await db().from("match_videos").select("id, title, duration_s").eq("activity_id", activityId).eq("status", "pret").order("created_at");
  return (data ?? []) as any[];
}

/** Lecteur pour un éducateur assigné à l'activité de la vidéo (l'appelant a vérifié l'assignation). */
export async function coachPlayerUrl(videoId: string, allowedActivityIds: string[]): Promise<string | null> {
  const [{ data: v }, c] = await Promise.all([db().from("match_videos").select("stream_uid, status, activity_id").eq("id", videoId).maybeSingle(), getStreamConfig()]);
  if (!v?.stream_uid || v.status !== "pret" || !c || !v.activity_id || !allowedActivityIds.includes(v.activity_id)) return null;
  return signedPlayerUrl(c, v.stream_uid);
}

/* ── Veo : ranger les enregistrements « Newval … » ─────────────────────────── */

export interface VeoRecording {
  /** Identifiant Veo de l'enregistrement. */
  id: string;
  title: string;
  /** Début de l'enregistrement (ISO, avec fuseau). */
  start: string;
  durationS: number | null;
  /** Fichier vidéo 1080p (c.veocdn.com/…/video.mp4). */
  mp4: string | null;
}

export interface VeoImportResult {
  title: string;
  date: string;
  outcome: "importee" | "deja" | "a-classer" | "ignoree" | "erreur";
  where?: string;
  reason?: string;
}

/** Les activités d'un jour (MonClubSportif : matchs et pratiques des équipes ; site : pratiques du portail). */
async function candidatesOn(date: string): Promise<VideoCandidate[]> {
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
    const [h, m] = String(e.start_time ?? "").split(":").map(Number);
    if (id && Number.isFinite(h)) startOf.set(id, h * 60 + (m || 0));
  }
  const toMin = (t: string | null) => {
    const [h, m] = String(t ?? "").split(":").map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };
  const fromMcs: VideoCandidate[] = ((evs ?? []) as any[])
    .filter((e) => !e.cancelled && name.has(e.team_id) && (e.kind === "match" || e.kind === "pratique"))
    .map((e) => ({ kind: e.kind, teamId: e.team_id, teamName: name.get(e.team_id)!, mcsEventId: Number(e.mcs_event_id), activityId: null, title: String(e.title ?? ""), startMin: startOf.get(Number(e.mcs_event_id)) ?? null }));
  const fromSite: VideoCandidate[] = ((acts ?? []) as any[])
    .filter((a) => !a.organization)
    .map((a) => ({ kind: a.activity_type === "Match" ? "match" : "pratique", teamId: null, teamName: String(a.title ?? a.category ?? "Pratique"), mcsEventId: null, activityId: a.id, title: String(a.activity_type ?? ""), startMin: toMin(a.start_time) }));
  return [...fromMcs, ...fromSite];
}

/** Range les enregistrements Veo dont le titre commence par « Newval » : match → espace client des familles de
 *  l'équipe (après le contrôle de l'accord), pratique → portail des éducateurs. Cloudflare va chercher le fichier chez
 *  Veo lui-même. Un enregistrement déjà importé n'est jamais importé deux fois. */
export async function importVeoRecordings(recs: VeoRecording[], opts: { dryRun?: boolean } = {}): Promise<VeoImportResult[]> {
  const { data: existing } = await db().from("match_videos").select("source_url").eq("club_id", CLUB_ID).eq("source", "veo");
  const seen = new Set(((existing ?? []) as any[]).map((r) => String(r.source_url)));
  const out: VeoImportResult[] = [];
  for (const r of recs) {
    const { date, startMin } = montrealParts(r.start);
    if (!isNewvalRecording(r.title)) {
      out.push({ title: r.title, date, outcome: "ignoree", reason: "Le titre ne commence pas par « Newval »." });
      continue;
    }
    if (!r.mp4) {
      out.push({ title: r.title, date, outcome: "erreur", reason: "Veo n'a pas encore le fichier vidéo (enregistrement en préparation)." });
      continue;
    }
    if (seen.has(r.mp4)) {
      out.push({ title: r.title, date, outcome: "deja" });
      continue;
    }
    const { candidate, reason } = classifyRecording({ title: r.title, startMin }, await candidatesOn(date));
    if (!candidate) {
      out.push({ title: r.title, date, outcome: "a-classer", reason });
      continue;
    }
    const where = `${candidate.kind === "match" ? "Match" : "Pratique"} · ${candidate.teamName}`;
    if (!opts.dryRun) {
      try {
        await importVideoFromUrl({ kind: candidate.kind, activityId: candidate.activityId, teamId: candidate.teamId, mcsEventId: candidate.mcsEventId, date, title: `${candidate.teamName} — ${candidate.kind === "match" ? "match" : "pratique"} (${r.title.trim()})`, by: "veo", url: r.mp4 });
        seen.add(r.mp4);
      } catch (e) {
        out.push({ title: r.title, date, outcome: "erreur", where, reason: e instanceof Error ? e.message : "Erreur" });
        continue;
      }
    }
    out.push({ title: r.title, date, outcome: "importee", where });
  }
  return out;
}
