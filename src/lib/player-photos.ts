import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Photos des joueuses en stockage PRIVÉ (Loi 25, JP 17 nov. 2026). En base, photo_url garde une adresse du site
 *  (/photos/<dossier>/<fichier>) qui vérifie qui regarde (admin, éducateur, ou la famille de la joueuse) avant de
 *  rediriger vers un lien signé de 60 secondes. Les anciennes adresses publiques sont encore comprises. */

export const PHOTO_BUCKETS = ["athlete-photos", "child-photos"] as const;
export type PhotoBucket = (typeof PHOTO_BUCKETS)[number];

/** Adresse du site pour une photo. */
export const photoPath = (bucket: PhotoBucket, path: string) => `/photos/${bucket}/${path}`;

/** Dossier et fichier d'une adresse de photo (nouvelle /photos/… ou ancienne publique Supabase), sinon null. */
export function parsePhotoUrl(url: string | null | undefined): { bucket: PhotoBucket; path: string } | null {
  if (!url) return null;
  const m = url.match(/(?:^\/photos\/|\/storage\/v1\/object\/(?:public|sign)\/)(athlete-photos|child-photos)\/([^?#]+)/);
  if (!m) return null;
  const path = decodeURIComponent(m[2]);
  if (path.includes("..")) return null;
  return { bucket: m[1] as PhotoBucket, path };
}

/** Lien signé (lecture directe), pour le serveur (robot MonClubSportif) ou une page sans connexion (borne). */
export async function signedPhotoUrl(url: string | null | undefined, seconds = 60): Promise<string | null> {
  const p = parsePhotoUrl(url);
  if (!p) return url ?? null;
  const { data } = await (getSupabaseAdminClient() as any).storage.from(p.bucket).createSignedUrl(p.path, seconds);
  return data?.signedUrl ?? null;
}
