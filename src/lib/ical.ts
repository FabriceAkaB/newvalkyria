import type { CalendarEvent } from "@/lib/calendar-repo";

/** Calendriers iCal (RFC 5545), en deux parties :
 *  1. Écriture : `generateICS`, le flux d'abonnement du calendrier New Valkyria (api/calendar/[token]).
 *  2. Lecture, sans dépendance et sans accès réseau : `parseIcal`, `expandEvents`, `readIcalWindow`,
 *     utilisés pour comparer le calendrier MonClubSportif à celui de l'admin (tâche P8.4.08, agent A12).
 *
 *  Ce qui est pris en charge à la lecture :
 *  - lignes repliées (folding), échappements de texte (\n \, \; \\), paramètres entre guillemets ;
 *  - VEVENT : UID, SUMMARY, LOCATION, DESCRIPTION, CATEGORIES, STATUS, DTSTART, DTEND, DURATION ;
 *  - dates en UTC (« Z »), avec TZID (IANA, chemins du type /mozilla.org/…/America/Toronto,
 *    noms Windows, VTIMEZONE du fichier), heure flottante (fuseau du calendrier) ou date seule ;
 *  - répétitions RRULE : FREQ=DAILY, WEEKLY (BYDAY, WKST), MONTHLY (BYMONTHDAY, BYDAY avec ou
 *    sans rang), YEARLY ; INTERVAL, COUNT, UNTIL, BYMONTH ; EXDATE, RDATE et les occurrences
 *    modifiées (RECURRENCE-ID) ;
 *  - développement des répétitions sur une fenêtre de dates, heures rendues dans le fuseau du club.
 *  Ce qui ne l'est pas (BYSETPOS, BYWEEKNO, BYHOUR…) est signalé dans `warnings` : on garde alors
 *  seulement la première date de l'événement plutôt que d'inventer des dates. */

// ───────────────────────── 1. Écriture (flux d'abonnement) ─────────────────────────

/** Génération iCal (RFC 5545) — format universel supporté par Google
 *  Calendar, Apple Calendar et Outlook via une simple URL d'abonnement,
 *  sans API ni identifiants tiers. TZID utilise l'identifiant IANA
 *  America/Toronto directement (reconnu nativement par les principaux
 *  clients même sans bloc VTIMEZONE complet — approche standard pour un
 *  flux à usage interne comme celui-ci). */

