/** Message de la semaine aux parents (Mandalart P4.5.01 et P1.7.06, JP 19 nov. 2026) : chaque semaine, un courriel
 *  par famille (deux sœurs = un seul courriel) avec le thème de la semaine du groupe de chaque fille, une photo des
 *  championnes si la famille y a droit (sa fille était attendue à cette pratique et toutes les filles de la photo ont
 *  l'autorisation photo ; sinon rien) et le défi maison du Valkyria Lab. Réglage `app_settings` « message_hebdo_parents »
 *  ({ actif, jour, heure }), éteint par défaut. Règles pures, testées (weekly-parent-message.test.ts) ;
 *  base et envoi : weekly-parent-message-repo.ts. */

export const SETTINGS_KEY = "message_hebdo_parents";

export const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
export type Day = (typeof DAYS)[number];

export interface WeeklySettings {
  actif: boolean;
  jour: Day;
  heure: number;
  /** Lundi de la semaine du dernier vrai envoi (jamais deux fois la même semaine). */
  dernierEnvoi: string | null;
}

export const DEFAULT_SETTINGS: WeeklySettings = { actif: false, jour: "dimanche", heure: 18, dernierEnvoi: null };

export function parseSettings(raw: string | null | undefined): WeeklySettings {
  let v: any = {};
  try {
    v = JSON.parse(String(raw ?? "{}")) ?? {};
  } catch {
    v = {};
  }
  const heure = Number(v.heure);
  return {
    actif: v.actif === true,
    jour: (DAYS as readonly string[]).includes(v.jour) ? v.jour : DEFAULT_SETTINGS.jour,
    heure: Number.isInteger(heure) && heure >= 0 && heure <= 23 ? heure : DEFAULT_SETTINGS.heure,
    dernierEnvoi: typeof v.dernierEnvoi === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.dernierEnvoi) ? v.dernierEnvoi : null
  };
}

export const serializeSettings = (s: WeeklySettings) => JSON.stringify({ actif: s.actif, jour: s.jour, heure: s.heure, ...(s.dernierEnvoi ? { dernierEnvoi: s.dernierEnvoi } : {}) });

/* ── Dates (toujours à l'heure de Montréal) ── */

const TZ = "America/Toronto";

/** Jour (AAAA-MM-JJ), jour de la semaine et heure à Montréal. */
export function localParts(now: Date): { date: string; day: Day; hour: number } {
  const date = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
  return { date, day: DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()], hour };
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** La semaine dont parle le message : le dimanche (ou le samedi), la semaine qui commence ; sinon la semaine en cours.
 *  Renvoie le lundi (clé de `season_themes.week_start_date`). */
export function targetWeek(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  if (dow === 0) return addDays(today, 1);
  if (dow === 6) return addDays(today, 2);
  return addDays(today, 1 - dow);
}

