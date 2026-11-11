/** Réseaux sociaux, calculs purs (aucun accès à la base) : rythme de publication, croissance des
 *  abonnés, comparaison des contenus (type, thème, réseau), organique contre payant.
 *  Utilisé par /admin/reseaux, l'indicateur videos_semaine et la page « Aujourd'hui ».
 *  Une même vidéo publiée sur deux réseaux = deux lignes avec le même group_id : chaque réseau a ses
 *  chiffres, mais elle ne compte qu'une fois dans le rythme de la semaine. */

export type Network = "instagram" | "facebook" | "youtube" | "tiktok" | "autre";
export type PostFormat = "reel" | "video" | "carrousel" | "photo" | "story" | "texte";

export const NETWORKS: { id: Network; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "autre", label: "Autre" }
];

/** Réseaux dont on suit les abonnés (table marketing_channel_stats). */
export const FOLLOWER_NETWORKS = ["instagram", "facebook", "youtube", "tiktok"] as const;
export type FollowerNetwork = (typeof FOLLOWER_NETWORKS)[number];

export const FORMATS: { id: PostFormat; label: string; video: boolean }[] = [
  { id: "reel", label: "Reel", video: true },
  { id: "video", label: "Vidéo", video: true },
  { id: "carrousel", label: "Carrousel", video: false },
  { id: "photo", label: "Photo", video: false },
  { id: "story", label: "Story", video: false },
  { id: "texte", label: "Texte", video: false }
];

/** Thèmes proposés dans le formulaire (JP peut en écrire un autre). */
export const THEMES = ["Avant-après", "Ball mastery", "Témoignage", "Match", "Coulisses", "Exercice", "Événement", "Annonce"];

/** Rythme visé : 3 vidéos par semaine, idéal 5 (P3.2.01, indicateur videos_semaine). */
export const WEEKLY_TARGET = 3;
export const WEEKLY_IDEAL = 5;
/** Les chiffres d'une publication se relèvent 7 jours après (les vues montent surtout la 1re semaine). */
export const STATS_AFTER_DAYS = 7;
const STATS_NAG_MAX_DAYS = 60;

export interface MarketingPost {
  id: number;
  group_id: string;
  network: Network;
  format: PostFormat;
  paid: boolean;
  posted_on: string;
  url: string | null;
  title: string | null;
  theme: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followers_gained: number | null;
  spend_cents: number | null;
  leads: number | null;
  registrations: number | null;
  note: string | null;
  stats_updated_at: string | null;
  created_at: string;
}

/** Ligne de marketing_channel_stats (seuls les champs utiles ici). */
export interface ChannelStatRow {
  id: number;
  channel: string;
  measured_at: string;
  followers: number | null;
  spend_cents?: number | null;
  leads?: number | null;
  note?: string | null;
}

// ── Dates (AAAA-MM-JJ, semaines du lundi au dimanche) ──

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

