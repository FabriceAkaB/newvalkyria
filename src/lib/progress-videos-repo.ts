import { CLUB_ID } from "@/lib/club";
import { CHECKPOINTS, checkpointsFor, isCheckpoint, type Checkpoint } from "@/lib/progress-videos";
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
  checkpoint: Checkpoint;
  title: string;
  note: string | null;
  createdAt: string;
  url?: string | null;
}

const map = (r: any): ProgressVideo => ({ id: r.id, registrationId: r.registration_id, checkpoint: r.checkpoint, title: r.title, note: r.note, createdAt: r.created_at });

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

/** Relie la vidéo arrivée dans le stockage à la fille et au moment de la saison. */
export async function attachProgressVideo(input: { registrationId: string; checkpoint: unknown; title?: unknown; note?: unknown; path: string; fileName?: string; uploadedBy: string }): Promise<ProgressVideo> {
  if (!isCheckpoint(input.checkpoint)) throw new Error("Moment de la saison invalide");
  const folder = `${CLUB_ID}/${input.registrationId}`;
  const name = input.path.startsWith(`${folder}/`) ? input.path.slice(folder.length + 1) : "";
  if (!name || name.includes("/") || name.includes("..")) throw new Error("Fichier invalide");
  const { data: listed, error: listError } = await db().storage.from(PROGRESS_BUCKET).list(folder, { search: name, limit: 20 });
  if (listError) throw new Error(listError.message);
  if (!(listed ?? []).some((o: any) => o.name === name)) throw new Error("La vidéo n'est pas arrivée dans le stockage. Recommencez le dépôt.");
  const season = await activeSeason();
  const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const { data, error } = await db()
    .from("player_progress_videos")
    .insert({ club_id: CLUB_ID, season_id: season?.id ?? null, registration_id: input.registrationId, checkpoint: input.checkpoint, title: clean(input.title, 80) ?? "Ball mastery", note: clean(input.note, 1000), storage_path: input.path, file_name: input.fileName ?? null, uploaded_by: input.uploadedBy })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return map(data);
}

export async function removeProgressVideo(id: string): Promise<void> {
  const { data } = await db().from("player_progress_videos").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return;
  await db().storage.from(PROGRESS_BUCKET).remove([data.storage_path]);
  await db().from("player_progress_videos").delete().eq("id", id);
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
    db().from("player_progress_videos").select("*").in("registration_id", registrationIds).order("created_at")
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

export { CHECKPOINTS };