/** C'est l'heure d'envoyer : réglage actif, bon jour, heure atteinte, pas encore envoyé pour cette semaine. */
export function isDue(s: WeeklySettings, now: Date): boolean {
  if (!s.actif) return false;
  const p = localParts(now);
  return p.day === s.jour && p.hour >= s.heure && s.dernierEnvoi !== targetWeek(p.date);
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « 23 novembre », « 1er décembre » */
export function longDay(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
}

/* ── Familles ── */

export interface RegRow {
  id: string;
  parent_email: string | null;
  parent_name: string | null;
  player_first_name: string | null;
  player_last_name: string | null;
  category_id: string | null;
  season_id: string | null;
  status: string | null;
  is_trial?: boolean | null;
  is_half_season?: boolean | null;
  half_season_ends_on?: string | null;
}

export interface FamilyGirl {
  registrationId: string;
  firstName: string;
  lastName: string;
  category: string | null;
  seasonId: string | null;
}

export interface Family {
  email: string;
  parentName: string | null;
  girls: FamilyGirl[];
}

const tidy = (s: string | null | undefined) =>
  String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
const keyOf = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

/** Familles actives : inscriptions payées (pas les essais, pas les demi-saisons terminées), un groupe par courriel
 *  du parent ; une fille inscrite deux fois ne compte qu'une fois. */
export function groupFamilies(regs: RegRow[], today: string): Family[] {
  const map = new Map<string, Family>();
  for (const r of regs) {
    if (r.status !== "paid" || r.is_trial) continue;
    if (r.is_half_season && r.half_season_ends_on && String(r.half_season_ends_on).slice(0, 10) < today) continue;
    const email = String(r.parent_email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const firstName = tidy(r.player_first_name);
    if (!firstName) continue;
    const fam = map.get(email) ?? { email, parentName: null, girls: [] };
    if (!fam.parentName && r.parent_name?.trim()) fam.parentName = tidy(r.parent_name);
    const lastName = tidy(r.player_last_name);
    const k = keyOf(`${firstName}${lastName}`);
    if (!fam.girls.some((g) => keyOf(`${g.firstName}${g.lastName}`) === k)) {
      fam.girls.push({ registrationId: r.id, firstName, lastName, category: r.category_id ?? null, seasonId: r.season_id ?? null });
    }
    map.set(email, fam);
  }
  return [...map.values()].sort((a, b) => (a.parentName ?? a.email).localeCompare(b.parentName ?? b.email, "fr"));
}

/** « Léa », « Léa et Emma », « Léa, Emma et Zoé » */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/* ── Photo des championnes ── */

export interface ChampionPhoto {
  postId: string;
  createdAt: string;
  photoUrl: string;
  activityDate: string;
  activityTitle: string;
  /** Prénom + initiale des championnes (jamais le nom complet dans un courriel à une autre famille). */
  names: string[];
  /** Inscriptions des championnes. */
  championIds: string[];
  /** Inscriptions attendues à la pratique (le groupe). */
  expectedIds: string[];
  /** Toutes les championnes de la photo ont l'autorisation photo de leur famille. */
  consent: boolean;
}

/** La photo à mettre dans le courriel de cette famille : seulement d'une pratique où une de ses filles était attendue
 *  (ou championne), seulement si chaque fille de la photo a l'autorisation photo. Une photo où sa fille est championne
 *  passe d'abord, sinon la plus récente. Aucune : null (le courriel ne parle pas des championnes). */
export function pickChampionPhoto(photos: ChampionPhoto[], registrationIds: string[]): ChampionPhoto | null {
  const mine = new Set(registrationIds);
  const allowed = photos.filter((p) => p.consent && p.photoUrl && (p.expectedIds.some((id) => mine.has(id)) || p.championIds.some((id) => mine.has(id))));
  if (!allowed.length) return null;
  const score = (p: ChampionPhoto) => (p.championIds.some((id) => mine.has(id)) ? 1 : 0);
  return [...allowed].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt))[0];
}

/* ── Le courriel ── */

export interface HomeChallenge {
  /** Le défi du mois (Valkyria Lab). */
  challenge: string | null;
  /** Le jeu de la semaine (Valkyria Lab). */
  game: { title: string; how: string | null } | null;
  /** Lien personnel du Lab de la famille, sinon l'onglet Lab de l'espace famille. */
  url: string;
}

export interface MessageInput {
  family: Family;
  weekStart: string;
  /** Thème de la semaine de chaque fille (null si aucun thème cette semaine). */
  themes: { registrationId: string; theme: string | null }[];
  photo: ChampionPhoto | null;
  home: HomeChallenge | null;
  siteUrl: string;
}

