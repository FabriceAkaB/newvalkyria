import { isCancelled, isSoloSession } from "@/lib/delivery-core";
import { personKey } from "@/lib/mcs-rules";

/** L'horaire d'une fille dans l'espace famille (Mandalart P8.8.04) : règles pures. MonClubSportif fait foi : les
 *  événements viennent de `mcs_events` (équipes de la fille), sans les annulés, sans les séances solo d'une autre
 *  joueuse, sans ceux où elle est déjà notée absente. */

export const PRACTICE_DAYS = 14;
export const MATCH_DAYS = 60;

export interface ScheduleEvent {
  teamId: string;
  date: string; // AAAA-MM-JJ
  start: string | null; // HH:MM
  end: string | null;
  title: string;
  location: string | null;
  type: string; // « Pratique », « Match », « Tournoi »
  opponent: string | null;
}

export interface ScheduleTeam {
  id: string;
  name: string;
  /** Demi-saison : dernière date couverte ; null = toute la saison. */
  until: string | null;
}

export interface ScheduleItem {
  kind: "pratique" | "match";
  date: string;
  start: string | null;
  end: string | null;
  group: string;
  title: string;
  place: string | null;
  address: string | null;
  opponent: string | null;
}

export interface GirlScheduleInput {
  firstName: string;
  lastName: string;
  teams: ScheduleTeam[];
  /** Tous les noms d'équipes (pour nommer le groupe d'une séance solo rangée ailleurs). */
  teamNames: Map<string, string>;
  events: ScheduleEvent[];
  /** Absences déjà notées : jour + heure de début de l'activité. */
  absences: { date: string; start: string | null }[];
  today: string;
  /** Heure actuelle à Montréal (HH:MM) : une activité d'aujourd'hui déjà finie n'est plus « à venir ». */
  nowHm: string;
}

const toMin = (t: string | null) => (t && /^\d{1,2}:\d{2}/.test(t) ? Number(t.slice(0, t.indexOf(":"))) * 60 + Number(t.slice(t.indexOf(":") + 1, t.indexOf(":") + 3)) : null);

export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** « Event Jeudi 2016-2017 - Pratique en gym » → « Pratique en gym » ; « Other Équipe 2015 AV vs. X » → « Équipe 2015 AV vs. X ». */
export function eventLabel(title: string, teamName: string): string {
  let t = String(title ?? "").replace(/^(Event|Other|Autre|Pre-season|Pré-saison|Game|Événement|Evenement|Hors-concours|Exhibition)\s+/i, "").trim();
  // Les morceaux du début qui ne font que répéter le nom de l'équipe (« Jeudi 2016-2017 - … ») sont retirés.
  const teamWords = new Set(personKey(teamName, "").split(" ").filter(Boolean));
  const parts = t.split(/\s+[-–—]\s+/);
  while (parts.length > 1 && personKey(parts[0], "").split(" ").filter(Boolean).every((w) => teamWords.has(w))) parts.shift();
  t = parts.join(" – ");
  return t.trim();
}

/** « École des Falaises (gym/futsal) - 977 rue Marchand, Prévost » → lieu + adresse ; sans adresse reconnue, tout va dans l'adresse. */
export function splitLocation(location: string | null | undefined): { place: string | null; address: string | null } {
  const s = String(location ?? "").replace(/\s+/g, " ").trim();
  if (!s) return { place: null, address: null };
  const m = s.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m && /^\d/.test(m[2].trim())) return { place: m[1].trim(), address: m[2].trim() };
  return { place: null, address: s };
}

/** Lien Google Maps pour l'adresse (rien de personnel dans l'URL : seulement le lieu public). */
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** « 18:30 » → « 18 h 30 », « 18:00 » → « 18 h ». */
export function fmtTime(t: string | null): string | null {
  const m = toMin(t);
  if (m === null) return null;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} h ${String(min).padStart(2, "0")}` : `${h} h`;
}

/** « jeudi 20 novembre », ou « Aujourd'hui » / « Demain ». */
export function fmtDay(date: string, today: string): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDays(today, 1)) return "Demain";
  const s = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 18 h 30 à 19 h 45 ». */
export function fmtHours(start: string | null, end: string | null): string | null {
  const a = fmtTime(start);
  const b = fmtTime(end);
  if (a && b) return `${a} à ${b}`;
  return a ?? null;
}

const isMatch = (e: ScheduleEvent) => /^(match|tournoi)$/i.test(e.type);

/** Les prochaines pratiques (14 jours) et les prochains matchs (60 jours) d'une fille, triés. */
export function buildGirlSchedule(input: GirlScheduleInput): { practices: ScheduleItem[]; matches: ScheduleItem[] } {
  const mine = new Map(input.teams.map((t) => [t.id, t]));
  const me = personKey(input.firstName, input.lastName);
  const practiceUntil = addDays(input.today, PRACTICE_DAYS);
  const matchUntil = addDays(input.today, MATCH_DAYS);
  const now = toMin(input.nowHm) ?? 0;
  const seen = new Set<string>();
  const practices: ScheduleItem[] = [];
  const matches: ScheduleItem[] = [];
  const sorted = [...input.events].sort((a, b) => a.date.localeCompare(b.date) || String(a.start ?? "").localeCompare(String(b.start ?? "")));
  for (const e of sorted) {
    if (!e.date || e.date < input.today) continue;
    if (isCancelled(e.title) || /annul/i.test(String(e.opponent ?? ""))) continue;
    const team = mine.get(e.teamId);
    // Séance solo : seulement celle qui porte son nom, même rangée dans une équipe où elle n'est pas.
    const label = eventLabel(e.title, input.teamNames.get(e.teamId) ?? team?.name ?? "");
    if (isSoloSession(label)) {
      if (!me || !` ${personKey(e.title, "")} `.includes(` ${me} `)) continue;
    } else if (!team) continue;
    if (team?.until && e.date > team.until) continue;
    const match = isMatch(e);
    if (e.date > (match ? matchUntil : practiceUntil)) continue;
    if (e.date === input.today) {
      const end = toMin(e.end) ?? (toMin(e.start) ?? 0) + 60;
      if (end <= now) continue;
    }
    const start = toMin(e.start);
    if (input.absences.some((a) => a.date === e.date && (start === null || toMin(a.start) === null || Math.abs((toMin(a.start) as number) - start) <= 15))) continue;
    const loc = splitLocation(e.location);
    const dedup = `${e.date}|${e.start ?? ""}|${loc.address ?? ""}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    const group = team?.name ?? input.teamNames.get(e.teamId) ?? "";
    const opponent = match && e.opponent && !/d[ée]terminer/i.test(e.opponent) ? e.opponent : null;
    const item: ScheduleItem = {
      kind: match ? "match" : "pratique",
      date: e.date,
      start: e.start ? e.start.slice(0, 5) : null,
      end: e.end ? e.end.slice(0, 5) : null,
      group,
      title: match && !opponent && /d[ée]terminer/i.test(label) ? "Match (adversaire à confirmer)" : label,
      place: loc.place,
      address: loc.address,
      opponent
    };
    (match ? matches : practices).push(item);
  }
  return { practices, matches };
}