/** Lundi de la semaine du jour donné. */
export function weekStart(iso: string): string {
  const dow = (new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

const FR_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** « 6 nov. », « 1er oct. » (AAAA-MM-JJ). */
export function frDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${FR_MONTHS[m - 1]}`;
}

export const localDay = (ts: string | Date) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

// ── Libellés et formats ──

export const networkLabel = (n: string) => NETWORKS.find((x) => x.id === n)?.label ?? n;
export const formatLabel = (f: string) => FORMATS.find((x) => x.id === f)?.label ?? f;
export const isVideo = (f: string) => FORMATS.find((x) => x.id === f)?.video ?? false;

/** Clé de regroupement d'un thème : sans accents, majuscules ni ponctuation. */
export function themeKey(theme: string | null | undefined): string {
  return (theme ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function themeLabel(theme: string | null | undefined): string {
  const key = themeKey(theme);
  if (!key) return "Sans thème";
  const known = THEMES.find((t) => themeKey(t) === key);
  if (known) return known;
  const t = (theme ?? "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("fr-CA"));
export const fmt1 = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));
export const fmtPct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${(x * 100).toLocaleString("fr-CA", { maximumFractionDigits: 1 })} %`);
export const fmtMoney = (cents: number | null | undefined) => (cents === null || cents === undefined ? "—" : `${Math.round(cents / 100).toLocaleString("fr-CA")} $`);
export const fmtSigned = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("fr-CA")}`);
export const plural = (n: number, one: string, many = `${one}s`) => (Math.abs(n) >= 2 ? many : one);

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Lien d'une publication accepté par la route : http(s) seulement, sans espace. */
export const POST_URL_RE = /^https?:\/\/\S+$/i;

/** Lien cliquable seulement s'il est en http(s) : jamais de « javascript: » ou « data: » dans un href. */
export const safeHref = (url: string | null | undefined): string | null => (url && POST_URL_RE.test(url.trim()) ? url.trim() : null);

/** Titre lisible d'une publication : son sujet, sinon son thème et son type. */
export function postLabel(p: Pick<MarketingPost, "title" | "theme" | "format">): string {
  if (p.title?.trim()) return p.title.trim();
  return p.theme ? `${themeLabel(p.theme)} · ${formatLabel(p.format)}` : formatLabel(p.format);
}

// ── Rythme de publication ──

export interface ContentGroup {
  groupId: string;
  postedOn: string;
  video: boolean;
  networks: Network[];
}

/** Une entrée par contenu (une vidéo publiée sur Instagram et Facebook = 1 contenu). */
export function contentGroups(posts: MarketingPost[]): ContentGroup[] {
  const map = new Map<string, ContentGroup>();
  for (const p of posts) {
    const g = map.get(p.group_id);
    if (!g) map.set(p.group_id, { groupId: p.group_id, postedOn: p.posted_on, video: isVideo(p.format), networks: [p.network] });
    else {
      if (p.posted_on < g.postedOn) g.postedOn = p.posted_on;
      g.video = g.video || isVideo(p.format);
      if (!g.networks.includes(p.network)) g.networks.push(p.network);
    }
  }
  return [...map.values()];
}

export interface WeekBar {
  week: string;
  videos: number;
  others: number;
  current: boolean;
}

/** Contenus publiés par semaine (vidéos et autres), des `weeks` dernières semaines, la semaine en cours incluse. */
export function weeklyRhythm(posts: MarketingPost[], today: string, weeks = 12): WeekBar[] {
  const thisWeek = weekStart(today);
  const bars: WeekBar[] = Array.from({ length: weeks }, (_, i) => {
    const week = addDays(thisWeek, -7 * (weeks - 1 - i));
    return { week, videos: 0, others: 0, current: week === thisWeek };
  });
  const byWeek = new Map(bars.map((b) => [b.week, b]));
  for (const g of contentGroups(posts)) {
    if (g.postedOn > today) continue;
    const bar = byWeek.get(weekStart(g.postedOn));
    if (!bar) continue;
    if (g.video) bar.videos++;
    else bar.others++;
  }
  return bars;
}

export interface Pace {
  /** Moyenne par semaine sur les 28 derniers jours ; null si aucune publication n'a jamais été entrée. */
  value: number | null;
  count: number;
  from: string;
  to: string;
  /** Semaines couvertes : 4, ou moins pendant le premier mois (la moyenne part alors de la toute première publication). */
  weeks: number;
  /** Vrai pendant le premier mois : la moyenne part de la première publication, pas d'il y a 4 semaines. */
  sinceFirst: boolean;
}

/** Moyenne des 4 dernières semaines (28 jours, aujourd'hui inclus), vidéos seulement ou tous les contenus.
 *  Premier mois : les semaines d'avant la toute première publication ne comptent pas (3 vidéos la
 *  1re semaine = 3 par semaine, pas 0,8). */
export function pacePerWeek(posts: MarketingPost[], today: string, videoOnly = true): Pace {
  const groups = contentGroups(posts);
  const windowStart = addDays(today, -27);
  const first = groups
    .map((g) => g.postedOn)
    .filter((d) => d <= today)
    .sort()[0];
  const sinceFirst = Boolean(first && first > windowStart);
  const from = sinceFirst ? first! : windowStart;
  const weeks = Math.max(1, (daysBetween(from, today) + 1) / 7);
  const count = groups.filter((g) => g.postedOn >= from && g.postedOn <= today && (!videoOnly || g.video)).length;
  return { value: posts.length ? round1(count / weeks) : null, count, from, to: today, weeks: round1(weeks), sinceFirst };
}

/** « moyenne des 4 dernières semaines » ou, le premier mois, « depuis la première publication, le 15 nov. ». */
export function paceLabel(p: Pace): string {
  return p.sinceFirst ? `depuis la première publication, le ${frDay(p.from)}` : "moyenne des 4 dernières semaines";
}

// ── Comparaison des contenus ──

export interface Agg {
  key: string;
  label: string;
  /** Lignes (une publication sur un réseau). */
  posts: number;
  withViews: number;
  views: number;
  engagements: number;
  leads: number;
  registrations: number;
  spendCents: number;
  followersGained: number;
  avgViews: number | null;
  /** (j'aime + commentaires + partages + enregistrements) / vues, sur les publications qui ont des vues. */
  engagementRate: number | null;
  /** Essais (contacts) pour 1 000 vues, sur les publications qui ont des vues. */
  leadsPer1000: number | null;
  costPerLeadCents: number | null;
  costPerRegistrationCents: number | null;
}

export const engagementsOf = (p: MarketingPost) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);

export function engagementRate(p: MarketingPost): number | null {
  return p.views && p.views > 0 ? engagementsOf(p) / p.views : null;
}

export function aggregate(posts: MarketingPost[], key = "tout", label = "Toutes"): Agg {
  const seen = posts.filter((p) => p.views !== null && p.views > 0);
  const views = seen.reduce((s, p) => s + (p.views ?? 0), 0);
  const engagements = seen.reduce((s, p) => s + engagementsOf(p), 0);
  const leadsSeen = seen.reduce((s, p) => s + (p.leads ?? 0), 0);
  const leads = posts.reduce((s, p) => s + (p.leads ?? 0), 0);
  const registrations = posts.reduce((s, p) => s + (p.registrations ?? 0), 0);
  const spendCents = posts.reduce((s, p) => s + (p.spend_cents ?? 0), 0);
  return {
    key,
    label,
    posts: posts.length,
    withViews: seen.length,
    views,
    engagements,
    leads,
    registrations,
    spendCents,
    followersGained: posts.reduce((s, p) => s + (p.followers_gained ?? 0), 0),
    avgViews: seen.length ? Math.round(views / seen.length) : null,
    engagementRate: views > 0 ? engagements / views : null,
    leadsPer1000: views > 0 ? round1((leadsSeen / views) * 1000) : null,
    costPerLeadCents: spendCents > 0 && leads > 0 ? Math.round(spendCents / leads) : null,
    costPerRegistrationCents: spendCents > 0 && registrations > 0 ? Math.round(spendCents / registrations) : null
  };
}

export type CompareBy = "format" | "theme" | "network";

/** Regroupe par type, thème ou réseau ; du contenu qui amène le plus d'essais (pour 1 000 vues) au moins. */
export function compareBy(posts: MarketingPost[], by: CompareBy): Agg[] {
  const groups = new Map<string, { label: string; rows: MarketingPost[] }>();
  for (const p of posts) {
    const key = by === "format" ? p.format : by === "network" ? p.network : themeKey(p.theme) || "sans-theme";
    const label = by === "format" ? formatLabel(p.format) : by === "network" ? networkLabel(p.network) : themeLabel(p.theme);
    const g = groups.get(key) ?? { label, rows: [] };
    g.rows.push(p);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => aggregate(g.rows, key, g.label))
    .sort((a, b) => (b.leadsPer1000 ?? -1) - (a.leadsPer1000 ?? -1) || (b.avgViews ?? -1) - (a.avgViews ?? -1) || b.posts - a.posts);
}

export interface Best {
  agg: Agg;
  /** « essais » : amène le plus d'essais pour 1 000 vues ; « vues » : pas encore d'essai attribué, le plus vu en moyenne. */
  kind: "essais" | "vues";
}

/** Le contenu (thème, sinon type) qui amène le plus de familles. */
export function bestContent(posts: MarketingPost[]): Best | null {
  for (const by of ["theme", "format"] as const) {
    const rows = compareBy(posts, by).filter((a) => a.key !== "sans-theme");
    const withLeads = rows.filter((a) => a.leads > 0 && a.leadsPer1000 !== null && a.leadsPer1000 > 0);
    if (withLeads.length) return { agg: withLeads[0], kind: "essais" };
  }
  for (const by of ["theme", "format"] as const) {
    const rows = compareBy(posts, by)
      .filter((a) => a.key !== "sans-theme" && a.avgViews !== null)
      .sort((a, b) => (b.avgViews ?? 0) - (a.avgViews ?? 0));
    if (rows.length) return { agg: rows[0], kind: "vues" };
  }
  return null;
}

/** Les meilleures publications, par vues ou par essais attribués (les publications à 0 sont écartées). */
export function topPosts(posts: MarketingPost[], by: "views" | "leads", n = 5): MarketingPost[] {
  return posts
    .filter((p) => (by === "views" ? (p.views ?? 0) > 0 : (p.leads ?? 0) > 0 || (p.registrations ?? 0) > 0))
    .sort((a, b) =>
      by === "views"
        ? (b.views ?? 0) - (a.views ?? 0) || (b.leads ?? 0) - (a.leads ?? 0)
        : (b.leads ?? 0) - (a.leads ?? 0) || (b.registrations ?? 0) - (a.registrations ?? 0) || (b.views ?? 0) - (a.views ?? 0)
    )
    .slice(0, n);
}

export function paidVsOrganic(posts: MarketingPost[]): { organic: Agg; paid: Agg } {
  return {
    organic: aggregate(
      posts.filter((p) => !p.paid),
      "organique",
      "Organique"
    ),
    paid: aggregate(
      posts.filter((p) => p.paid),
      "payant",
      "Payant"
    )
  };
}

export function postsSince(posts: MarketingPost[], from: string, to: string): MarketingPost[] {
  return posts.filter((p) => p.posted_on >= from && p.posted_on <= to);
}

/** Chiffres à relever : publiée il y a 7 à 60 jours et chiffres jamais entrés depuis le 7e jour. */
export function needsStatsUpdate(p: MarketingPost, today: string): boolean {
  const age = daysBetween(p.posted_on, today);
  if (age < STATS_AFTER_DAYS || age > STATS_NAG_MAX_DAYS) return false;
  if (!p.stats_updated_at) return true;
  return daysBetween(p.posted_on, localDay(p.stats_updated_at)) < STATS_AFTER_DAYS;
}

// ── Abonnés ──

export interface FollowerPoint {
  date: string;
  followers: number;
}

/** Relevés d'abonnés d'un réseau, du plus ancien au plus récent (un seul par jour : le dernier entré). */
export function followerSeries(rows: ChannelStatRow[], network: string): FollowerPoint[] {
  const byDay = new Map<string, { id: number; followers: number }>();
  for (const r of rows) {
    if (r.channel !== network || r.followers === null || r.followers === undefined) continue;
    const day = String(r.measured_at).slice(0, 10);
    const prev = byDay.get(day);
    if (!prev || r.id > prev.id) byDay.set(day, { id: r.id, followers: r.followers });
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, followers: v.followers }));
}

export interface Growth {
  current: number | null;
  at: string | null;
  /** Abonnés gagnés depuis `since` : le relevé le plus proche de `days` jours avant le dernier relevé. */
  delta: number | null;
  since: string | null;
}

/** Gain d'abonnés mesuré à partir du DERNIER relevé (pas d'aujourd'hui) : un vieux dernier relevé garde sa
 *  croissance au lieu de retomber à « croissance au 2e relevé ». La base est le relevé antérieur le plus
 *  proche de `days` jours avant (aux 2 semaines : celui d'il y a 28 jours plutôt que 42). */
export function followerGrowth(points: FollowerPoint[], days = 30): Growth {
  if (!points.length) return { current: null, at: null, delta: null, since: null };
  const last = points[points.length - 1];
  const target = addDays(last.date, -days);
  let base: FollowerPoint | null = null;
  // Du plus ancien au plus récent ; à égalité, le plus ancien reste.
  for (const p of points.slice(0, -1)) {
    if (!base || Math.abs(daysBetween(p.date, target)) < Math.abs(daysBetween(base.date, target))) base = p;
  }
  if (!base) return { current: last.followers, at: last.date, delta: null, since: null };
  return { current: last.followers, at: last.date, delta: last.followers - base.followers, since: base.date };
}

/** « en 30 jours » quand le gain couvre à peu près 30 jours (± 5), sinon « depuis le 1er oct. ». */
export function growthSinceLabel(since: string | null, at: string | null): string {
  if (!since || !at) return "";
  return Math.abs(daysBetween(since, at) - 30) <= 5 ? "en 30 jours" : `depuis le ${frDay(since)}`;
}

export interface NetworkFollowers {
  network: FollowerNetwork;
  label: string;
  points: FollowerPoint[];
  growth: Growth;
}

export function followersByNetwork(rows: ChannelStatRow[], days = 30): NetworkFollowers[] {
  return FOLLOWER_NETWORKS.map((n) => {
    const points = followerSeries(rows, n);
    return { network: n, label: networkLabel(n), points, growth: followerGrowth(points, days) };
  });
}

/** Total des abonnés (réseaux qui ont un relevé) et gain total (réseaux qui ont au moins 2 relevés). */
export function totalFollowers(nets: NetworkFollowers[]): { current: number | null; delta: number | null; since: string | null; lastReading: string | null } {
  const withCurrent = nets.filter((n) => n.growth.current !== null);
  const withDelta = nets.filter((n) => n.growth.delta !== null);
  const sinces = withDelta.map((n) => n.growth.since!).sort();
  const lasts = withCurrent.map((n) => n.growth.at!).sort();
  return {
    current: withCurrent.length ? withCurrent.reduce((s, n) => s + (n.growth.current ?? 0), 0) : null,
    delta: withDelta.length ? withDelta.reduce((s, n) => s + (n.growth.delta ?? 0), 0) : null,
    since: sinces[0] ?? null,
    lastReading: lasts[lasts.length - 1] ?? null
  };
}

// ── Indicateur, « Aujourd'hui » et résumé du lundi ──

/** Indicateur videos_semaine : vidéos (reel ou vidéo) par semaine, moyenne des 4 dernières semaines. */
export function videosPerWeekKpi(posts: MarketingPost[], today: string): { value: number | null; note: string } {
  const pace = pacePerWeek(posts, today, true);
  if (pace.value === null) return { value: null, note: "Aucune publication entrée dans Réseaux sociaux (/admin/reseaux)." };
  const all = pacePerWeek(posts, today, false);
  const span = pace.sinceFirst ? `du ${frDay(pace.from)} (première publication) au ${frDay(pace.to)}` : `du ${frDay(pace.from)} au ${frDay(pace.to)}`;
  return {
    value: pace.value,
    note: `${pace.count} ${plural(pace.count, "vidéo")} (reel ou vidéo, une vidéo publiée sur 2 réseaux compte une fois) ${span}, soit ${fmt1(pace.value)} par semaine ; ${all.count} ${plural(all.count, "publication")} en tout (/admin/reseaux).`
  };
}

export interface SocialTodayItem {
  title: string;
  detail?: string | null;
  meta?: string | null;
  href?: string | null;
}

/** Ce que JP doit faire pour ses réseaux : vidéos de la semaine en retard (à partir du jeudi),
 *  chiffres à relever 7 jours après une publication, abonnés à entrer aux 2 semaines. */
export function socialTodayItems(posts: MarketingPost[], statRows: ChannelStatRow[], today: string): { level: "orange" | "info"; items: SocialTodayItem[] } {
  const items: SocialTodayItem[] = [];
  let behind = false;
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
  const week = weeklyRhythm(posts, today, 1)[0];
  if (dow >= 3 && week.videos < WEEKLY_TARGET) {
    behind = true;
    const best = bestContent(posts);
    const left = 7 - dow; // aujourd'hui compris
    items.push({
      title: `Cette semaine : ${week.videos} ${plural(week.videos, "vidéo")} sur ${WEEKLY_TARGET}`,
      detail: best
        ? `Ce qui marche le mieux : ${best.agg.label}${best.kind === "essais" ? ` (${fmt1(best.agg.leadsPer1000)} essais pour 1 000 vues)` : ` (${fmtInt(best.agg.avgViews)} vues en moyenne)`}`
        : "Avant-après, ball mastery ou témoignage, avec l'évaluation gratuite comme seul appel",
      meta: left > 1 ? `Il reste ${left} jours, aujourd'hui compris` : "Dernier jour de la semaine",
      href: "/admin/reseaux"
    });
  }
  const stale = posts.filter((p) => needsStatsUpdate(p, today));
  if (stale.length) {
    items.push({
      title: `Relever les chiffres de ${stale.length} ${plural(stale.length, "publication")}`,
      detail: stale
        .slice(0, 3)
        .map((p) => `${postLabel(p)} (${networkLabel(p.network)})`)
        .join(" · "),
      meta: "Vues, essais et inscriptions, 7 jours après",
      href: "/admin/reseaux#publications"
    });
  }
  const last = statRows
    .filter((r) => (FOLLOWER_NETWORKS as readonly string[]).includes(r.channel) && r.followers !== null && r.followers !== undefined)
    .map((r) => String(r.measured_at).slice(0, 10))
    .sort()
    .pop();
  if (!last || daysBetween(last, today) >= 14) {
    items.push({
      title: "Entrer les abonnés de chaque réseau",
      detail: last ? `Dernier relevé il y a ${daysBetween(last, today)} jours` : "Aucun relevé : c'est le point de départ de la croissance",
      meta: "Aux 2 semaines",
      href: "/admin/reseaux"
    });
  }
  return { level: behind ? "orange" : "info", items };
}