export interface WeeklyMessage {
  to: string;
  subject: string;
  html: string;
  hasTheme: boolean;
  hasPhoto: boolean;
  hasChallenge: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const firstWord = (s: string | null) => (s ?? "").trim().split(/\s+/)[0] ?? "";
const h = (t: string) => `<h2 style="font-size:17px;color:#5b2a86;margin:26px 0 8px">${esc(t)}</h2>`;
const button = (href: string, label: string) =>
  `<p style="margin:18px 0"><a href="${href}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">${esc(label)}</a></p>`;

/** Le courriel d'une famille, ou null s'il n'y a rien à dire cette semaine (ni thème, ni défi). */
export function buildWeeklyMessage(input: MessageInput): WeeklyMessage | null {
  const { family, weekStart } = input;
  const girls = family.girls;
  const themed = new Map<string, string[]>(); // thème → prénoms
  for (const g of girls) {
    const t = input.themes.find((x) => x.registrationId === g.registrationId)?.theme?.trim();
    if (!t) continue;
    themed.set(t, [...(themed.get(t) ?? []), g.firstName]);
  }
  const home = input.home && (input.home.challenge || input.home.game) ? input.home : null;
  if (!themed.size && !home) return null;

  const kids = joinNames(girls.map((g) => g.firstName));
  const first = firstWord(family.parentName);
  const parts: string[] = [];
  parts.push(`<p>Bonjour${first ? ` ${esc(first)}` : ""},</p>`);
  parts.push(`<p>Voici la semaine de ${esc(kids)} à New Valkyria (semaine du ${longDay(weekStart)}).</p>`);

  if (themed.size) {
    parts.push(h("Le thème de la semaine"));
    if (themed.size === 1) {
      parts.push(`<p style="margin:0 0 8px"><strong>${esc([...themed.keys()][0])}</strong></p>`);
    } else {
      parts.push(
        `<ul style="padding-left:20px;margin:0 0 8px">${[...themed.entries()].map(([t, names]) => `<li style="margin-bottom:6px"><strong>${esc(joinNames(names))} :</strong> ${esc(t)}</li>`).join("")}</ul>`
      );
    }
    parts.push(`<p style="margin:0">Après la pratique, demandez-${girls.length > 1 ? "leur" : "lui"} ce qu'${girls.length > 1 ? "elles ont" : "elle a"} appris sur ce thème : le dire avec ses mots aide à le retenir.</p>`);
  }

  if (input.photo) {
    const p = input.photo;
    parts.push(h("Les championnes de la semaine"));
    parts.push(
      `<p style="margin:0 0 10px"><img src="${esc(p.photoUrl)}" alt="Les championnes du jour" width="560" style="max-width:100%;height:auto;border-radius:12px;display:block" /></p>`
    );
    parts.push(`<p style="margin:0;color:#555;font-size:14px">${esc(p.activityTitle)}, ${longDay(p.activityDate)} : ${esc(joinNames(p.names))}. Bravo !</p>`);
  }

  if (home) {
    parts.push(h("Le défi maison"));
    if (home.challenge) parts.push(`<p style="margin:0 0 8px"><strong>Le défi du mois :</strong> ${esc(home.challenge)}</p>`);
    if (home.game) parts.push(`<p style="margin:0 0 8px"><strong>Le jeu de la semaine : ${esc(home.game.title)}.</strong>${home.game.how ? ` ${esc(home.game.how)}` : ""}</p>`);
    parts.push(`<p style="margin:0">Filmez-${girls.length > 1 ? "les" : "la"} quand ${girls.length > 1 ? "elles sont prêtes" : "elle est prête"} : ${girls.length > 1 ? "leur" : "son"} coach regarde la vidéo et vous laisse un commentaire.</p>`);
    parts.push(button(home.url, "Ouvrir le Valkyria Lab"));
  }

  parts.push(`<p style="margin-top:22px">Bonne semaine !</p>`);
  parts.push(`<p style="color:#666;font-size:13px">Tout se retrouve dans votre espace famille : <a href="${input.siteUrl}/compte" style="color:#5b2a86">${input.siteUrl.replace(/^https?:\/\//, "")}/compte</a></p>`);

  return {
    to: family.email,
    subject: `La semaine de ${kids} à New Valkyria`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">${parts.join("\n")}</div>`,
    hasTheme: themed.size > 0,
    hasPhoto: Boolean(input.photo),
    hasChallenge: Boolean(home)
  };
}
