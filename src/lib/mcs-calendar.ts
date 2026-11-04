import { CLUB_ID } from "@/lib/club";
import { DEFAULT_TZ, decodeIcalBytes, looksLikeIcal, readIcalWindow, type IcalOccurrence } from "@/lib/ical";
import { createActivityFor, listPractices, type Practice } from "@/lib/practices-repo";
import { listMatches, type MatchRow } from "@/lib/referees-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Le calendrier MonClubSportif et celui de l'admin sont-ils identiques ? (tâche P8.4.08, agent A12)
 *
 *  JP colle une fois le lien d'abonnement iCal de MonClubSportif (réglage `mcs_ical_url`, gardé
 *  côté serveur dans `app_settings`). À chaque visite, le site lit ce calendrier (10 s au plus),
 *  le développe sur les 6 prochaines semaines et le compare au calendrier de l'admin : pratiques
 *  attendues (`listPractices` : horaire de la saison, programmes à dates fixes, Équipe → Entraînements)
 *  et matchs vendus (`listMatches`). Les pratiques de JP hors Académie ne vont pas dans MonClubSportif.
 *
 *  Rapprochement : même jour, début à 15 minutes près, lieu approximatif (mots du lieu en commun).
 *  Résultat : identiques, différences (heure de début, de fin ou lieu), seulement dans
 *  MonClubSportif (à créer dans l'admin), seulement dans l'admin (à importer dans MonClubSportif). */

function db() {
  return getSupabaseAdminClient() as any;
}

export const MCS_ICAL_KEY = "mcs_ical_url";
export const MCS_WINDOW_DAYS = 42;
export const MCS_TOLERANCE_MIN = 15;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 5_000_000;

const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TZ });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// ───────────────────────── Logique pure (testée) ─────────────────────────

export type CalSource = "mcs" | "saison" | "programme" | "activite" | "match";

export interface CalEvent {
  key: string;
  date: string;
  /** « HH:MM » */
  start: string;
  end: string | null;
  title: string;
  location: string;
  source: CalSource;
  /** Type d'activité (Pratique, Match, Tournoi…), connu dans l'admin, deviné pour MonClubSportif. */
  type: string;
  /** Où le corriger dans l'admin (événements de l'admin seulement). */
  href: string | null;
}

export type DiffField = "debut" | "fin" | "lieu";

export interface CalPair {
  mcs: CalEvent;
  admin: CalEvent;
  diffs: DiffField[];
}

export interface CalComparison {
  identical: CalPair[];
  differences: CalPair[];
  onlyMcs: CalEvent[];
  onlyAdmin: CalEvent[];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Mots trop communs pour distinguer deux lieux (types de bâtiment, voies, « Saint »…). */
const LOCATION_STOP = new Set([
  "les", "des", "aux", "sur", "the", "and", "pour",
  "rue", "boul", "boulevard", "avenue", "chemin", "montee", "rang", "route", "place", "autoroute",
  "saint", "sainte", "ste",
  "que", "quebec", "canada",
  "gym", "gymnase", "futsal", "ecole", "college", "polyvalente", "secondaire", "primaire", "academie",
  "centre", "complexe", "parc", "salle", "stade", "terrain", "terrains", "soccer", "sportif", "sportive", "sport", "sports",
  "multisport", "multisports", "multifonctionnel", "interieur", "exterieur", "pavillon", "local", "entree", "porte", "synthetique"
]);

export function locationTokens(s: string): string[] {
  return [...new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !/\d/.test(t) && !LOCATION_STOP.has(t)))];
}

/** Lieu approximatif : au moins la moitié des mots du lieu le plus court se retrouvent dans l'autre.
 *  Un lieu inconnu d'un côté ne contredit rien. */
export function locationsMatch(a: string, b: string): boolean {
  const ta = locationTokens(a);
  const tb = new Set(locationTokens(b));
  if (!ta.length || !tb.size) return true;
  const inter = ta.filter((t) => tb.has(t)).length;
  return inter / Math.min(ta.length, tb.size) >= 0.5;
}