/** Lignes du résumé marketing du lundi (P3.8.03) : rythme, abonnés, semaine passée, pub, meilleur contenu. */
export function marketingDigestLines(posts: MarketingPost[], statRows: ChannelStatRow[], today: string): string[] {
  const lines: string[] = [];
  const pace = pacePerWeek(posts, today, true);
  if (pace.value !== null) lines.push(`Vidéos : ${fmt1(pace.value)} par semaine (${paceLabel(pace)} ; cible ${WEEKLY_TARGET}, idéal ${WEEKLY_IDEAL}).`);
  const total = totalFollowers(followersByNetwork(statRows));
  if (total.current !== null) lines.push(`Abonnés : ${fmtInt(total.current)}${total.delta !== null ? ` (${fmtSigned(total.delta)} ${growthSinceLabel(total.since, total.lastReading)})` : ""}.`);
  const lastMonday = addDays(weekStart(today), -7);
  const lastWeekPosts = postsSince(posts, lastMonday, addDays(lastMonday, 6));
  const lastWeek = aggregate(lastWeekPosts);
  if (lastWeek.posts) {
    const contents = contentGroups(lastWeekPosts).length;
    lines.push(
      `Semaine dernière : ${contents} ${plural(contents, "publication")}, ${fmtInt(lastWeek.views)} vues, ${lastWeek.leads} ${plural(lastWeek.leads, "essai")}, ${lastWeek.registrations} ${plural(lastWeek.registrations, "inscription")}.`
    );
  }
  const paid = aggregate(postsSince(posts, addDays(today, -29), today).filter((p) => p.paid));
  if (paid.spendCents > 0) {
    lines.push(
      `Pub (30 jours) : ${fmtMoney(paid.spendCents)} dépensés, ${paid.leads} ${plural(paid.leads, "essai")}, ${paid.registrations} ${plural(paid.registrations, "inscription")}${paid.costPerLeadCents !== null ? ` ; ${fmtMoney(paid.costPerLeadCents)} par essai` : ""}${paid.costPerRegistrationCents !== null ? `, ${fmtMoney(paid.costPerRegistrationCents)} par inscription` : ""}.`
    );
  }
  const best = bestContent(posts);
  if (best?.kind === "essais") lines.push(`Contenu qui amène le plus d'essais : ${best.agg.label} (${fmt1(best.agg.leadsPer1000)} pour 1 000 vues).`);
  return lines;
}
