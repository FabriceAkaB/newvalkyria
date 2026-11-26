import { CLUB_ID } from "@/lib/club";
import {
  CHECKPOINTS,
  checkpointsFor,
  defaultCheckpointFor,
  isCheckpoint,
  isIsoDay,
  isVideoRequestActivity,
  parseCheckpoint,
  pickRequestDay,
  requestStatus,
  summarizeRequest,
  VIDEO_REQUESTS_START,
  videoRequestTask,
  type Checkpoint,
  type RequestStatus,
  type RequestSummary
} from "@/lib/progress-videos";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Vidéos de progression des joueuses (table `player_progress_videos`, compartiment privé `progression-videos`). */

function db() {
  return getSupabaseAdminClient() as any;
}

export const PROGRESS_BUCKET = "progression-videos";
const safeName = (n: string) => n.normalize("NFD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "video.mp4";

export interface ProgressVideo {
  id: string;
  registrationId: string;
  /** Étape de la saison (début, mi-saison, fin) ; rien = « Autre » (capsule du jour, pas dans l'avant / après). */
  checkpoint: Checkpoint | null;
  title: string;
  note: string | null;
  createdAt: string;
  /** Jour où la vidéo a été filmée. */
  filmedOn: string | null;
  /** Pratique de la demande de vidéos, s'il y a lieu. */
  activityId: string | null;
  uploadedBy?: string | null;
  url?: string | null;
}

const map = (r: any): ProgressVideo => ({
  id: r.id,
  registrationId: r.registration_id,
  checkpoint: parseCheckpoint(r.checkpoint),
  title: r.title,
  note: r.note,
  createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
  filmedOn: r.filmed_on ? String(r.filmed_on).slice(0, 10) : null,
  activityId: r.activity_id ?? null,
  uploadedBy: r.uploaded_by ?? null
});
const torontoDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

async function activeSeason(): Promise<{ id: string; starts_on: string; ends_on: string } | null> {
  const { data } = await db().from("seasons").select("id, starts_on, ends_on").eq("is_active", true).maybeSingle();
  return data ? { id: data.id, starts_on: String(data.starts_on).slice(0, 10), ends_on: String(data.ends_on).slice(0, 10) } : null;
}

export interface ProgressBoardRow {
  registrationId: string;
  name: string;
  /** Photo de nos dossiers (lien signé d'une heure), seulement si demandée. */
  photoUrl?: string | null;
  group: string;
  checkpoints: Checkpoint[];
  videos: ProgressVideo[];
}

/** Toutes les filles de la saison (par groupe) et leurs vidéos, pour l'admin. */
export async function getProgressBoard(opts: { withPhotos?: boolean } = {}): Promise<{ season: { id: string; starts_on: string; ends_on: string } | null; rows: ProgressBoardRow[] }> {
  const season = await activeSeason();
  if (!season) return { season: null, rows: [] };
  const [{ data: regs }, { data: vids }] = await Promise.all([
    db().from("registrations").select("id, player_first_name, player_last_name, category_id").eq("season_id", season.id).eq("status", "paid").eq("is_trial", false),
    db().from("player_progress_videos").select("*").eq("club_id", CLUB_ID).eq("season_id", season.id).order("created_at")
  ]);
  const rows = ((regs ?? []) as any[]).map((r) => ({
    registrationId: r.id,
    name: `${String(r.player_first_name).trim()} ${String(r.player_last_name).trim()}`,
    group: String(r.category_id),
    checkpoints: checkpointsFor(r.category_id),
    videos: ((vids ?? []) as any[]).filter((v) => v.registration_id === r.id).map(map)
  }));
  rows.sort((a, b) => b.group.localeCompare(a.group) || a.name.localeCompare(b.name, "fr"));
  if (opts.withPhotos) {
    const { getGirlPhotos } = await import("@/lib/family-photos");
    const photos = await getGirlPhotos(rows.map((r) => r.registrationId)).catch(() => new Map<string, string>());
    for (const r of rows) (r as ProgressBoardRow).photoUrl = photos.get(r.registrationId) ?? null;
  }
  return { season, rows };
}

/** Lien de dépôt signé : le navigateur envoie la vidéo directement au stockage privé. */
export async function createProgressUpload(registrationId: string, file: { fileName: string; contentType: string }): Promise<{ path: string; signedUrl: string }> {
  if (!/^video\//i.test(file.contentType)) throw new Error("Choisissez un fichier vidéo (MP4 ou MOV).");
  const path = `${CLUB_ID}/${registrationId}/${Date.now()}-${safeName(file.fileName)}`;
  const { data, error } = await db().storage.from(PROGRESS_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Lien de dépôt impossible à créer");
  return { path, signedUrl: data.signedUrl };
}

/** Relie la vidéo arrivée dans le stockage à la fille, au jour filmé et, s'il y a lieu, à l'étape et à la pratique. */
export async function attachProgressVideo(input: { registrationId: string; checkpoint?: unknown; title?: unknown; note?: unknown; path: string; fileName?: string; uploadedBy: string; filmedOn?: unknown; activityId?: unknown }): Promise<ProgressVideo> {
  if (input.checkpoint != null && input.checkpoint !== "" && input.checkpoint !== "autre" && !isCheckpoint(input.checkpoint)) throw new Error("Étape de la saison invalide");
  const folder = `${CLUB_ID}/${input.registrationId}`;
  const name = input.path.startsWith(`${folder}/`) ? input.path.slice(folder.length + 1) : "";
  if (!name || name.includes("/") || name.includes("..")) throw new Error("Fichier invalide");
  // Déjà reliée (réponse perdue quand le réseau a coupé, puis reprise) : on ne la compte pas deux fois.
  const { data: already } = await db().from("player_progress_videos").select("*").eq("storage_path", input.path).maybeSingle();
  if (already) return map(already);
  const { data: listed, error: listError } = await db().storage.from(PROGRESS_BUCKET).list(folder, { search: name, limit: 20 });
  if (listError) throw new Error(listError.message);
  if (!(listed ?? []).some((o: any) => o.name === name)) throw new Error("La vidéo n'est pas arrivée dans le stockage. Recommencez le dépôt.");
  let activityId: string | null = null;
  let filmedOn = isIsoDay(input.filmedOn) ? input.filmedOn : torontoDay();
  if (typeof input.activityId === "string" && /^[0-9a-f-]{36}$/i.test(input.activityId)) {
    const { data: act } = await db().from("coach_activities").select("id, activity_date").eq("id", input.activityId).maybeSingle();
    if (!act) throw new Error("Pratique introuvable");
    activityId = act.id;
    filmedOn = String(act.activity_date).slice(0, 10);
  }
  const season = await activeSeason();
  const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const { data, error } = await db()
    .from("player_progress_videos")
    .insert({ club_id: CLUB_ID, season_id: season?.id ?? null, registration_id: input.registrationId, checkpoint: parseCheckpoint(input.checkpoint), title: clean(input.title, 80) ?? "Ball mastery", note: clean(input.note, 1000), storage_path: input.path, file_name: input.fileName ?? null, uploaded_by: input.uploadedBy, filmed_on: filmedOn, activity_id: activityId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await syncVideoRequestTask(filmedOn).catch(() => undefined);
  return map(data);
}

export async function removeProgressVideo(id: string): Promise<void> {
  const { data } = await db().from("player_progress_videos").select("storage_path, filmed_on").eq("id", id).maybeSingle();
  if (!data) return;
  await db().storage.from(PROGRESS_BUCKET).remove([data.storage_path]);
  await db().from("player_progress_videos").delete().eq("id", id);
  if (data.filmed_on) await syncVideoRequestTask(String(data.filmed_on).slice(0, 10)).catch(() => undefined);
}

/** Change l'étape d'une vidéo (ou la retire : « Autre »). Une vidéo d'étape va dans l'avant / après de la famille. */
export async function setProgressVideoCheckpoint(id: string, checkpoint: unknown): Promise<void> {
  if (checkpoint != null && checkpoint !== "" && checkpoint !== "autre" && !isCheckpoint(checkpoint)) throw new Error("Étape de la saison invalide");
  const { error } = await db().from("player_progress_videos").update({ checkpoint: parseCheckpoint(checkpoint) }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Lien de lecture signé (2 heures) d'une vidéo. */
export async function progressVideoUrl(id: string): Promise<string | null> {
  const { data } = await db().from("player_progress_videos").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: signed } = await db().storage.from(PROGRESS_BUCKET).createSignedUrl(data.storage_path, 7200);
  return signed?.signedUrl ?? null;
}

/** Les vidéos des filles d'une famille (seulement leurs inscriptions), avec un lien signé de 2 heures chacune. */
export async function getFamilyProgressVideos(registrationIds: string[]): Promise<Map<string, { checkpoints: Checkpoint[]; videos: ProgressVideo[] }>> {
  const out = new Map<string, { checkpoints: Checkpoint[]; videos: ProgressVideo[] }>();
  if (!registrationIds.length) return out;
  const [{ data: regs }, { data: vids }] = await Promise.all([
    db().from("registrations").select("id, category_id").in("id", registrationIds),
    // La famille voit les vidéos d'étape (début, mi-saison, fin) ; les capsules « Autre » restent à l'interne.
    db().from("player_progress_videos").select("*").in("registration_id", registrationIds).not("checkpoint", "is", null).order("created_at")
  ]);
  const paths = ((vids ?? []) as any[]).map((v) => v.storage_path);
  const { data: signed } = paths.length ? await db().storage.from(PROGRESS_BUCKET).createSignedUrls(paths, 7200) : { data: [] };
  const urlOf = new Map(((signed ?? []) as any[]).map((s) => [s.path, s.signedUrl] as const));
  for (const r of (regs ?? []) as any[]) {
    out.set(r.id, {
      checkpoints: checkpointsFor(r.category_id),
      videos: ((vids ?? []) as any[]).filter((v) => v.registration_id === r.id).map((v) => ({ ...map(v), url: urlOf.get(v.storage_path) ?? null }))
    });
  }
  return out;
}

/* ── Fiche vidéo d'une joueuse : toutes ses vidéos, peu importe la date ───────────────────────────────────── */

export interface PlayerVideoFiche {
  registrationId: string;
  name: string;
  category: string | null;
  photoUrl: string | null;
  checkpoints: Checkpoint[];
  videos: ProgressVideo[];
}

export async function getPlayerVideoFiche(registrationId: string): Promise<PlayerVideoFiche | null> {
  if (!/^[0-9a-f-]{36}$/i.test(registrationId)) return null;
  const { data: reg } = await db().from("registrations").select("id, player_first_name, player_last_name, category_id").eq("id", registrationId).maybeSingle();
  if (!reg) return null;
  const { data: vids } = await db().from("player_progress_videos").select("*").eq("registration_id", registrationId).order("created_at");
  const rows = (vids ?? []) as any[];
  const { data: signed } = rows.length ? await db().storage.from(PROGRESS_BUCKET).createSignedUrls(rows.map((v) => v.storage_path), 7200) : { data: [] };
  const urlOf = new Map(((signed ?? []) as any[]).map((x) => [x.path, x.signedUrl] as const));
  const { getGirlPhotos } = await import("@/lib/family-photos");
  const photos = await getGirlPhotos([registrationId]).catch(() => new Map<string, string>());
  return {
    registrationId,
    name: `${String(reg.player_first_name ?? "").trim()} ${String(reg.player_last_name ?? "").trim()}`.trim(),
    category: reg.category_id ?? null,
    photoUrl: photos.get(registrationId) ?? null,
    checkpoints: checkpointsFor(reg.category_id),
    videos: rows.map((v) => ({ ...map(v), url: urlOf.get(v.storage_path) ?? null }))
  };
}

/* ── Demandes de vidéos du jour (JP, 25 nov. 2026) ───────────────────────────────────────────────────────────── */

export interface RequestPlayer {
  registrationId: string;
  name: string;
  category: string | null;
  photoUrl: string | null;
  videos: { id: string; title: string; checkpoint: Checkpoint | null }[];
  mark: "absente" | "presente" | null;
  /** Présence notée dans le site (MonClubSportif, éducateur) : « absent » pré-remplit l'absence. */
  mcsStatus: string | null;
  status: RequestStatus;
}

export interface RequestActivity {
  activityId: string;
  day: string;
  start: string;
  end: string;
  title: string;
  location: string | null;
  defaultCheckpoint: Checkpoint | null;
  players: RequestPlayer[];
  summary: RequestSummary;
}

export interface RequestDay {
  day: string;
  activities: RequestActivity[];
  summary: RequestSummary;
}

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Les demandes (une par pratique de filles) entre deux jours, avec où en est chaque fille. */
export async function loadVideoRequests(from: string, to: string, opts: { withPhotosFor?: string | null } = {}): Promise<RequestDay[]> {
  const start = from < VIDEO_REQUESTS_START ? VIDEO_REQUESTS_START : from;
  if (to < start) return [];
  const { data: acts, error } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, end_time, title, category, location, activity_type, organization")
    .gte("activity_date", start)
    .lte("activity_date", to)
    .eq("activity_type", "Pratique")
    .is("organization", null)
    .order("activity_date")
    .order("start_time");
  if (error) throw new Error(error.message);
  const activities = ((acts ?? []) as any[]).map((a) => ({ ...a, activity_date: String(a.activity_date).slice(0, 10) })).filter(isVideoRequestActivity);
  if (!activities.length) return [];
  const ids = activities.map((a) => a.id);
  const { loadRosterSources, rosterForActivity } = await import("@/lib/coach-portal-repo");
  const [{ slots, regs }, { data: att }, { data: marks }, { data: byAct }, { data: byDay }, season] = await Promise.all([
    loadRosterSources(),
    db().from("activity_player_attendance").select("activity_id, registration_id, status").in("activity_id", ids),
    db().from("player_progress_video_marks").select("activity_id, registration_id, status").in("activity_id", ids),
    db().from("player_progress_videos").select("id, registration_id, title, checkpoint, filmed_on, activity_id").in("activity_id", ids),
    db().from("player_progress_videos").select("id, registration_id, title, checkpoint, filmed_on, activity_id").is("activity_id", null).gte("filmed_on", start).lte("filmed_on", to),
    activeSeason()
  ]);
  const key = (a: string, r: string) => `${a}:${r}`;
  const attOf = new Map(((att ?? []) as any[]).map((x) => [key(x.activity_id, x.registration_id), String(x.status)] as const));
  const markOf = new Map(((marks ?? []) as any[]).map((x) => [key(x.activity_id, x.registration_id), x.status as "absente" | "presente"] as const));
  const videos = [...((byAct ?? []) as any[]), ...((byDay ?? []) as any[])];
  const rosters = activities.map((a) => ({ a, roster: rosterForActivity(a, slots, regs).filter((p) => !p.isTrial) }));
  const photoIds = opts.withPhotosFor ? rosters.filter((x) => x.a.activity_date === opts.withPhotosFor).flatMap((x) => x.roster.map((p) => p.registrationId)) : [];
  const photos = photoIds.length ? await import("@/lib/family-photos").then((m) => m.getGirlPhotos([...new Set(photoIds)])).catch(() => new Map<string, string>()) : new Map<string, string>();

  const out = new Map<string, RequestDay>();
  for (const { a, roster } of rosters) {
    const players: RequestPlayer[] = roster.map((p) => {
      const mine = videos.filter((v) => v.registration_id === p.registrationId && (v.activity_id === a.id || (!v.activity_id && String(v.filmed_on).slice(0, 10) === a.activity_date)));
      const mark = markOf.get(key(a.id, p.registrationId)) ?? null;
      const mcsStatus = attOf.get(key(a.id, p.registrationId)) ?? null;
      return {
        registrationId: p.registrationId,
        name: `${p.firstName.trim()} ${p.lastName.trim()}`.trim(),
        category: p.birthYear,
        photoUrl: photos.get(p.registrationId) ?? null,
        videos: mine.map((v) => ({ id: v.id, title: v.title, checkpoint: parseCheckpoint(v.checkpoint) })),
        mark,
        mcsStatus,
        status: requestStatus({ videos: mine.length, mark, mcsStatus })
      };
    });
    const activity: RequestActivity = {
      activityId: a.id,
      day: a.activity_date,
      start: String(a.start_time).slice(0, 5),
      end: String(a.end_time ?? "").slice(0, 5),
      title: a.title ?? a.category,
      location: a.location ?? null,
      defaultCheckpoint: defaultCheckpointFor(season, a.activity_date, players[0]?.category ?? a.category),
      players,
      summary: summarizeRequest(players.map((p) => p.status))
    };
    const day: RequestDay = out.get(a.activity_date) ?? { day: a.activity_date, activities: [], summary: summarizeRequest([]) };
    day.activities.push(activity);
    day.summary = summarizeRequest(day.activities.flatMap((x) => x.players.map((p) => p.status)));
    out.set(a.activity_date, day);
  }
  return [...out.values()].sort((x, y) => x.day.localeCompare(y.day));
}

/** L'écran des demandes : les jours autour d'aujourd'hui (4 semaines avant, 1 semaine après) et le détail du jour ouvert. */
export async function getVideoRequestScreen(wanted?: string | null): Promise<{ today: string; days: { day: string; summary: RequestSummary }[]; current: RequestDay | null; currentDay: string | null }> {
  const today = torontoDay();
  const target = isIsoDay(wanted) ? wanted : null;
  let from = addDaysIso(today, -28);
  let to = addDaysIso(today, 7);
  if (target && target < from) from = target;
  if (target && target > to) to = target;
  const list = await loadVideoRequests(from, to);
  const currentDay = pickRequestDay(list.map((d) => d.day), today, target);
  const current = currentDay ? ((await loadVideoRequests(currentDay, currentDay, { withPhotosFor: currentDay }))[0] ?? { day: currentDay, activities: [], summary: summarizeRequest([]) }) : null;
  return { today, days: list.map((d) => ({ day: d.day, summary: d.summary })), current, currentDay };
}

/** « Absente ce jour-là » (réversible). Décocher une fille que MonClubSportif dit absente la remet « à filmer ». */
export async function setRequestAbsence(input: { activityId: string; registrationId: string; absent: boolean; by: string }): Promise<void> {
  const { data: act } = await db().from("coach_activities").select("id, activity_date").eq("id", input.activityId).maybeSingle();
  if (!act) throw new Error("Pratique introuvable");
  const { data: att } = await db().from("activity_player_attendance").select("status").eq("activity_id", input.activityId).eq("registration_id", input.registrationId).maybeSingle();
  const now = new Date().toISOString();
  if (input.absent || att?.status === "absent") {
    const { error } = await db()
      .from("player_progress_video_marks")
      .upsert({ activity_id: input.activityId, registration_id: input.registrationId, club_id: CLUB_ID, status: input.absent ? "absente" : "presente", marked_by: input.by, updated_at: now }, { onConflict: "activity_id,registration_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db().from("player_progress_video_marks").delete().eq("activity_id", input.activityId).eq("registration_id", input.registrationId);
    if (error) throw new Error(error.message);
  }
  await syncVideoRequestTask(String(act.activity_date).slice(0, 10)).catch(() => undefined);
}

/** La tâche de JP du jour (« videos-progression:<date> ») : créée le jour même s'il reste des filles sans vidéo ni
 *  absence, mise à jour, cochée toute seule quand tout est fait. Si JP la coche lui-même, elle ne revient pas. */
export async function syncVideoRequestTask(day: string): Promise<"cree" | "a-jour" | "faite" | "rien"> {
  if (!isIsoDay(day) || day > torontoDay() || day < VIDEO_REQUESTS_START) return "rien";
  const [req] = await loadVideoRequests(day, day);
  const task = req ? videoRequestTask(day, req.summary, req.activities.map((a) => `${a.title} ${a.start.replace(":", " h ")}`)) : null;
  if (!task) return "rien";
  const { syncRefTask } = await import("@/lib/team-tasks-repo");
  const { data: existing } = await db().from("team_tasks").select("id, status").eq("club_id", CLUB_ID).eq("ref", task.ref);
  const rows = (existing ?? []) as any[];
  const open = rows.some((r) => ["a_faire", "en_cours"].includes(r.status));
  if (task.done) {
    if (!open) return "rien";
    await syncRefTask(task.ref, { title: task.title, done: true, doneNote: "Chaque fille a sa vidéo ou est marquée absente." });
    return "faite";
  }
  if (!open && rows.length) return "rien";
  await syncRefTask(task.ref, { title: task.title, details: task.details, due: day });
  return open ? "a-jour" : "cree";
}

/** Cron horaire : la demande d'aujourd'hui et des 3 jours précédents. */
export async function syncRecentVideoRequestTasks(): Promise<Record<string, string>> {
  const today = torontoDay();
  const out: Record<string, string> = {};
  for (let i = 3; i >= 0; i--) {
    const d = addDaysIso(today, -i);
    out[d] = await syncVideoRequestTask(d).catch((e) => `erreur : ${e instanceof Error ? e.message : e}`);
  }
  return out;
}

/** Les actions communes de l'admin (JP, gérante) et du portail du vidéaste. */
export async function handleProgressVideoAction(body: Record<string, unknown> | null, by: string): Promise<Record<string, unknown> | null> {
  if (body?.action === "depot" && typeof body.registrationId === "string" && typeof body.fileName === "string" && typeof body.contentType === "string") {
    return { ...(await createProgressUpload(body.registrationId, { fileName: body.fileName, contentType: body.contentType })) };
  }
  if (body?.action === "relier" && typeof body.registrationId === "string" && typeof body.path === "string") {
    const video = await attachProgressVideo({ registrationId: body.registrationId, checkpoint: body.checkpoint, title: body.title, note: body.note, path: body.path, fileName: typeof body.fileName === "string" ? body.fileName : undefined, uploadedBy: by, filmedOn: body.filmedOn, activityId: body.activityId });
    return { video };
  }
  if (body?.action === "voir" && typeof body.id === "string") return { url: await progressVideoUrl(body.id) };
  if (body?.action === "retirer" && typeof body.id === "string") {
    await removeProgressVideo(body.id);
    return { ok: true };
  }
  if (body?.action === "etape" && typeof body.id === "string") {
    await setProgressVideoCheckpoint(body.id, body.checkpoint);
    return { ok: true };
  }
  if (body?.action === "absente" && typeof body.activityId === "string" && typeof body.registrationId === "string") {
    await setRequestAbsence({ activityId: body.activityId, registrationId: body.registrationId, absent: body.absent === true, by });
    return { ok: true };
  }
  return null;
}

export { CHECKPOINTS };
