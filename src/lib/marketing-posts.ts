import { CLUB_ID } from "@/lib/club";
import {
  FOLLOWER_NETWORKS,
  localDay,
  marketingDigestLines,
  socialTodayItems,
  videosPerWeekKpi,
  type ChannelStatRow,
  type FollowerNetwork,
  type MarketingPost,
  type Network,
  type PostFormat
} from "@/lib/marketing-posts-core";
import { addChannelStat } from "@/lib/marketing-stats";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Réseaux sociaux (pilier 3) : une ligne par publication dans marketing_posts, abonnés par réseau
 *  dans marketing_channel_stats (module Mandalart, inchangé). Calculs : marketing-posts-core.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

const today = () => localDay(new Date());

const POST_COLUMNS =
  "id, group_id, network, format, paid, posted_on, url, title, theme, views, likes, comments, shares, saves, followers_gained, spend_cents, leads, registrations, note, stats_updated_at, created_at";

function toPost(r: any): MarketingPost {
  return { ...r, id: Number(r.id), posted_on: String(r.posted_on).slice(0, 10) };
}

export async function listPosts(): Promise<MarketingPost[]> {
  const { data, error } = await db().from("marketing_posts").select(POST_COLUMNS).eq("club_id", CLUB_ID).order("posted_on", { ascending: false }).order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toPost);
}

/** Relevés d'abonnés et de publicité (marketing_channel_stats). */
export async function listChannelStats(): Promise<ChannelStatRow[]> {
  const { data, error } = await db().from("marketing_channel_stats").select("id, channel, measured_at, followers, spend_cents, leads, note").eq("club_id", CLUB_ID).order("measured_at").order("id");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, id: Number(r.id), measured_at: String(r.measured_at).slice(0, 10) }));
}

export interface PostStats {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  followersGained?: number | null;
  spendCents?: number | null;
  leads?: number | null;
  registrations?: number | null;
}

const STAT_COLUMNS: [keyof PostStats, string][] = [
  ["views", "views"],
  ["likes", "likes"],
  ["comments", "comments"],
  ["shares", "shares"],
  ["saves", "saves"],
  ["followersGained", "followers_gained"],
  ["spendCents", "spend_cents"],
  ["leads", "leads"],
  ["registrations", "registrations"]
];

function statsRow(s: PostStats): Record<string, number | null> {
  return Object.fromEntries(STAT_COLUMNS.map(([k, col]) => [col, s[k] ?? null]));
}

const hasStats = (s: PostStats) => STAT_COLUMNS.some(([k]) => s[k] !== null && s[k] !== undefined);

export interface NewPost extends PostStats {
  networks: Network[];
  format: PostFormat;
  paid: boolean;
  postedOn: string;
  url?: string | null;
  title?: string | null;
  theme?: string | null;
  note?: string | null;
}

/** Ajoute une publication : une ligne par réseau, toutes avec le même group_id (même contenu).
 *  Publiée sur plusieurs réseaux, ses chiffres s'entrent ensuite réseau par réseau. */
export async function addPost(input: NewPost): Promise<{ groupId: string; count: number }> {
  const networks = [...new Set(input.networks)];
  const withStats = networks.length === 1 && hasStats(input);
  const groupId = crypto.randomUUID();
  const rows = networks.map((network) => ({
    club_id: CLUB_ID,
    group_id: groupId,
    network,
    format: input.format,
    paid: input.paid,
    posted_on: input.postedOn,
    url: input.url?.trim() || null,
    title: input.title?.trim() || null,
    theme: input.theme?.trim() || null,
    note: input.note?.trim() || null,
    ...(withStats ? statsRow(input) : {}),
    stats_updated_at: withStats ? new Date().toISOString() : null
  }));
  const { error } = await db().from("marketing_posts").insert(rows);
  if (error) throw error;
  return { groupId, count: rows.length };
}

export interface PostPatch extends PostStats {
  format: PostFormat;
  paid: boolean;
  postedOn: string;
  url?: string | null;
  title?: string | null;
  theme?: string | null;
  note?: string | null;
}

/** Met à jour une publication (chiffres relevés, lien, thème…). La date du relevé n'avance que si un
 *  chiffre a changé : corriger le sujet d'une vieille publication ne la marque pas « relevée ».
 *  Renvoie false si la publication n'existe pas (déjà supprimée). */
export async function updatePost(id: number, patch: PostPatch): Promise<boolean> {
  const { data: before, error: readError } = await db()
    .from("marketing_posts")
    .select(STAT_COLUMNS.map(([, col]) => col).join(", "))
    .eq("club_id", CLUB_ID)
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!before) return false;
  const stats = statsRow(patch);
  const row: Record<string, unknown> = {
    format: patch.format,
    paid: patch.paid,
    posted_on: patch.postedOn,
    url: patch.url?.trim() || null,
    title: patch.title?.trim() || null,
    theme: patch.theme?.trim() || null,
    note: patch.note?.trim() || null,
    ...stats,
    updated_at: new Date().toISOString()
  };
  const changed = Object.entries(stats).some(([col, v]) => (before[col] ?? null) !== v);
  if (hasStats(patch) && changed) row.stats_updated_at = new Date().toISOString();
  const { error } = await db().from("marketing_posts").update(row).eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
  return true;
}

/** Supprime une publication (une ligne, un réseau) ; renvoie la ligne effacée pour le journal d'audit. */
export async function deletePost(id: number): Promise<MarketingPost | null> {
  const { data, error } = await db().from("marketing_posts").delete().eq("club_id", CLUB_ID).eq("id", id).select(POST_COLUMNS).maybeSingle();
  if (error) throw error;
  return data ? toPost(data) : null;
}

/** Abonnés du jour, réseau par réseau : une ligne par réseau dans marketing_channel_stats. */
export async function addFollowers(entries: { network: FollowerNetwork; followers: number }[], measuredAt?: string): Promise<number> {
  const valid = entries.filter((e) => (FOLLOWER_NETWORKS as readonly string[]).includes(e.network));
  for (const e of valid) await addChannelStat({ channel: e.network, measuredAt: measuredAt ?? today(), followers: e.followers });
  return valid.length;
}

export type AdChannel = "pub_meta" | "pub_google";

/** Relevé d'une campagne de pub qui n'est pas une publication boostée (Gestionnaire de publicités Meta,
 *  Google Ads) : montant dépensé et contacts obtenus sur la période, dans marketing_channel_stats. */
export async function addAdSpend(input: { channel: AdChannel; measuredAt?: string; spendCents: number; leads?: number | null; note?: string | null }): Promise<void> {
  await addChannelStat({ channel: input.channel, measuredAt: input.measuredAt ?? today(), spendCents: input.spendCents, leads: input.leads ?? null, note: input.note?.trim() || null });
}

/** Indicateur videos_semaine du Mandalart (moyenne des 4 dernières semaines) ; null tant qu'aucune publication n'est entrée. */
export async function getVideosPerWeek(day = today()): Promise<{ value: number | null; note: string }> {
  return videosPerWeekKpi(await listPosts(), day);
}

/** Lignes de la page « Aujourd'hui » (vidéos de la semaine, chiffres à relever, abonnés à entrer). */
export async function getSocialTodayItems(day = today()) {
  const [posts, stats] = await Promise.all([listPosts(), listChannelStats()]);
  return socialTodayItems(posts, stats, day);
}

/** Résumé marketing du lundi (P3.8.03), en lignes de texte. */
export async function getMarketingDigest(day = today()): Promise<string[]> {
  const [posts, stats] = await Promise.all([listPosts(), listChannelStats()]);
  return marketingDigestLines(posts, stats, day);
}