function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function generateICS(events: CalendarEvent[]): string {
  const now = timestamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//New Valkyria//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:New Valkyria — Calendrier",
    "X-WR-TIMEZONE:America/Toronto"
  ];

  for (const e of events) {
    const dateCompact = e.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.kind}-${e.id}@newvalkyria.com`);
    lines.push(`DTSTAMP:${now}`);

    if (e.startTime && e.endTime) {
      const start = e.startTime.slice(0, 5).replace(":", "") + "00";
      const end = e.endTime.slice(0, 5).replace(":", "") + "00";
      lines.push(`DTSTART;TZID=America/Toronto:${dateCompact}T${start}`);
      lines.push(`DTEND;TZID=America/Toronto:${dateCompact}T${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
    }

    lines.push(foldLine(`SUMMARY:${escapeText(e.title)}`));
    if (e.location) lines.push(foldLine(`LOCATION:${escapeText(e.location)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// ───────────────────────── 2. Lecture ─────────────────────────

export const DEFAULT_TZ = "America/Toronto";

const DAY_MS = 86_400_000;
const MAX_RULE_STEPS = 20_000;

export interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export interface IcalDate {
  /** Instant (ms depuis 1970, UTC). Pour une date seule : minuit dans le fuseau du calendrier. */
  ms: number;
  /** Date seule (VALUE=DATE) : journée entière. */
  dateOnly: boolean;
  /** Fuseau dans lequel la date est écrite et répétée ("UTC" pour une date en Z). */
  tz: string;
  /** Date et heure telles qu'écrites dans ce fuseau. */
  wall: Wall;
}

export interface IcalByDay {
  /** Rang dans le mois (2 = 2e, -1 = dernier), ou null. */
  n: number | null;
  /** 0 = dimanche … 6 = samedi. */
  wd: number;
}

export interface IcalRRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  until: IcalDate | null;
  byday: IcalByDay[];
  bymonthday: number[];
  bymonth: number[];
  wkst: number;
  raw: string;
}

export interface IcalEvent {
  uid: string;
  summary: string;
  location: string;
  description: string;
  categories: string[];
  /** CONFIRMED, TENTATIVE, CANCELLED… (en majuscules) ou null. */
  status: string | null;
  start: IcalDate;
  /** Durée exacte d'un événement à heure précise (0 si aucune fin). */
  durationMs: number;
  /** Nombre de jours d'une journée entière (au moins 1). */
  days: number;
  rrule: IcalRRule | null;
  /** Répétition présente mais non prise en charge : seule la première date est gardée. */
  unsupportedRule: string | null;
  exdates: IcalDate[];
  rdates: IcalDate[];
  /** Occurrence modifiée d'une série : date d'origine qu'elle remplace. */
  recurrenceId: IcalDate | null;
}

export interface IcalCalendar {
  name: string | null;
  /** Fuseau utilisé pour les heures flottantes et les dates seules. */
  timezone: string;
  events: IcalEvent[];
  warnings: string[];
}

export interface IcalOccurrence {
  /** Identifiant stable de l'occurrence : UID + instant de début. */
  key: string;
  uid: string;
  summary: string;
  location: string;
  description: string;
  categories: string[];
  allDay: boolean;
  /** Jour de début (AAAA-MM-JJ) dans le fuseau d'affichage. */
  date: string;
  /** Dernier jour (inclus). */
  endDate: string;
  /** Heure de début « HH:MM » (null pour une journée entière). */
  start: string | null;
  /** Heure de fin « HH:MM » (null pour une journée entière ou sans fin). */
  end: string | null;
  startMs: number;
  endMs: number;
  recurring: boolean;
  cancelled: boolean;
}

// ───────────────────────── Fuseaux horaires ─────────────────────────

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Date et heure murales d'un instant dans un fuseau. */
export function wallInZone(ms: number, tz: string): Wall {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get("hour");
  return { y: get("year"), m: get("month"), d: get("day"), h: h === 24 ? 0 : h, mi: get("minute"), s: get("second") };
}

function offsetAt(ms: number, tz: string): number {
  const w = wallInZone(ms, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** Instant correspondant à une heure murale dans un fuseau (gère les changements d'heure). */
export function zonedToUtc(w: Wall, tz: string): number {
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  if (tz === "UTC") return asUtc;
  const o1 = offsetAt(asUtc, tz);
  let ms = asUtc - o1;
  const o2 = offsetAt(ms, tz);
  if (o2 !== o1) ms = asUtc - o2;
  return ms;
}

const WINDOWS_TZ: Record<string, string> = {
  "eastern standard time": "America/Toronto",
  "eastern daylight time": "America/Toronto",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "pacific standard time": "America/Los_Angeles",
  "atlantic standard time": "America/Halifax",
  "newfoundland standard time": "America/St_Johns",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "Atlantic/Reykjavik",
  "romance standard time": "Europe/Paris",
  "w. europe standard time": "Europe/Berlin",
  "utc": "UTC",
  "gmt": "UTC",
  "z": "UTC"
};

/** Fuseau d'Amérique du Nord ou d'Europe selon le décalage d'hiver d'un VTIMEZONE sans nom connu. */
const BY_STANDARD_OFFSET: Record<string, string> = {
  "-0330": "America/St_Johns",
  "-0400": "America/Halifax",
  "-0500": "America/Toronto",
  "-0600": "America/Chicago",
  "-0700": "America/Denver",
  "-0800": "America/Los_Angeles",
  "+0000": "Europe/London",
  "+0100": "Europe/Paris"
};

interface VTimezoneInfo {
  location: string | null;
  standardOffset: string | null;
  hasDaylight: boolean;
}

interface ParseContext {
  defaultTz: string;
  vtimezones: Map<string, VTimezoneInfo>;
  tzCache: Map<string, string>;
  warn: (msg: string) => void;
}

function resolveTz(raw: string, ctx: ParseContext): string {
  const tzid = raw.trim().replace(/^"(.*)"$/, "$1");
  const cached = ctx.tzCache.get(tzid);
  if (cached) return cached;
  const found = findTz(tzid, ctx);
  if (!found) ctx.warn(`Fuseau horaire inconnu « ${tzid} » : heure de ${ctx.defaultTz} utilisée.`);
  const tz = found ?? ctx.defaultTz;
  ctx.tzCache.set(tzid, tz);
  return tz;
}

function findTz(tzid: string, ctx: ParseContext): string | null {
  if (!tzid) return null;
  if (/^(utc|gmt|z)$/i.test(tzid)) return "UTC";
  if (isValidTimeZone(tzid)) return tzid;
  // Chemins du type /mozilla.org/20050126_1/America/New_York ou /citadel.org/…/America/Toronto
  const segs = tzid.split("/").filter(Boolean);
  for (let n = Math.min(3, segs.length); n >= 2; n--) {
    const cand = segs.slice(-n).join("/");
    if (isValidTimeZone(cand)) return cand;
  }
  // VTIMEZONE du fichier
  const vt = ctx.vtimezones.get(tzid);
  if (vt?.location && isValidTimeZone(vt.location)) return vt.location;
  // Noms Windows (Outlook, Exchange) : « Eastern Standard Time », « (UTC-05:00) Eastern Time (US & Canada) »
  const lower = tzid.toLowerCase();
  if (WINDOWS_TZ[lower]) return WINDOWS_TZ[lower];
  if (/eastern|montr[eé]al|qu[eé]bec|toronto|new york/.test(lower)) return "America/Toronto";
  if (/central/.test(lower)) return "America/Chicago";
  if (/mountain/.test(lower)) return "America/Denver";
  if (/pacific/.test(lower)) return "America/Los_Angeles";
  if (/atlantic/.test(lower)) return "America/Halifax";
  if (vt?.standardOffset) {
    if (vt.hasDaylight && BY_STANDARD_OFFSET[vt.standardOffset]) return BY_STANDARD_OFFSET[vt.standardOffset];
    const m = vt.standardOffset.match(/^([+-])(\d{2})00$/);
    if (m) {
      const hours = Number(m[2]);
      if (hours === 0) return "UTC";
      const etc = `Etc/GMT${m[1] === "-" ? "+" : "-"}${hours}`;
      if (isValidTimeZone(etc)) return etc;
    }
  }
  return null;
}

// ───────────────────────── Jours ─────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
export const dayIndex = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
const dayOfWall = (w: Pick<Wall, "y" | "m" | "d">) => dayIndex(w.y, w.m, w.d);
function fromDayIndex(n: number): { y: number; m: number; d: number } {
  const dt = new Date(n * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
const dowOf = (day: number) => (((day + 4) % 7) + 7) % 7;
const isoOfDay = (day: number) => {
  const { y, m, d } = fromDayIndex(day);
  return `${y}-${pad(m)}-${pad(d)}`;
};
const dayOfIso = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return dayIndex(y, m, d);
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ───────────────────────── Lignes et propriétés ─────────────────────────

/** Retire les replis de ligne au niveau des octets (un caractère accentué peut être coupé en deux
 *  par un repli), puis décode (UTF-8, sinon Windows-1252). */
export function decodeIcalBytes(bytes: Uint8Array, charset?: string | null): string {
  const out = new Uint8Array(bytes.length);
  let j = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x0d && bytes[i + 1] === 0x0a && (bytes[i + 2] === 0x20 || bytes[i + 2] === 0x09)) {
      i += 2;
      continue;
    }
    if (b === 0x0a && (bytes[i + 1] === 0x20 || bytes[i + 1] === 0x09)) {
      i += 1;
      continue;
    }
    out[j++] = b;
  }
  const data = out.subarray(0, j);
  const label = (charset ?? "").trim().toLowerCase();
  if (label && !/^utf-?8$/.test(label)) {
    try {
      return new TextDecoder(label).decode(data);
    } catch {
      // charset inconnu : on essaie UTF-8 plus bas
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(data);
  }
}

/** Lignes logiques : les lignes qui commencent par une espace ou une tabulation continuent la précédente. */
export function unfoldLines(text: string): string[] {
  const raw = text.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out.filter((l) => l.trim().length > 0);
}

export interface IcalProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

export function parseContentLine(line: string): IcalProperty | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts: string[] = [];
  let cur = "";
  inQuotes = false;
  for (const c of head) {
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if (c === ";" && !inQuotes) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  let name = parts[0].trim().toUpperCase();
  const dot = name.lastIndexOf(".");
  if (dot >= 0) name = name.slice(dot + 1);
  if (!name || !/^[A-Z0-9-]+$/.test(name)) return null;
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    params[p.slice(0, eq).trim().toUpperCase()] = p.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return { name, params, value };
}

/** Texte iCal : \n ou \N = retour de ligne, \, \; \\ = le caractère lui-même. */
export function unescapeText(v: string): string {
  return v.replace(/\\(.)/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c)).trim();
}

/** Sépare une liste aux virgules non échappées (CATEGORIES). */
function splitTextList(v: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && i + 1 < v.length) {
      cur += v[i] + v[i + 1];
      i++;
    } else if (v[i] === ",") {
      out.push(cur);
      cur = "";
    } else cur += v[i];
  }
  out.push(cur);
  return out.map(unescapeText).filter(Boolean);
}

/** Durée iCal (P1W, PT1H30M, P1DT2H, -PT15M) en millisecondes, ou null. */
export function parseDuration(v: string): number | null {
  const m = v.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m || v.trim().toUpperCase() === "P" || /T$/i.test(v.trim())) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((Number(w ?? 0) * 7 + Number(d ?? 0)) * 86400 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

function parseDateValue(raw: string, params: Record<string, string>, ctx: ParseContext): IcalDate | null {
  const v = raw.trim().replace(/[-:]/g, "");
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(?:\.\d+)?(Z)?)?$/i);
  if (!m) return null;
  const [, Y, M, D, h, mi, s, z] = m;
  const wall: Wall = { y: Number(Y), m: Number(M), d: Number(D), h: Number(h ?? 0), mi: Number(mi ?? 0), s: Number(s ?? 0) };
  if (wall.m < 1 || wall.m > 12 || wall.d < 1 || wall.d > daysInMonth(wall.y, wall.m) || wall.h > 23 || wall.mi > 59 || wall.s > 60) return null;
  if ((params.VALUE ?? "").toUpperCase() === "DATE" || h === undefined) {
    const day = { ...wall, h: 0, mi: 0, s: 0 };
    return { ms: zonedToUtc(day, ctx.defaultTz), dateOnly: true, tz: ctx.defaultTz, wall: day };
  }
  if (z) return { ms: Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi, wall.s), dateOnly: false, tz: "UTC", wall };
  const tz = params.TZID ? resolveTz(params.TZID, ctx) : ctx.defaultTz;
  return { ms: zonedToUtc(wall, tz), dateOnly: false, tz, wall };
}

/** Valeurs multiples (EXDATE:a,b,c) ; une PERIOD (RDATE;VALUE=PERIOD:début/fin) garde son début. */
function parseDateList(p: IcalProperty, ctx: ParseContext): IcalDate[] {
  return p.value
    .split(",")
    .map((x) => parseDateValue(x.split("/")[0], p.params, ctx))
    .filter((x): x is IcalDate => x !== null);
}

function parseRRule(raw: string, ctx: ParseContext): { rule: IcalRRule | null; unsupported: string | null } {
  const parts = new Map<string, string>();
  for (const kv of raw.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) parts.set(kv.slice(0, eq).trim().toUpperCase(), kv.slice(eq + 1).trim());
  }
  const freq = (parts.get("FREQ") ?? "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return { rule: null, unsupported: raw };
  for (const k of ["BYSETPOS", "BYWEEKNO", "BYYEARDAY", "BYHOUR", "BYMINUTE", "BYSECOND", "RSCALE", "SKIP"]) {
    if (parts.has(k)) return { rule: null, unsupported: raw };
  }
  const byday: IcalByDay[] = [];
  for (const tok of (parts.get("BYDAY") ?? "").split(",").filter(Boolean)) {
    const m = tok.trim().toUpperCase().match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/);
    if (!m) return { rule: null, unsupported: raw };
    byday.push({ n: m[1] ? Number(m[1]) : null, wd: WEEKDAYS[m[2]] });
  }
  if (freq === "YEARLY" && byday.length) return { rule: null, unsupported: raw };
  if (freq === "MONTHLY" && byday.some((b) => b.n !== null && (b.n === 0 || Math.abs(b.n) > 5))) return { rule: null, unsupported: raw };
  const nums = (k: string) =>
    (parts.get(k) ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
  const bymonthday = nums("BYMONTHDAY");
  const bymonth = nums("BYMONTH");
  if (bymonthday.some((n) => !Number.isInteger(n) || n === 0 || Math.abs(n) > 31)) return { rule: null, unsupported: raw };
  if (bymonth.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) return { rule: null, unsupported: raw };
  if (freq === "MONTHLY" && byday.length && bymonthday.length) return { rule: null, unsupported: raw };
  const interval = Math.max(1, Number(parts.get("INTERVAL") ?? 1) || 1);
  const countRaw = parts.get("COUNT");
  const count = countRaw !== undefined && /^\d+$/.test(countRaw) ? Number(countRaw) : null;
  const untilRaw = parts.get("UNTIL");
  const until = untilRaw ? parseDateValue(untilRaw, {}, ctx) : null;
  if (untilRaw && !until) return { rule: null, unsupported: raw };
  const wkst = WEEKDAYS[(parts.get("WKST") ?? "MO").toUpperCase()] ?? 1;
  return { rule: { freq: freq as IcalRRule["freq"], interval, count, until, byday, bymonthday, bymonth, wkst, raw }, unsupported: null };
}

// ───────────────────────── Lecture du fichier ─────────────────────────

interface RawComponent {
  type: string;
  props: IcalProperty[];
  children: RawComponent[];
}

function buildTree(lines: string[]): RawComponent {
  const root: RawComponent = { type: "ROOT", props: [], children: [] };
  const stack: RawComponent[] = [root];
  for (const line of lines) {
    const p = parseContentLine(line);
    if (!p) continue;
    if (p.name === "BEGIN") {
      const comp: RawComponent = { type: p.value.trim().toUpperCase(), props: [], children: [] };
      stack[stack.length - 1].children.push(comp);
      stack.push(comp);
    } else if (p.name === "END") {
      const type = p.value.trim().toUpperCase();
      const idx = stack.map((c) => c.type).lastIndexOf(type);
      if (idx > 0) stack.length = idx;
    } else {
      stack[stack.length - 1].props.push(p);
    }
  }
  return root;
}

function collect(comp: RawComponent, type: string, out: RawComponent[] = []): RawComponent[] {
  for (const c of comp.children) {
    if (c.type === type) out.push(c);
    else if (c.type !== "VEVENT") collect(c, type, out);
  }
  return out;
}

/** Lit un fichier iCal complet. `defaultTz` : fuseau des heures flottantes si le calendrier n'en donne pas. */
export function parseIcal(text: string, opts: { defaultTz?: string } = {}): IcalCalendar {
  const warnings: string[] = [];
  const warn = (msg: string) => {
    if (!warnings.includes(msg) && warnings.length < 30) warnings.push(msg);
  };
  const root = buildTree(unfoldLines(text));
  const vtimezones = new Map<string, VTimezoneInfo>();
  for (const vt of collect(root, "VTIMEZONE")) {
    const id = vt.props.find((p) => p.name === "TZID")?.value.trim();
    if (!id) continue;
    const std = vt.children.find((c) => c.type === "STANDARD");
    vtimezones.set(id, {
      location: vt.props.find((p) => p.name === "X-LIC-LOCATION")?.value.trim() ?? null,
      standardOffset: std?.props.find((p) => p.name === "TZOFFSETTO")?.value.trim().slice(0, 5) ?? null,
      hasDaylight: vt.children.some((c) => c.type === "DAYLIGHT")
    });
  }
  const ctx: ParseContext = { defaultTz: opts.defaultTz ?? DEFAULT_TZ, vtimezones, tzCache: new Map(), warn };
  const cal = root.children.find((c) => c.type === "VCALENDAR") ?? root;
  const calName = cal.props.find((p) => p.name === "X-WR-CALNAME")?.value;
  const calTz = cal.props.find((p) => p.name === "X-WR-TIMEZONE")?.value;
  if (calTz) ctx.defaultTz = resolveTz(calTz, ctx);

  const events: IcalEvent[] = [];
  let n = 0;
  for (const comp of collect(root, "VEVENT")) {
    n++;
    const ev = buildEvent(comp, ctx, n);
    if (ev) events.push(ev);
  }
  return { name: calName ? unescapeText(calName) : null, timezone: ctx.defaultTz, events, warnings };
}

function buildEvent(comp: RawComponent, ctx: ParseContext, n: number): IcalEvent | null {
  const get = (name: string) => comp.props.find((p) => p.name === name);
  const all = (name: string) => comp.props.filter((p) => p.name === name);
  const text = (name: string) => {
    const p = get(name);
    return p ? unescapeText(p.value) : "";
  };
  const summary = text("SUMMARY");
  const dtstart = get("DTSTART");
  if (!dtstart) {
    ctx.warn(`Événement sans date de début ignoré${summary ? ` (« ${summary} »)` : ""}.`);
    return null;
  }
  const start = parseDateValue(dtstart.value, dtstart.params, ctx);
  if (!start) {
    ctx.warn(`Date illisible « ${dtstart.value} »${summary ? ` pour « ${summary} »` : ""} : événement ignoré.`);
    return null;
  }
  const dtend = get("DTEND");
  const end = dtend ? parseDateValue(dtend.value, dtend.params, ctx) : null;
  const durProp = get("DURATION");
  const dur = durProp ? parseDuration(durProp.value) : null;
  let durationMs = 0;
  let days = 1;
  if (start.dateOnly) {
    if (end && end.dateOnly) days = Math.max(1, dayOfWall(end.wall) - dayOfWall(start.wall));
    else if (dur !== null && dur > 0) days = Math.max(1, Math.round(dur / DAY_MS));
  } else if (end && end.ms > start.ms) durationMs = end.ms - start.ms;
  else if (dur !== null && dur > 0) durationMs = dur;

  const rr = get("RRULE");
  let rrule: IcalRRule | null = null;
  let unsupportedRule: string | null = null;
  if (rr) {
    const parsed = parseRRule(rr.value, ctx);
    rrule = parsed.rule;
    unsupportedRule = parsed.unsupported;
    if (unsupportedRule) ctx.warn(`Répétition non prise en charge (${unsupportedRule})${summary ? ` pour « ${summary} »` : ""} : seule la première date est lue.`);
  }
  const rid = get("RECURRENCE-ID");
  const statusRaw = get("STATUS")?.value.trim().toUpperCase();
  return {
    uid: get("UID")?.value.trim() || `sans-uid-${n}-${summary}`,
    summary,
    location: text("LOCATION"),
    description: text("DESCRIPTION"),
    categories: all("CATEGORIES").flatMap((p) => splitTextList(p.value)),
    status: statusRaw || null,
    start,
    durationMs,
    days,
    rrule,
    unsupportedRule,
    exdates: all("EXDATE").flatMap((p) => parseDateList(p, ctx)),
    rdates: all("RDATE").flatMap((p) => parseDateList(p, ctx)),
    recurrenceId: rid ? parseDateValue(rid.value, rid.params, ctx) : null
  };
}

// ───────────────────────── Répétitions ─────────────────────────

/** Jours candidats après le jour de début, en ordre croissant, selon la règle (filtres BYxxx appliqués). */
function* ruleDays(r: IcalRRule, w: Wall): Generator<number> {
  const startDay = dayOfWall(w);
  const interval = r.interval;
  const monthOk = (day: number) => !r.bymonth.length || r.bymonth.includes(fromDayIndex(day).m);
  let idle = 0;
  const tooIdle = () => ++idle > 5000;
  if (r.freq === "DAILY") {
    for (let day = startDay + interval; ; day += interval) {
      if ((r.byday.length && !r.byday.some((b) => b.wd === dowOf(day))) || !monthOk(day)) {
        if (tooIdle()) return;
        continue;
      }
      idle = 0;
      yield day;
    }
  }
  if (r.freq === "WEEKLY") {
    const wdays = r.byday.length ? r.byday.map((b) => b.wd) : [dowOf(startDay)];
    const offsets = [...new Set(wdays.map((d) => (d - r.wkst + 7) % 7))].sort((a, b) => a - b);
    const week0 = startDay - ((dowOf(startDay) - r.wkst + 7) % 7);
    for (let k = 0; ; k += interval) {
      let any = false;
      for (const off of offsets) {
        const day = week0 + 7 * k + off;
        if (day <= startDay || !monthOk(day)) continue;
        any = true;
        yield day;
      }
      if (any) idle = 0;
      else if (k > 0 && tooIdle()) return;
    }
  }
  if (r.freq === "MONTHLY") {
    const base = w.y * 12 + (w.m - 1);
    for (let k = 0; ; k += interval) {
      const y = Math.floor((base + k) / 12);
      const m = ((base + k) % 12) + 1;
      if (r.bymonth.length && !r.bymonth.includes(m)) {
        if (tooIdle()) return;
        continue;
      }
      const dim = daysInMonth(y, m);
      let list: number[];
      if (r.byday.length) {
        list = [];
        for (const b of r.byday) {
          const all: number[] = [];
          for (let d = 1; d <= dim; d++) if (dowOf(dayIndex(y, m, d)) === b.wd) all.push(d);
          if (b.n === null) list.push(...all);
          else {
            const pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n];
            if (pick) list.push(pick);
          }
        }
      } else {
        const mdays = r.bymonthday.length ? r.bymonthday : [w.d];
        list = mdays.map((md) => (md > 0 ? md : dim + md + 1)).filter((d) => d >= 1 && d <= dim);
      }
      const days = [...new Set(list)].sort((a, b) => a - b).map((d) => dayIndex(y, m, d)).filter((day) => day > startDay);
      if (!days.length) {
        if (tooIdle()) return;
        continue;
      }
      idle = 0;
      yield* days;
    }
  }
  if (r.freq === "YEARLY") {
    const months = r.bymonth.length ? r.bymonth : [w.m];
    for (let k = 0; ; k += interval) {
      const y = w.y + k;
      const days: number[] = [];
      for (const m of [...months].sort((a, b) => a - b)) {
        const dim = daysInMonth(y, m);
        const mdays = r.bymonthday.length ? r.bymonthday : [w.d];
        for (const md of mdays) {
          const d = md > 0 ? md : dim + md + 1;
          if (d >= 1 && d <= dim) days.push(dayIndex(y, m, d));
        }
      }
      const next = [...new Set(days)].sort((a, b) => a - b).filter((day) => day > startDay);
      if (!next.length) {
        if (tooIdle()) return;
        continue;
      }
      idle = 0;
      yield* next;
    }
  }
}

/** Instants de début d'un événement (série développée), limités à la fenêtre ± 1 jour. */
function seriesStarts(ev: IcalEvent, fromDay: number, toDay: number, warn: (m: string) => void): number[] {
  const st = ev.start;
  const tz = st.tz;
  const r = ev.rrule;
  const startDay = dayOfWall(st.wall);
  const msOfDay = (day: number) => zonedToUtc({ ...fromDayIndex(day), h: st.wall.h, mi: st.wall.mi, s: st.wall.s }, tz);
  const exMs = new Set(ev.exdates.filter((x) => !x.dateOnly).map((x) => x.ms));
  const exDays = new Set(ev.exdates.filter((x) => x.dateOnly).map((x) => dayOfWall(x.wall)));
  const untilDay = r?.until ? (r.until.dateOnly ? dayOfWall(r.until.wall) : dayOfWall(wallInZone(r.until.ms, tz))) : null;
  const out: number[] = [];
  let count = 0;

  /** false = la série s'arrête ici. */
  const take = (day: number): boolean => {
    let ms: number | null = null;
    const getMs = () => (ms ??= msOfDay(day));
    if (r?.until && untilDay !== null) {
      if (day > untilDay + 1) return false;
      if (r.until.dateOnly || st.dateOnly) {
        if (day > untilDay) return false;
      } else if (day >= untilDay - 1 && getMs() > r.until.ms) return false;
    }
    count++;
    if (r?.count !== null && r?.count !== undefined && count > r.count) return false;
    if (day > toDay + 1) return false;
    if (day < fromDay - 1) return true;
    if (exDays.has(day)) return true;
    if (exMs.has(getMs())) return true;
    out.push(getMs());
    return true;
  };

  const goOn = take(startDay);
  if (goOn && r) {
    let steps = 0;
    for (const day of ruleDays(r, st.wall)) {
      if (++steps > MAX_RULE_STEPS) {
        warn(`Répétition trop longue pour « ${ev.summary} » : arrêtée après ${MAX_RULE_STEPS} dates.`);
        break;
      }
      if (!take(day)) break;
    }
  }
  for (const rd of ev.rdates) {
    const day = rd.dateOnly ? dayOfWall(rd.wall) : dayOfWall(wallInZone(rd.ms, tz));
    if (day < fromDay - 1 || day > toDay + 1) continue;
    const ms = rd.dateOnly ? msOfDay(day) : rd.ms;
    if (exDays.has(day) || exMs.has(ms)) continue;
    out.push(ms);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

const hhmm = (w: Wall) => `${pad(w.h)}:${pad(w.mi)}`;
const isoOfWall = (w: Wall) => `${w.y}-${pad(w.m)}-${pad(w.d)}`;

function occurrence(ev: IcalEvent, startMs: number, tz: string, recurring: boolean): IcalOccurrence {
  const base = { uid: ev.uid, summary: ev.summary, location: ev.location, description: ev.description, categories: ev.categories, recurring, cancelled: ev.status === "CANCELLED" };
  if (ev.start.dateOnly) {
    // Une journée entière ne change pas de jour selon le fuseau : on garde la date écrite.
    const day = dayOfWall(wallInZone(startMs, ev.start.tz));
    return { ...base, key: `${ev.uid}|${isoOfDay(day)}`, allDay: true, date: isoOfDay(day), endDate: isoOfDay(day + ev.days - 1), start: null, end: null, startMs, endMs: startMs + ev.days * DAY_MS };
  }
  const sw = wallInZone(startMs, tz);
  const endMs = startMs + ev.durationMs;
  const ew = wallInZone(endMs, tz);
  return { ...base, key: `${ev.uid}|${startMs}`, allDay: false, date: isoOfWall(sw), endDate: isoOfWall(ew), start: hhmm(sw), end: ev.durationMs > 0 ? hhmm(ew) : null, startMs, endMs };
}

/** Développe les événements (répétitions, exceptions, occurrences modifiées) entre `from` et `to`
 *  (AAAA-MM-JJ, inclus) ; heures rendues dans `tz` (fuseau du club par défaut). Triées par début. */
export function expandEvents(events: IcalEvent[], window: { from: string; to: string }, opts: { tz?: string; warnings?: string[] } = {}): IcalOccurrence[] {
  const tz = opts.tz ?? DEFAULT_TZ;
  const fromDay = dayOfIso(window.from);
  const toDay = dayOfIso(window.to);
  const warn = (msg: string) => {
    if (opts.warnings && !opts.warnings.includes(msg)) opts.warnings.push(msg);
  };
  // Occurrences modifiées : elles remplacent la date d'origine de leur série.
  const replaced = new Map<string, { ms: Set<number>; days: Set<number> }>();
  for (const ev of events) {
    if (!ev.recurrenceId) continue;
    const cur = replaced.get(ev.uid) ?? { ms: new Set<number>(), days: new Set<number>() };
    if (ev.recurrenceId.dateOnly) cur.days.add(dayOfWall(ev.recurrenceId.wall));
    else cur.ms.add(ev.recurrenceId.ms);
    replaced.set(ev.uid, cur);
  }
  const out: IcalOccurrence[] = [];
  const inWindow = (o: IcalOccurrence) => (o.allDay ? o.date <= window.to && o.endDate >= window.from : o.date >= window.from && o.date <= window.to);
  for (const ev of events) {
    if (ev.recurrenceId) {
      const o = occurrence(ev, ev.start.ms, tz, true);
      if (inWindow(o)) out.push(o);
      continue;
    }
    const isSeries = !!ev.rrule || ev.rdates.length > 0;
    const allDayFrom = ev.start.dateOnly ? fromDay - ev.days : fromDay;
    const starts = isSeries ? seriesStarts(ev, allDayFrom, toDay, warn) : [ev.start.ms];
    const rep = replaced.get(ev.uid);
    for (const ms of starts) {
      if (isSeries && rep && (rep.ms.has(ms) || rep.days.has(dayOfWall(wallInZone(ms, ev.start.tz))))) continue;
      const o = occurrence(ev, ms, tz, isSeries);
      if (inWindow(o)) out.push(o);
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs || a.summary.localeCompare(b.summary));
}

/** Lecture + développement en une fois. Les avertissements de lecture et de développement sont réunis. */
export function readIcalWindow(text: string, window: { from: string; to: string }, opts: { tz?: string } = {}): { calendar: IcalCalendar; occurrences: IcalOccurrence[]; warnings: string[] } {
  const calendar = parseIcal(text, { defaultTz: opts.tz ?? DEFAULT_TZ });
  const warnings = [...calendar.warnings];
  const occurrences = expandEvents(calendar.events, window, { tz: opts.tz ?? DEFAULT_TZ, warnings });
  return { calendar, occurrences, warnings };
}

/** Le texte ressemble-t-il à un calendrier iCal ? */
export function looksLikeIcal(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text);
}
