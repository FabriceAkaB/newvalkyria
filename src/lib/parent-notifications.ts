/** Avis aux parents (Mandalart P1.7.07 et P4.2.01, JP 19 nov. 2026) : quand il y a du nouveau pour leur fille dans
 *  l'espace famille (vidéo de progression déposée, bulletin remis, championne du jour), le parent reçoit UN SEUL
 *  courriel résumé par jour au plus, avec un bouton vers la bonne page de l'espace famille. Chaque nouvelle n'est
 *  annoncée qu'une fois par adresse (table `parent_notices`). Règles pures, testées (parent-notifications.test.ts) ;
 *  lecture de la base et envoi : parent-notifications-repo.ts. */

import { MIN_EVALUATED_PRACTICES, periodRange, type BulletinPeriod } from "@/lib/bulletin-report";
import { championLabel, type ChampionKind } from "@/lib/player-points";

export type NewsKind = "bulletin" | "video" | "champion";

/** Une nouvelle pour une fille. `key` est unique (sert à ne jamais l'annoncer deux fois à la même adresse). */
export interface NewsItem {
  key: string;
  kind: NewsKind;
  registrationId: string;
  firstName: string;
  /** Jour de la nouvelle (AAAA-MM-JJ), pour l'ordre et le texte. */
  date: string;
  /** Ce qu'on dit dans le courriel, sans le prénom (« son bulletin de mi-saison est remis »). */
  text: string;
  /** Page de l'espace famille (chemin relatif, commence par /compte). */
  path: string;
}

/** Réglage `app_settings` « avis_parents_actif » : actif par défaut, coupé par « false », « 0 », « non », « off ». */
export const SETTING_KEY = "avis_parents_actif";
export function isEnabled(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return !/^\s*(false|0|non|off|no|inactif)\s*$/i.test(value);
}

/** Jusqu'à combien de jours en arrière une nouvelle vaut encore la peine d'être annoncée. */
export const NEWS_WINDOW_DAYS = 10;

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const recent = (date: string, today: string, days = NEWS_WINDOW_DAYS) => date.slice(0, 10) <= today && date.slice(0, 10) >= addDays(today, -days);

const PRIORITY: Record<NewsKind, number> = { bulletin: 0, video: 1, champion: 2 };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const frenchDay = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
};

/* ── Les nouvelles de chaque sorte ─────────────────────────────────── */

/** Bulletin remis : à la date de fin de sa période (mi-saison, fin de saison), annoncé dans les jours qui suivent,
 *  seulement pour une fille qui a des présences et au moins 4 pratiques évaluées sur la période (sinon le bulletin
 *  n'est pas remis : JP, 26 nov. 2026). `evaluated` : pratiques évaluées par période. */
export function bulletinNews(regs: { registrationId: string; firstName: string; seasonId: string | null; hasActivity: boolean; evaluated?: Partial<Record<BulletinPeriod, number>> }[], today: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const r of regs) {
    if (!r.hasActivity) continue;
    for (const period of ["mi-saison", "fin-saison"] as BulletinPeriod[]) {
      const range = periodRange(r.seasonId, period, today);
      if (range.provisional || !recent(range.to, today)) continue;
      if ((r.evaluated?.[period] ?? 0) < MIN_EVALUATED_PRACTICES) continue;
      out.push({
        key: `bulletin:${r.registrationId}:${period}`,
        kind: "bulletin",
        registrationId: r.registrationId,
        firstName: r.firstName,
        date: range.to,
        text: period === "mi-saison" ? "son bulletin de mi-saison est prêt" : "son bulletin de fin de saison est prêt",
        path: `/compte/progression?bulletin=${period}`
      });
    }
  }
  return out;
}

const CHECKPOINT_WORDS: Record<string, string> = { debut: "de début de saison", mi: "de mi-saison", fin: "de fin de saison" };

/** Vidéo de progression déposée par l'équipe. */
export function videoNews(videos: { id: string; registrationId: string; firstName: string; checkpoint: string; title: string | null; createdAt: string }[], today: string): NewsItem[] {
  return videos
    .filter((v) => recent(v.createdAt, today))
    .map((v) => ({
      key: `video:${v.id}`,
      kind: "video" as const,
      registrationId: v.registrationId,
      firstName: v.firstName,
      date: v.createdAt.slice(0, 10),
      text: `une nouvelle vidéo de progression ${CHECKPOINT_WORDS[v.checkpoint] ?? ""}`.trim() + (v.title && v.title !== "Ball mastery" ? ` (${v.title})` : " (ball mastery)"),
      path: "/compte/progression"
    }));
}

/** Championne du jour (publication visible seulement : une publication retirée du fil n'est pas annoncée). */
export function championNews(lines: { postId: string; registrationId: string; firstName: string; kind: ChampionKind; title: string | null; points: number; activityDate: string; hidden: boolean; createdAt: string }[], today: string): NewsItem[] {
  return lines
    .filter((l) => !l.hidden && recent(l.createdAt, today))
    .map((l) => {
      const what = l.kind === "special" && l.title ? l.title : championLabel(l.kind).label.toLowerCase();
      const pts = l.points > 0 ? `, +${l.points} points` : "";
      return {
        key: `champion:${l.postId}:${l.registrationId}`,
        kind: "champion" as const,
        registrationId: l.registrationId,
        firstName: l.firstName,
        date: (l.activityDate || l.createdAt).slice(0, 10),
        text: `championne du jour à la pratique du ${frenchDay(l.activityDate || l.createdAt)} (${what}${pts})`,
        path: "/compte/points"
      };
    });
}

