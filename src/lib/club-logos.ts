import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Logos des clubs qui réservent des matchs : un logo par club (org_key), ajouté par JP dans l'admin et montré partout
 *  où le club apparaît (admin, page de son match, page des arbitres). Stockage public « club-logos ». */

const BUCKET = "club-logos";
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

function db() {
  return getSupabaseAdminClient() as any;
}

let ready = false;
async function ensureBucket() {
  if (ready) return;
  const { error } = await db().storage.getBucket(BUCKET);
  if (error) {
    const { error: e } = await db().storage.createBucket(BUCKET, { public: true, allowedMimeTypes: LOGO_TYPES, fileSizeLimit: LOGO_MAX_BYTES });
    if (e && !/already exists/i.test(e.message)) throw new Error(e.message);
  }
  ready = true;
}

/** Vérifie le fichier (PNG, JPG ou WebP, 2 Mo maximum) ; renvoie l'erreur à afficher ou null. */
export function logoProblem(file: { type: string; size: number }): string | null {
  if (!LOGO_TYPES.includes(file.type)) return "Choisissez une image PNG, JPG ou WebP.";
  if (file.size > LOGO_MAX_BYTES) return "Image trop lourde (2 Mo maximum).";
  if (file.size === 0) return "Fichier vide.";
  return null;
}

/** Enregistre le logo du club de cette équipe ; toutes les équipes du même club le reçoivent. */
export async function setClubLogo(profileId: string, file: File): Promise<string> {
  const problem = logoProblem(file);
  if (problem) throw new Error(problem);
  const { data: profile } = await db().from("match_team_profiles").select("id, org_key").eq("id", profileId).maybeSingle();
  if (!profile) throw new Error("Équipe introuvable.");
  await ensureBucket();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${String(profile.org_key).replace(/[^a-z0-9-]/g, "-").slice(0, 60) || "club"}-${Date.now()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  const url = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;
  const { error: upErr } = await db().from("match_team_profiles").update({ logo_url: url }).eq("org_key", profile.org_key);
  if (upErr) throw new Error(upErr.message);
  return url;
}

export async function clearClubLogo(profileId: string): Promise<void> {
  const { data: profile } = await db().from("match_team_profiles").select("org_key").eq("id", profileId).maybeSingle();
  if (!profile) throw new Error("Équipe introuvable.");
  await db().from("match_team_profiles").update({ logo_url: null }).eq("org_key", profile.org_key);
}

/** Le logo de chaque club, par org_key. */
export async function getClubLogos(): Promise<Map<string, string>> {
  const { data } = await db().from("match_team_profiles").select("org_key, logo_url").not("logo_url", "is", null);
  return new Map(((data ?? []) as any[]).map((r) => [r.org_key, r.logo_url]));
}