/** Années de naissance citées dans un titre (« Filles 2014, 2015 », « U12 2014-2015 »). */
export function birthYears(s: string, refYear: number): number[] {
  const out = new Set<number>();
  for (const m of String(s ?? "").matchAll(/(?<!\d)((?:19|20)\d{2})(?!\d)/g)) {
    const y = Number(m[1]);
    if (y >= refYear - 21 && y <= refYear - 3) out.add(y);
  }
  return [...out];
}

function yearsRelation(a: CalEvent, b: CalEvent): "same" | "conflict" | "unknown" {
  const ref = Number(a.date.slice(0, 4));
  const ya = birthYears(a.title, ref);
  const yb = birthYears(b.title, ref);
  if (!ya.length || !yb.length) return "unknown";
  return ya.some((y) => yb.includes(y)) ? "same" : "conflict";
}

export const minutesOf = (t: string | null | undefined): number | null => {
  const m = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Type d'activité deviné à partir du titre d'un événement MonClubSportif. */
export function guessActivityType(text: string): "Pratique" | "Match" | "Tournoi" | "Camp" | "Évaluation" | "Réunion" {
  const t = norm(text);
  if (/tournoi|festival|\bcoupe\b|classique/.test(t)) return "Tournoi";
  if (/\bmatchs?\b|\bpartie\b|\bvs\b|\bcontre\b|\bgame\b|hors[- ]concours|\sc\.\s/.test(t)) return "Match";
  if (/\bcamps?\b/.test(t)) return "Camp";
  if (/evaluation|\bessais?\b|tryout|selection/.test(t)) return "Évaluation";
  if (/reunion|meeting|rencontre de parents/.test(t)) return "Réunion";
  return "Pratique";
}

function diffsOf(m: CalEvent, a: CalEvent): DiffField[] {
  const out: DiffField[] = [];
  if (minutesOf(m.start) !== minutesOf(a.start)) out.push("debut");
  const em = minutesOf(m.end);
  const ea = minutesOf(a.end);
  if (em !== null && ea !== null && em !== ea) out.push("fin");
  if (!locationsMatch(m.location, a.location)) out.push("lieu");
  return out;
}

/** Rapproche les deux calendriers, un événement d'un côté avec au plus un de l'autre.
 *  1. même jour, début à `toleranceMin` près, même lieu (approximatif) ;
 *  2. même jour, début à `toleranceMin` près, lieu différent ;
 *  3. même jour, même lieu, début déplacé (moins de 4 h).
 *  Deux groupes d'âge différents (années de naissance sans point commun) ne sont jamais rapprochés.
 *  Une paire est « identique » si le début, la fin (quand elle est connue des deux côtés) et le lieu concordent. */
export function compareCalendars(mcs: CalEvent[], admin: CalEvent[], opts: { toleranceMin?: number } = {}): CalComparison {
  const tol = opts.toleranceMin ?? MCS_TOLERANCE_MIN;
  const usedM = new Set<number>();
  const usedA = new Set<number>();
  const pairs: CalPair[] = [];
  const byDate = new Map<string, number[]>();
  admin.forEach((a, j) => byDate.set(a.date, [...(byDate.get(a.date) ?? []), j]));

  type Years = "same" | "conflict" | "unknown";
  const pass = (score: (delta: number, sameLoc: boolean, years: Years) => number | null) => {
    const cands: { i: number; j: number; s: number }[] = [];
    mcs.forEach((m, i) => {
      if (usedM.has(i)) return;
      const sm = minutesOf(m.start);
      if (sm === null) return;
      for (const j of byDate.get(m.date) ?? []) {
        if (usedA.has(j)) continue;
        const a = admin[j];
        const sa = minutesOf(a.start);
        if (sa === null) continue;
        const years = yearsRelation(m, a);
        if (years === "conflict") continue;
        const s = score(Math.abs(sm - sa), locationsMatch(m.location, a.location), years);
        if (s !== null) cands.push({ i, j, s });
      }
    });
    cands.sort((x, y) => x.s - y.s || x.i - y.i || x.j - y.j);
    for (const c of cands) {
      if (usedM.has(c.i) || usedA.has(c.j)) continue;
      usedM.add(c.i);
      usedA.add(c.j);
      pairs.push({ mcs: mcs[c.i], admin: admin[c.j], diffs: diffsOf(mcs[c.i], admin[c.j]) });
    }
  };
  const groupPenalty = (years: Years) => (years === "same" ? 0 : 5);
  pass((d, loc, years) => (d <= tol && loc ? d + groupPenalty(years) : null));
  pass((d, loc, years) => (d <= tol && !loc ? d + groupPenalty(years) : null));
  pass((d, loc, years) => (d > tol && d <= 240 && loc ? d + (years === "same" ? 0 : 30) : null));

  const byWhen = (x: CalEvent, y: CalEvent) => x.date.localeCompare(y.date) || x.start.localeCompare(y.start) || x.title.localeCompare(y.title);
  const pairOrder = (x: CalPair, y: CalPair) => byWhen(x.mcs, y.mcs);
  return {
    identical: pairs.filter((p) => p.diffs.length === 0).sort(pairOrder),
    differences: pairs.filter((p) => p.diffs.length > 0).sort(pairOrder),
    onlyMcs: mcs.filter((_, i) => !usedM.has(i)).sort(byWhen),
    onlyAdmin: admin.filter((_, j) => !usedA.has(j)).sort(byWhen)
  };
}

/** Événement MonClubSportif → événement comparable (journées entières et annulés exclus par l'appelant). */
export function mcsEventFromOccurrence(o: IcalOccurrence): CalEvent {
  return {
    key: o.key,
    date: o.date,
    start: o.start ?? "00:00",
    end: o.end,
    title: o.summary || "(sans titre)",
    location: o.location,
    source: "mcs",
    type: guessActivityType(`${o.summary} ${o.categories.join(" ")}`),
    href: null
  };
}

/** Calendrier de l'admin sur la fenêtre : pratiques (sauf celles de JP hors Académie) et matchs vendus.
 *  Un match vendu déjà entré comme activité « Match » à la même heure n'est compté qu'une fois. */
export function adminEventsFrom(practices: Practice[], matches: MatchRow[], window: { from: string; to: string }): CalEvent[] {
  const out: CalEvent[] = [];
  for (const p of practices) {
    if (p.organization || p.date < window.from || p.date > window.to || !p.start) continue;
    const type = p.activityType || "Pratique";
    out.push({
      key: p.key,
      date: p.date,
      start: p.start,
      end: p.end,
      title: type === "Pratique" ? p.group : `${type} · ${p.group}`,
      location: p.location ?? "",
      source: p.source,
      type,
      href: p.activityId ? `/admin/entraineurs/activites/${p.activityId}` : p.source === "saison" ? "/admin/saison?vue=horaire" : "/admin/pratiques"
    });
  }
  for (const m of matches) {
    if (m.bookingStatus !== "paid" || m.date < window.from || m.date > window.to) continue;
    const sm = minutesOf(m.start);
    const dup = out.some((e) => (e.type === "Match" || e.type === "Tournoi") && e.date === m.date && sm !== null && Math.abs((minutesOf(e.start) ?? -999) - sm) <= MCS_TOLERANCE_MIN);
    if (dup) continue;
    const team = (m.ourTeam ?? "").replace(/^New Valkyria\s*[—–-]\s*/i, "").trim();
    out.push({
      key: `match-${m.id}`,
      date: m.date,
      start: m.start,
      end: m.end,
      title: `Match${team ? ` ${team}` : ""}${m.opponent ? ` contre ${m.opponent}` : ""}`,
      location: [m.location, m.field].filter(Boolean).join(" · "),
      source: "match",
      type: "Match",
      href: "/admin/matchs"
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** Fin d'une activité créée depuis MonClubSportif : la fin lue, sinon 1 h après le début (avant minuit). */
export function activityEnd(start: string, end: string | null): string {
  const s = minutesOf(start) ?? 0;
  const e = minutesOf(end);
  if (e !== null && e > s) return `${pad(Math.floor(e / 60))}:${pad(e % 60)}`;
  const f = Math.min(s + 60, 23 * 60 + 59);
  return `${pad(Math.floor(f / 60))}:${pad(f % 60)}`;
}

export const timeLabel = (t: string | null | undefined) => {
  const m = minutesOf(t);
  if (m === null) return "";
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return mi ? `${h} h ${pad(mi)}` : `${h} h`;
};

export const shortDayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// ───────────────────────── Lien iCal ─────────────────────────

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*)$/i;

/** Lien collé par JP → lien https lisible par le serveur (webcal:// devient https://). */
export function normalizeIcalUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let s = String(raw ?? "").trim().replace(/^<(.*)>$/, "$1").trim();
  if (!s) return { ok: false, error: "Collez le lien du calendrier MonClubSportif." };
  if (s.length > 2000) return { ok: false, error: "Ce lien est trop long pour être un lien de calendrier." };
  s = s.replace(/^webcals?:\/\//i, "https://");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) s = `https://${s}`;
    else return { ok: false, error: "Le lien doit commencer par https:// ou webcal://." };
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: "Ce texte n'est pas un lien valide." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Le lien doit commencer par https:// ou webcal://." };
  if (PRIVATE_HOST.test(u.hostname)) return { ok: false, error: "Ce lien pointe vers un ordinateur local : collez le lien public de MonClubSportif." };
  return { ok: true, url: u.toString() };
}

/** Le lien peut contenir une clé privée : on n'en montre que le site et les 4 derniers caractères. */
export function maskIcalUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = `${u.pathname}${u.search}`.replace(/\/+$/, "");
    return tail.length > 1 ? `${u.hostname} · …${tail.slice(-4)}` : u.hostname;
  } catch {
    return "lien enregistré";
  }
}

export async function getMcsIcalSetting(): Promise<{ url: string; updatedAt: string | null } | null> {
  const { data, error } = await db().from("app_settings").select("value, updated_at").eq("club_id", CLUB_ID).eq("key", MCS_ICAL_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ? { url: String(data.value), updatedAt: data.updated_at ?? null } : null;
}

export async function saveMcsIcalUrl(url: string): Promise<void> {
  const { error } = await db().from("app_settings").upsert({ club_id: CLUB_ID, key: MCS_ICAL_KEY, value: url, updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
  cache = null;
}

export async function clearMcsIcalUrl(): Promise<void> {
  const { error } = await db().from("app_settings").delete().eq("club_id", CLUB_ID).eq("key", MCS_ICAL_KEY);
  if (error) throw new Error(error.message);
  cache = null;
}

// ───────────────────────── Lecture du calendrier ─────────────────────────

export class McsCalendarError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "network" | "http" | "format" | "size"
  ) {
    super(message);
  }
}

/** Télécharge le calendrier (côté serveur, `timeoutMs` au plus, 5 Mo au plus) et le décode. */
export async function fetchIcalText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const seconds = Math.round(timeoutMs / 1000);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        cache: "no-store",
        redirect: "follow",
        headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5", "User-Agent": "NewValkyria-Admin/1.0 (+https://www.newvalkyria.com)" }
      });
    } catch {
      if (ctrl.signal.aborted) throw new McsCalendarError(`MonClubSportif n'a pas répondu en ${seconds} secondes.`, "timeout");
      throw new McsCalendarError("Le lien ne répond pas (adresse introuvable ou site hors service).", "network");
    }
    if (res.status === 401 || res.status === 403) throw new McsCalendarError("MonClubSportif refuse l'accès à ce lien (privé ou expiré). Recopiez le lien d'abonnement.", "http");
    if (res.status === 404 || res.status === 410) throw new McsCalendarError("Ce lien n'existe plus. Le calendrier a peut-être été recréé : recopiez le lien d'abonnement.", "http");
    if (!res.ok) throw new McsCalendarError(`MonClubSportif a répondu par une erreur (${res.status}). Réessayez dans quelques minutes.`, "http");
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new McsCalendarError("Le calendrier est trop gros pour être lu (plus de 5 Mo).", "size");
    let buf: ArrayBuffer;
    try {
      buf = await res.arrayBuffer();
    } catch {
      if (ctrl.signal.aborted) throw new McsCalendarError(`MonClubSportif n'a pas fini d'envoyer le calendrier en ${seconds} secondes.`, "timeout");
      throw new McsCalendarError("La lecture du calendrier a été interrompue.", "network");
    }
    if (buf.byteLength > MAX_BYTES) throw new McsCalendarError("Le calendrier est trop gros pour être lu (plus de 5 Mo).", "size");
    const charset = res.headers.get("content-type")?.match(/charset="?([^";]+)/i)?.[1] ?? null;
    const text = decodeIcalBytes(new Uint8Array(buf), charset);
    if (!looksLikeIcal(text)) {
      throw new McsCalendarError(
        /<html|<!doctype/i.test(text.slice(0, 2000))
          ? "Ce lien ouvre une page Web, pas un calendrier. Il faut le lien d'abonnement iCal (il commence souvent par webcal:// ou se termine par .ics)."
          : "Ce lien ne donne pas un calendrier iCal.",
        "format"
      );
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export interface McsCalendarReport {
  state: "ok";
  urlMasked: string;
  updatedAt: string | null;
  checkedAt: string;
  from: string;
  to: string;
  calendarName: string | null;
  comparison: CalComparison;
  /** Journées entières de MonClubSportif dans la fenêtre (congés, tournois) : montrées, pas comparées. */
  allDay: IcalOccurrence[];
  cancelled: number;
  mcsCount: number;
  adminCount: number;
  warnings: string[];
}

export type McsCalendarState = { state: "no-url" } | { state: "error"; urlMasked: string; updatedAt: string | null; message: string } | McsCalendarReport;

let cache: { at: number; url: string; state: McsCalendarState } | null = null;

/** Lit MonClubSportif et compare aux 6 prochaines semaines de l'admin. Ne lance pas d'erreur pour
 *  un problème de lien ou de réseau : il revient comme `state: "error"` avec un message pour JP. */
export async function getMcsCalendarState(opts: { timeoutMs?: number } = {}): Promise<McsCalendarState> {
  const setting = await getMcsIcalSetting();
  if (!setting) return { state: "no-url" };
  const urlMasked = maskIcalUrl(setting.url);
  const from = todayIso();
  const to = addDays(from, MCS_WINDOW_DAYS - 1);
  let state: McsCalendarState;
  try {
    const [text, practices, matches] = await Promise.all([fetchIcalText(setting.url, opts.timeoutMs), listPractices({ from, to }), listMatches({ from, to }).catch(() => [] as MatchRow[])]);
    const { calendar, occurrences, warnings } = readIcalWindow(text, { from, to }, { tz: DEFAULT_TZ });
    const live = occurrences.filter((o) => !o.cancelled);
    const mcs = live.filter((o) => !o.allDay && o.date >= from && o.date <= to).map(mcsEventFromOccurrence);
    const admin = adminEventsFrom(practices, matches, { from, to });
    state = {
      state: "ok",
      urlMasked,
      updatedAt: setting.updatedAt,
      checkedAt: new Date().toISOString(),
      from,
      to,
      calendarName: calendar.name,
      comparison: compareCalendars(mcs, admin),
      allDay: live.filter((o) => o.allDay),
      cancelled: occurrences.length - live.length,
      mcsCount: mcs.length,
      adminCount: admin.length,
      warnings
    };
  } catch (e) {
    state = { state: "error", urlMasked, updatedAt: setting.updatedAt, message: e instanceof McsCalendarError ? e.message : `Lecture impossible : ${e instanceof Error ? e.message : "erreur inconnue"}.` };
  }
  cache = { at: Date.now(), url: setting.url, state };
  return state;
}

/** Vérifie un lien avant de l'enregistrer : il doit donner un calendrier iCal lisible. */
export async function checkIcalUrl(url: string): Promise<{ ok: true; events: number; name: string | null } | { ok: false; error: string }> {
  try {
    const text = await fetchIcalText(url);
    const from = todayIso();
    const { calendar, occurrences } = readIcalWindow(text, { from, to: addDays(from, MCS_WINDOW_DAYS - 1) });
    return { ok: true, events: occurrences.filter((o) => !o.cancelled).length, name: calendar.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lecture impossible." };
  }
}

/** Crée dans l'admin (Équipe → Entraînements) une activité vue seulement dans MonClubSportif. */
export async function createActivityFromMcs(input: { date: string; start: string; end: string | null; location: string; title: string; type: string }): Promise<string> {
  const id = await createActivityFor({ date: input.date, start: input.start, end: activityEnd(input.start, input.end), location: input.location, group: input.title, type: input.type });
  cache = null;
  return id;
}

/** Pour « Aujourd'hui » : écarts entre les deux calendriers (lecture gardée 30 minutes, 6 s au plus).
 *  null quand aucun lien n'est enregistré. */
export async function getMcsCalendarTodaySummary(): Promise<{ count: number; items: { title: string; detail: string | null; href: string }[] } | null> {
  const href = "/admin/monclubsportif/calendrier";
  let state: McsCalendarState | null = null;
  if (cache && Date.now() - cache.at < 30 * 60_000) {
    const setting = await getMcsIcalSetting();
    if (!setting) return null;
    if (setting.url === cache.url) state = cache.state;
  }
  state ??= await getMcsCalendarState({ timeoutMs: 6000 });
  if (state.state === "no-url") return null;
  if (state.state === "error") return { count: 1, items: [{ title: "Le calendrier MonClubSportif n'a pas pu être lu", detail: state.message, href }] };
  const c = state.comparison;
  const what = (d: DiffField) => (d === "lieu" ? "lieu" : d === "fin" ? "heure de fin" : "heure");
  const items = [
    ...c.differences.map((p) => ({
      title: `${shortDayLabel(p.mcs.date)} · ${p.admin.title} : ${p.diffs.map(what).join(" et ")} différent${p.diffs.length > 1 ? "s" : ""}`,
      detail: `MonClubSportif ${timeLabel(p.mcs.start)}${p.mcs.location ? `, ${p.mcs.location}` : ""} · admin ${timeLabel(p.admin.start)}${p.admin.location ? `, ${p.admin.location}` : ""}`,
      href
    })),
    ...c.onlyMcs.map((e) => ({ title: `${shortDayLabel(e.date)} ${timeLabel(e.start)} · ${e.title} : seulement dans MonClubSportif`, detail: "À créer dans l'admin (un bouton)", href })),
    ...(c.onlyAdmin.length
      ? [{ title: `${c.onlyAdmin.length} activité${c.onlyAdmin.length > 1 ? "s" : ""} de l'admin absente${c.onlyAdmin.length > 1 ? "s" : ""} de MonClubSportif`, detail: "À importer dans MonClubSportif", href: "/admin/monclubsportif" }]
      : [])
  ];
  return { count: c.differences.length + c.onlyMcs.length + c.onlyAdmin.length, items };
}
