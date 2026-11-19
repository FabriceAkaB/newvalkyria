import { CLUB_ID } from "@/lib/club";
import { checkReview, DEFAULT_VIDEO_CREDIT_CENTS } from "@/lib/family-reviews";
import { getFamilyRegistrations, getParentAccount } from "@/lib/parent-repo";
import { addLedgerEntry } from "@/lib/referrals-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Avis et témoignages vidéo des familles (table `family_reviews`, compartiment privé `temoignages`). */

function db() {
  return getSupabaseAdminClient() as any;
}

const BUCKET = "temoignages";
const safeName = (n: string) => n.normalize("NFD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "video.mp4";

export interface FamilyReview {
  id: string;
  parentUserId: string;
  parentName: string | null;
  parentEmail: string | null;
  playerNames: string | null;
  stars: number | null;
  body: string | null;
  videoStatus: string;
  hasVideo: boolean;
  videoConsent: boolean;
  creditCents: number | null;
  creditedAt: string | null;
  googleClickedAt: string | null;
  facebookClickedAt: string | null;
  showOnSite: boolean;
  createdAt: string;
  updatedAt: string;
}

const map = (r: any): FamilyReview => ({
  id: r.id,
  parentUserId: r.parent_user_id,
  parentName: r.parent_name,
  parentEmail: r.parent_email,
  playerNames: r.player_names,
  stars: r.stars,
  body: r.body,
  videoStatus: r.video_status,
  hasVideo: Boolean(r.video_path),
  videoConsent: !!r.video_consent,
  creditCents: r.credit_cents,
  creditedAt: r.credited_at,
  googleClickedAt: r.google_clicked_at,
  facebookClickedAt: r.facebook_clicked_at,
  showOnSite: !!r.show_on_site,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

async function setting(key: string): Promise<string | null> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", key).maybeSingle();
  const v = typeof data?.value === "string" ? data.value.trim() : "";
  return v || null;
}

/** Les pages d'avis Google et Facebook de l'académie (app_settings « google_review_url », « facebook_review_url ») et
 *  le crédit d'un témoignage vidéo (« avis_credit_video_cents », 25 $ par défaut). */
export async function getReviewSettings(): Promise<{ googleUrl: string | null; facebookUrl: string | null; videoCreditCents: number }> {
  const [g, f, c] = await Promise.all([setting("google_review_url"), setting("facebook_review_url"), setting("avis_credit_video_cents")]);
  return { googleUrl: g, facebookUrl: f, videoCreditCents: c && Number.isFinite(Number(c)) ? Number(c) : DEFAULT_VIDEO_CREDIT_CENTS };
}

export async function getMyReview(userId: string): Promise<FamilyReview | null> {
  const { data } = await db().from("family_reviews").select("*").eq("club_id", CLUB_ID).eq("parent_user_id", userId).maybeSingle();
  return data ? map(data) : null;
}

async function ensureRow(userId: string): Promise<FamilyReview> {
  const existing = await getMyReview(userId);
  if (existing) return existing;
  const [account, family] = await Promise.all([getParentAccount(userId), getFamilyRegistrations(userId).catch(() => [])]);
  const { data, error } = await db()
    .from("family_reviews")
    .insert({ club_id: CLUB_ID, parent_user_id: userId, parent_email: account?.email ?? null, parent_name: account?.fullName || null, player_names: family.map((f) => f.firstName).join(", ") || null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return map(data);
}

/** L'avis du parent (étoiles + texte), modifiable. */
export async function saveReview(userId: string, body: unknown): Promise<FamilyReview> {
  const check = checkReview(body);
  if (!check.ok) throw new Error(check.error);
  const row = await ensureRow(userId);
  const { data, error } = await db().from("family_reviews").update({ stars: check.stars, body: check.text, updated_at: new Date().toISOString() }).eq("id", row.id).select("*").single();
  if (error) throw new Error(error.message);
  return map(data);
}

/** Le parent a cliqué pour publier sur Google ou Facebook (on ne voit pas la publication elle-même). */
export async function markReviewClick(userId: string, network: "google" | "facebook"): Promise<void> {
  const row = await getMyReview(userId);
  if (!row) return;
  await db().from("family_reviews").update({ [`${network}_clicked_at`]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
}

export async function createTestimonialUpload(userId: string, file: { fileName: string; contentType: string }): Promise<{ path: string; signedUrl: string }> {
  if (!/^video\//i.test(file.contentType)) throw new Error("Choisissez une vidéo (MP4 ou MOV).");
  const path = `${CLUB_ID}/${userId}/${Date.now()}-${safeName(file.fileName)}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Dépôt impossible");
  return { path, signedUrl: data.signedUrl };
}

/** La vidéo est arrivée : reliée au témoignage, à valider par l'équipe (l'ancienne est retirée). */
export async function attachTestimonial(userId: string, path: string, consent: boolean): Promise<FamilyReview> {
  if (!consent) throw new Error("Cochez l'autorisation pour que nous puissions utiliser votre vidéo.");
  const folder = `${CLUB_ID}/${userId}`;
  const name = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : "";
  if (!name || name.includes("/") || name.includes("..")) throw new Error("Fichier invalide");
  const { data: listed } = await db().storage.from(BUCKET).list(folder, { search: name, limit: 20 });
  if (!((listed ?? []) as any[]).some((o) => o.name === name)) throw new Error("La vidéo n'est pas arrivée. Recommencez l'envoi.");
  const row = await ensureRow(userId);
  const { data: old } = await db().from("family_reviews").select("video_path, video_status").eq("id", row.id).single();
  if (old?.video_status === "approuvee") throw new Error("Votre témoignage est déjà validé : merci !");
  const { data, error } = await db().from("family_reviews").update({ video_path: path, video_consent: true, video_status: "a-valider", updated_at: new Date().toISOString() }).eq("id", row.id).select("*").single();
  if (error) throw new Error(error.message);
  if (old?.video_path && old.video_path !== path) await db().storage.from(BUCKET).remove([old.video_path]);
  return map(data);
}

/* ── Admin ───────────────────────────────────────────────────────── */

export async function listReviews(): Promise<FamilyReview[]> {
  const { data, error } = await db().from("family_reviews").select("*").eq("club_id", CLUB_ID).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(map);
}

export async function testimonialUrl(id: string): Promise<string | null> {
  const { data } = await db().from("family_reviews").select("video_path").eq("id", id).maybeSingle();
  if (!data?.video_path) return null;
  const { data: s } = await db().storage.from(BUCKET).createSignedUrl(data.video_path, 7200);
  return s?.signedUrl ?? null;
}

/** L'équipe valide le témoignage vidéo : le crédit sur la prochaine saison est versé (une seule fois). */
export async function approveTestimonial(id: string, by: string): Promise<FamilyReview> {
  const { data: r } = await db().from("family_reviews").select("*").eq("id", id).single();
  if (!r?.video_path) throw new Error("Pas de vidéo à valider");
  const { videoCreditCents } = await getReviewSettings();
  if (!r.credited_at && r.parent_email && videoCreditCents > 0) {
    await addLedgerEntry({ email: r.parent_email, deltaCents: videoCreditCents, kind: "recompense", note: "Témoignage vidéo validé (crédit sur la prochaine saison)", createdBy: by });
  }
  const { data, error } = await db()
    .from("family_reviews")
    .update({ video_status: "approuvee", credit_cents: r.credited_at ? r.credit_cents : videoCreditCents, credited_at: r.credited_at ?? new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return map(data);
}

export async function refuseTestimonial(id: string): Promise<void> {
  await db().from("family_reviews").update({ video_status: "refusee", updated_at: new Date().toISOString() }).eq("id", id);
}

export async function setShowOnSite(id: string, show: boolean): Promise<void> {
  await db().from("family_reviews").update({ show_on_site: show, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function saveReviewSettings(input: { googleUrl?: unknown; facebookUrl?: unknown; videoCreditCents?: unknown }): Promise<void> {
  const rows: { key: string; value: string }[] = [];
  const url = (v: unknown) => (typeof v === "string" && /^https:\/\/\S+$/.test(v.trim()) ? v.trim() : "");
  if (input.googleUrl !== undefined) rows.push({ key: "google_review_url", value: url(input.googleUrl) });
  if (input.facebookUrl !== undefined) rows.push({ key: "facebook_review_url", value: url(input.facebookUrl) });
  if (input.videoCreditCents !== undefined) rows.push({ key: "avis_credit_video_cents", value: String(Math.max(0, Math.round(Number(input.videoCreditCents) || 0))) });
  for (const r of rows) {
    const { error } = await db().from("app_settings").upsert({ club_id: CLUB_ID, key: r.key, value: r.value, updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
    if (error) throw new Error(error.message);
  }
}
