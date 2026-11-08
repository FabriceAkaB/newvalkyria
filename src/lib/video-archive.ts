/** Les vidéos Veo appartiennent à l'académie (demande de JP, 7 nov. 2026) : Veo efface ses enregistrements environ un
 *  an après le match. Chaque vidéo rangée (match ou pratique, même « à classer ») est téléchargée en 1080p, avec son
 *  aperçu, dans le stockage privé « match-videos » du site.
 *
 *  Un match pèse environ 3 Go : le fichier est recopié par morceaux de 6 Mo (envoi « reprenable » de Supabase), tant
 *  que le temps permis dure. Le cron horaire (mcs-robot) reprend là où il s'était arrêté, jusqu'à la fin.
 *  Tant que Veo répond, le lecteur lit chez Veo ; quand Veo a effacé le fichier, il lit la copie de l'académie
 *  (lien signé de quelques heures, jamais public). */

import { CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const ARCHIVE_BUCKET = "match-videos";
const CHUNK = 6 * 1024 * 1024; // taille imposée par Supabase pour l'envoi reprenable
export const TOO_BIG =
  "Le stockage du site refuse les gros fichiers (limite de 50 Mo). Dans Supabase → Storage → Settings, monter « Upload file size limit » à 10 GB (forfait Pro) : le téléchargement reprend tout seul à l'heure suivante.";

function db() {
  return getSupabaseAdminClient() as any;
}

function tusEndpoint(): string {
  const host = new URL(String(env.supabaseUrl)).hostname; // xxx.supabase.co
  const ref = host.split(".")[0];
  return host.endsWith(".supabase.co") ? `https://${ref}.storage.supabase.co/storage/v1/upload/resumable` : `${env.supabaseUrl}/storage/v1/upload/resumable`;
}

function auth(): Record<string, string> {
  const k = String(env.supabaseServiceRoleKey);
  return { Authorization: `Bearer ${k}`, apikey: k, "Tus-Resumable": "1.0.0" };
}

const b64 = (s: string) => Buffer.from(s).toString("base64");

/** Où en est un envoi reprenable (null si le lien a expiré : on recommence). */
async function uploadOffset(url: string): Promise<number | null> {
  const r = await fetch(url, { method: "HEAD", headers: auth(), cache: "no-store" });
  if (!r.ok) return null;
  const o = Number(r.headers.get("upload-offset"));
  return Number.isFinite(o) ? o : null;
}

async function createUpload(objectName: string, size: number): Promise<string> {
  const r = await fetch(tusEndpoint(), {
    method: "POST",
    headers: { ...auth(), "Upload-Length": String(size), "x-upsert": "true", "Upload-Metadata": `bucketName ${b64(ARCHIVE_BUCKET)},objectName ${b64(objectName)},contentType ${b64("video/mp4")},cacheControl ${b64("3600")}` },
    cache: "no-store"
  });
  if (r.status === 413) throw new Error(TOO_BIG);
  const loc = r.headers.get("location");
  if (!r.ok || !loc) throw new Error(`Le stockage refuse l'envoi (${r.status}) ${(await r.text().catch(() => "")).slice(0, 120)}`);
  return loc;
}

async function readChunk(src: string, from: number, size: number): Promise<Uint8Array> {
  const to = Math.min(from + CHUNK, size) - 1;
  const r = await fetch(src, { headers: { Range: `bytes=${from}-${to}` }, cache: "no-store" });
  if (r.status !== 206 && !(r.status === 200 && from === 0 && to === size - 1)) throw new Error(`Veo ne donne pas le morceau demandé (${r.status}).`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length !== to - from + 1) throw new Error("Morceau incomplet reçu de Veo.");
  return buf;
}

async function sendChunk(url: string, offset: number, body: Uint8Array): Promise<number> {
  const r = await fetch(url, { method: "PATCH", headers: { ...auth(), "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: body as unknown as BodyInit, cache: "no-store" });
  if (r.status === 413) throw new Error(TOO_BIG);
  if (!r.ok) throw new Error(`Le stockage refuse un morceau (${r.status}).`);
  return Number(r.headers.get("upload-offset")) || offset + body.length;
}

interface ArchiveRow {
  id: string;
  veo_slug: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  archive_status: string;
  archive_path: string | null;
  archive_thumb_path: string | null;
  archive_upload_url: string | null;
  archive_size: number | null;
}

/** L'aperçu (petite image) : gardé lui aussi, il expire chez Veo avec la vidéo. */
async function archiveThumb(v: ArchiveRow): Promise<void> {
  if (v.archive_thumb_path || !v.thumbnail_url) return;
  const r = await fetch(v.thumbnail_url, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return;
  const path = `veo/${v.veo_slug ?? v.id}.jpg`;
  const { error } = await db().storage.from(ARCHIVE_BUCKET).upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: r.headers.get("content-type") ?? "image/jpeg", upsert: true });
  if (!error) await db().from("match_videos").update({ archive_thumb_path: path }).eq("id", v.id);
}

export interface ArchiveRun {
  done: string[];
  progress: { id: string; pct: number }[];
  errors: { id: string; error: string }[];
}

/** Télécharge ce qui manque jusqu'à `deadline` (ms). Reprend un fichier commencé ; à relancer jusqu'à ce que tout soit fait. */
export async function archiveVideos(opts: { deadline: number }): Promise<ArchiveRun> {
  const out: ArchiveRun = { done: [], progress: [], errors: [] };
  const { data } = await db()
    .from("match_videos")
    .select("id, veo_slug, video_url, thumbnail_url, archive_status, archive_path, archive_thumb_path, archive_upload_url, archive_size")
    .eq("club_id", CLUB_ID)
    .neq("archive_status", "fait")
    .eq("veo_expired", false)
    .not("video_url", "is", null)
    .order("created_at", { ascending: true });
  // Un fichier commencé passe en premier, puis les plus anciennes.
  const rows = ((data ?? []) as ArchiveRow[]).sort((a, b) => Number(b.archive_status === "en-cours") - Number(a.archive_status === "en-cours"));

  // Les aperçus d'abord (petits, et ils expirent chez Veo avec la vidéo).
  for (const v of rows) await archiveThumb(v).catch(() => null);

  for (const v of rows) {
    if (Date.now() > opts.deadline - 15_000) break;
    const set = (patch: Record<string, unknown>) => db().from("match_videos").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", v.id);
    try {
      const src = String(v.video_url);
      let size = v.archive_size;
      if (!size) {
        const h = await fetch(src, { method: "HEAD", cache: "no-store" });
        size = Number(h.headers.get("content-length"));
        if (!h.ok || !size) throw new Error(`Veo ne donne pas la taille du fichier (${h.status}).`);
      }
      const path = v.archive_path ?? `veo/${v.veo_slug ?? v.id}.mp4`;
      let url = v.archive_upload_url;
      let offset = url ? await uploadOffset(url) : null;
      if (offset === null) {
        url = await createUpload(path, size);
        offset = 0;
      }
      await set({ archive_status: "en-cours", archive_path: path, archive_size: size, archive_upload_url: url, archive_error: null, archive_bytes: offset });

      // On lit le morceau suivant chez Veo pendant que le précédent part vers le stockage.
      let next: Promise<Uint8Array> | null = offset < size ? readChunk(src, offset, size) : null;
      let n = 0;
      while (next && Date.now() < opts.deadline - 10_000) {
        const body = await next;
        const after = offset + body.length;
        next = after < size ? readChunk(src, after, size) : null;
        offset = await sendChunk(String(url), offset, body);
        if (++n % 25 === 0) await set({ archive_bytes: offset });
      }
      next?.catch(() => null);

      if (offset >= size) {
        await set({ archive_status: "fait", archive_bytes: size, archive_upload_url: null, archived_at: new Date().toISOString(), archive_error: null });
        out.done.push(v.id);
      } else {
        await set({ archive_bytes: offset });
        out.progress.push({ id: v.id, pct: Math.floor((offset / size) * 100) });
        break; // plus de temps : la suite à la prochaine heure
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "erreur";
      await set({ archive_status: "erreur", archive_error: error });
      out.errors.push({ id: v.id, error });
      if (error === TOO_BIG) break; // inutile d'essayer les autres : même refus
    }
  }
  return out;
}

/** Lien signé (privé, temporaire) vers un fichier gardé par l'académie. */
export async function archiveSignedUrl(path: string | null, seconds = 6 * 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await db().storage.from(ARCHIVE_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Retirer la copie de l'académie (quand JP retire la vidéo du site). */
export async function removeArchive(paths: (string | null)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await db().storage.from(ARCHIVE_BUCKET).remove(list);
}

/** Libellé de l'état de la copie pour l'admin. */
export function archiveLabel(v: { archive_status: string; archive_bytes: number | null; archive_size: number | null; archive_error: string | null; veo_expired: boolean }): string {
  const go = (b: number | null) => `${((b ?? 0) / 1e9).toFixed(1).replace(".", ",")} Go`;
  if (v.archive_status === "fait") return `Gardée par l'académie (${go(v.archive_size)})`;
  if (v.archive_status === "en-cours") return `Téléchargement : ${v.archive_size ? Math.floor(((v.archive_bytes ?? 0) / v.archive_size) * 100) : 0} % (${go(v.archive_bytes)} sur ${go(v.archive_size)})`;
  if (v.veo_expired) return "Effacée chez Veo avant d'être téléchargée";
  if (v.archive_status === "erreur") return `Téléchargement bloqué : ${v.archive_error ?? "erreur"}`;
  return "Téléchargement à venir (chaque heure)";
}