/* ── Regroupement par famille ──────────────────────────────────────── */

export interface Digest {
  email: string;
  items: NewsItem[];
  firstNames: string[];
  subject: string;
  /** Lien complet du bouton (page de la nouvelle la plus importante). */
  url: string;
  html: string;
  text: string;
}

export const normEmail = (e: string) => e.trim().toLowerCase();
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const noticeId = (key: string, email: string) => `${key}|${normEmail(email)}`;

/** Les courriels à envoyer : une adresse = un courriel résumé, seulement les nouvelles jamais annoncées à cette
 *  adresse, et rien pour une adresse qui a déjà reçu son résumé aujourd'hui (la nouvelle attend demain). */
export function buildDigests(input: {
  items: NewsItem[];
  /** Adresses des parents de chaque inscription. */
  recipients: Map<string, string[]>;
  /** `noticeId(key, email)` déjà annoncés. */
  alreadySent: Set<string>;
  /** Adresses qui ont déjà reçu un résumé aujourd'hui. */
  sentToday: Set<string>;
  siteUrl: string;
}): Digest[] {
  const byEmail = new Map<string, Map<string, NewsItem>>();
  for (const item of input.items) {
    for (const raw of input.recipients.get(item.registrationId) ?? []) {
      const email = normEmail(raw);
      if (!isEmail(email) || input.sentToday.has(email) || input.alreadySent.has(noticeId(item.key, email))) continue;
      const bucket = byEmail.get(email) ?? new Map<string, NewsItem>();
      bucket.set(item.key, item);
      byEmail.set(email, bucket);
    }
  }
  const out: Digest[] = [];
  for (const [email, bucket] of byEmail) {
    const items = [...bucket.values()].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || b.date.localeCompare(a.date) || a.firstName.localeCompare(b.firstName, "fr"));
    out.push({ email, items, ...composeEmail(items, input.siteUrl) });
  }
  return out.sort((a, b) => a.email.localeCompare(b.email));
}

/* ── Texte du courriel ─────────────────────────────────────────────── */

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

const BUTTON: Record<NewsKind, string> = { bulletin: "Voir le bulletin", video: "Voir la vidéo", champion: "Voir ses points" };

/** Sujet, bouton et corps (HTML et texte) d'un résumé. Pas de signature : elle est ajoutée à l'envoi. */
export function composeEmail(items: NewsItem[], siteUrl: string): Omit<Digest, "email" | "items"> {
  const firstNames = [...new Set(items.map((i) => i.firstName.trim()).filter(Boolean))];
  const who = joinNames(firstNames) || "votre fille";
  const main = items[0];
  const url = `${siteUrl.replace(/\/$/, "")}${main?.path ?? "/compte"}`;
  const button = main ? BUTTON[main.kind] : "Ouvrir mon espace famille";
  const subject = `Du nouveau pour ${who} dans votre espace famille`;
  const several = firstNames.length > 1;
  const line = (i: NewsItem) => (several ? `${i.firstName} : ${i.text}` : i.text.charAt(0).toUpperCase() + i.text.slice(1));
  const lines = items.map((i) => ({ label: line(i), href: `${siteUrl.replace(/\/$/, "")}${i.path}` }));

  const html = `<div style="font-family:Inter,Arial,sans-serif;background:#ffffff;color:#1d1730;max-width:600px;line-height:1.5">
  <p>Bonjour,</p>
  <p>Du nouveau pour <strong>${escapeHtml(who)}</strong> dans votre espace famille New Valkyria :</p>
  <ul style="padding-left:20px;margin:0 0 18px">
    ${lines.map((l) => `<li style="margin:0 0 8px"><a href="${escapeHtml(l.href)}" style="color:#5b2a86">${escapeHtml(l.label)}</a></li>`).join("\n    ")}
  </ul>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#5b2a86;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">${button}</a></p>
  <p style="font-size:13px;color:#6b6280">Pas encore de compte ? Créez-le en quelques secondes avec cette adresse courriel, depuis le bouton « Connexion » du site.</p>
  <p style="font-size:12px;color:#8a8299">Vous recevez au plus un courriel par jour, seulement quand il y a du nouveau pour votre fille.</p>
</div>`;

  const text = [
    "Bonjour,",
    "",
    `Du nouveau pour ${who} dans votre espace famille New Valkyria :`,
    ...lines.map((l) => `- ${l.label} : ${l.href}`),
    "",
    `${button} : ${url}`,
    "",
    "Pas encore de compte ? Créez-le en quelques secondes avec cette adresse courriel, depuis le bouton « Connexion » du site.",
    "Vous recevez au plus un courriel par jour, seulement quand il y a du nouveau pour votre fille."
  ].join("\n");

  return { firstNames, subject, url, html, text };
}
