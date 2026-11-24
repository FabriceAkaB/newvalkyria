/** Tournois (JP, 25 nov. 2026) : règles pures, sans base ni réseau.
 *
 *  Un tournoi est un programme à dates fixes (`session_programs`, `program_kind = 'tournoi'`) ; ses réglages vivent
 *  dans `presentation.tournament`. L'académie n'avance pas d'argent : on mesure l'intérêt, un minimum de joueuses
 *  rend le projet possible, et au go chaque famille disponible paie sa part :
 *  (inscription du tournoi + salaire d'un coach) par équipe, divisé par le nombre de joueuses. */

export type TournamentAnswer = "interessee" | "disponible" | "pas_cette_fois";
export type OfferStatus = "offerte" | "payee" | "expiree" | "retiree";

export const ANSWERS: { key: TournamentAnswer; label: string; hint: string }[] = [
  { key: "disponible", label: "Disponible", hint: "Elle sera là : on lui garde une place au go." },
  { key: "interessee", label: "Intéressée", hint: "Ça nous intéresse, à confirmer." },
  { key: "pas_cette_fois", label: "Pas cette fois", hint: "Elle ne participera pas à celui-ci." }
];

export const answerLabel = (a: TournamentAnswer | null | undefined) => ANSWERS.find((x) => x.key === a)?.label ?? "Pas de réponse";

export interface TournamentSettings {
  imageUrl: string | null;
  location: string;
  venue: string | null;
  organizer: string | null;
  organizerUrl: string | null;
  /** Équipe ou génération visée, en mots (ex. « Équipe 2015 AV »). */
  teamLabel: string;
  info: string;
  /** Inscription d'une équipe au tournoi (taxes incluses). */
  entryFeeCents: number;
  /** Salaire d'un coach pour une équipe. */
  coachFeeCents: number;
  /** Nombre d'équipes inscrites (1 par défaut). */
  teams: number;
  /** Seulement les joueuses du groupe avancé. */
  advancedOnly: boolean;
  /** Programmes de la saison admissibles (vide = tous). */
  programIds: string[];
  /** Jours laissés pour payer après le go. */
  payDays: number;
  /** Rappel avant la date limite, en heures. */
  reminderHours: number;
  /** Sondage d'intérêt d'où viennent les premières réponses (choix coché = intéressée). */
  survey: { id: string; option: string } | null;
  go: { at: string; by: string; priceCents: number; players: number; deadline: string } | null;
  /** Tournoi d'essai : seulement les joueuses de la saison de démonstration le voient, jamais les vraies familles. */
  test: boolean;
}

const int = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : d);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function readSettings(presentation: unknown): TournamentSettings {
  const t = ((presentation as any)?.tournament ?? {}) as Record<string, any>;
  const go = t.go && typeof t.go === "object" && t.go.at ? { at: String(t.go.at), by: str(t.go.by) || "JP", priceCents: int(t.go.priceCents), players: int(t.go.players), deadline: String(t.go.deadline ?? "") } : null;
  return {
    imageUrl: str(t.imageUrl) || null,
    location: str(t.location),
    venue: str(t.venue) || null,
    organizer: str(t.organizer) || null,
    organizerUrl: str(t.organizerUrl) || null,
    teamLabel: str(t.teamLabel),
    info: str(t.info),
    entryFeeCents: int(t.entryFeeCents),
    coachFeeCents: int(t.coachFeeCents),
    teams: Math.max(1, int(t.teams, 1)),
    advancedOnly: t.advancedOnly === true,
    programIds: Array.isArray(t.programIds) ? t.programIds.map(String).filter(Boolean) : [],
    payDays: Math.min(30, Math.max(1, int(t.payDays, 7))),
    reminderHours: Math.min(240, Math.max(1, int(t.reminderHours, 48))),
    survey: t.survey?.id && t.survey?.option ? { id: String(t.survey.id), option: String(t.survey.option) } : null,
    go,
    test: t.test === true
  };
}

/** Frais de toutes les équipes : inscription + coach, par équipe. */
export const totalFeesCents = (s: Pick<TournamentSettings, "entryFeeCents" | "coachFeeCents" | "teams">) => (s.entryFeeCents + s.coachFeeCents) * Math.max(1, s.teams);

/** Part de chaque joueuse, arrondie au dollar supérieur (la somme couvre toujours les frais). */
export function costPerPlayerCents(s: Pick<TournamentSettings, "entryFeeCents" | "coachFeeCents" | "teams">, players: number): number | null {
  if (!Number.isFinite(players) || players <= 0) return null;
  const total = totalFeesCents(s);
  if (total <= 0) return 0;
  return Math.ceil(total / players / 100) * 100;
}

/** Fourchette affichée avant le go : au minimum de joueuses (le plus cher) et à l'équipe complète (le moins cher). */
export function costRange(s: TournamentSettings, minPlayers: number, maxPlayers: number): { high: number | null; low: number | null } {
  return { high: costPerPlayerCents(s, Math.max(1, minPlayers)), low: costPerPlayerCents(s, Math.max(1, maxPlayers, minPlayers)) };
}

export interface ResponseLite {
  id: string;
  response: TournamentAnswer;
  respondedAt: string;
  offerStatus: OfferStatus | null;
}

export interface Tally {
  disponible: number;
  interessee: number;
  pasCetteFois: number;
  offered: number;
  paid: number;
}

export function tally(rows: ResponseLite[]): Tally {
  const t: Tally = { disponible: 0, interessee: 0, pasCetteFois: 0, offered: 0, paid: 0 };
  for (const r of rows) {
    if (r.response === "disponible") t.disponible++;
    else if (r.response === "interessee") t.interessee++;
    else t.pasCetteFois++;
    if (r.offerStatus === "offerte") t.offered++;
    if (r.offerStatus === "payee") t.paid++;
  }
  return t;
}

/** Barre « X sur le minimum » : les disponibles comptent (et celles qui ont payé, même si elles avaient dit intéressée). */
export function progress(rows: ResponseLite[], minPlayers: number): { count: number; min: number; pct: number; reached: boolean } {
  const count = rows.filter((r) => r.response === "disponible" || r.offerStatus === "payee").length;
  const min = Math.max(1, minPlayers);
  return { count, min, pct: Math.min(100, Math.round((count / min) * 100)), reached: count >= min };
}

const byTime = (a: ResponseLite, b: ResponseLite) => a.respondedAt.localeCompare(b.respondedAt) || a.id.localeCompare(b.id);

/** File pour les places : les disponibles d'abord (premières répondues d'abord), puis les intéressées.
 *  Celles qui ont dit « pas cette fois », dont la place a expiré ou a été retirée n'y sont jamais. */
export function queue(rows: ResponseLite[]): ResponseLite[] {
  const free = rows.filter((r) => r.offerStatus === null && r.response !== "pas_cette_fois");
  return [...free.filter((r) => r.response === "disponible").sort(byTime), ...free.filter((r) => r.response === "interessee").sort(byTime)];
}

/** Au go : les places offertes (disponibles seulement, jusqu'au maximum) ; le prix est fixé sur ce nombre. */
export function planGo(rows: ResponseLite[], maxPlaces: number): { offer: string[]; waiting: string[] } {
  const dispo = queue(rows).filter((r) => r.response === "disponible");
  const room = Math.max(0, maxPlaces - rows.filter((r) => r.offerStatus === "offerte" || r.offerStatus === "payee").length);
  return { offer: dispo.slice(0, room).map((r) => r.id), waiting: dispo.slice(room).map((r) => r.id) };
}

/** Places libérées (offre expirée ou retirée) à reprendre : la suivante de la file, autant que de places libres. */
export function nextOffers(rows: ResponseLite[], maxPlaces: number): string[] {
  const taken = rows.filter((r) => r.offerStatus === "offerte" || r.offerStatus === "payee").length;
  const room = Math.max(0, maxPlaces - taken);
  return queue(rows).slice(0, room).map((r) => r.id);
}

export const HOUR = 3_600_000;

/** Date limite de paiement : à 23 h 59 (heure de Montréal, environ) du jour J + payDays. */
export function payDeadline(now: Date, payDays: number): string {
  const d = new Date(now.getTime() + payDays * 86_400_000);
  const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  return new Date(`${ymd}T23:59:00-05:00`).toISOString();
}

/** Heure du rappel : `reminderHours` avant la limite, jamais avant une heure après l'offre. */
export function reminderAt(offeredAt: Date, deadlineIso: string, reminderHours: number): string {
  const at = Date.parse(deadlineIso) - reminderHours * HOUR;
  return new Date(Math.max(at, offeredAt.getTime() + HOUR)).toISOString();
}

export const isExpired = (offerStatus: OfferStatus | null, deadline: string | null, now: Date) => offerStatus === "offerte" && !!deadline && Date.parse(deadline) < now.getTime();

/** Clé d'une joueuse : prénom + nom sans accents, majuscules ni espaces en trop. */
export function playerKey(first: string, last: string): string {
  return `${first} ${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Une joueuse de la saison est-elle visée par ce tournoi ? */
export function isEligible(girl: { birthYear: number | null; programId: string | null; advanced: boolean; demo?: boolean }, s: TournamentSettings, birthYears: string[]): boolean {
  if (!!girl.demo !== s.test) return false;
  if (birthYears.length && (!girl.birthYear || !birthYears.includes(String(girl.birthYear)))) return false;
  if (s.advancedOnly && !girl.advanced) return false;
  if (s.programIds.length && (!girl.programId || !s.programIds.includes(girl.programId))) return false;
  return true;
}

/** Une réponse au sondage d'intérêt compte comme « intéressée » pour ce tournoi si la famille a dit oui et coché sa date. */
export function surveySaysInterested(answers: Record<string, unknown>, interestQuestionId: string, option: string): boolean {
  const interest = String(answers?.[interestQuestionId] ?? "");
  if (!/^oui/i.test(interest)) return false;
  const picked = Object.values(answers ?? {}).flatMap((v) => (Array.isArray(v) ? v.map(String) : []));
  return picked.some((p) => p === option || p.startsWith(option));
}

export const money = (c: number | null | undefined) => (c == null ? "à calculer" : (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: c % 100 ? 2 : 0 }));

/** « 14 et 15 février 2027 », « samedi 4 septembre 2027 », « 3 au 5 juillet 2027 ». */
export function datesLabel(dates: string[]): string {
  const ds = [...new Set(dates.map((d) => String(d).slice(0, 10)))].sort();
  if (!ds.length) return "Dates à confirmer";
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { ...o, timeZone: "UTC" });
  if (ds.length === 1) return f(ds[0], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const first = ds[0];
  const last = ds[ds.length - 1];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const joiner = ds.length === 2 ? " et " : " au ";
  return sameMonth ? `${f(first, { day: "numeric" })}${joiner}${f(last, { day: "numeric", month: "long", year: "numeric" })}` : `${f(first, { day: "numeric", month: "long" })}${joiner}${f(last, { day: "numeric", month: "long", year: "numeric" })}`;
}

export const deadlineLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Toronto" });

/** Ce que voit une famille (aucune donnée d'autres familles : seulement le compte de la barre). */
export interface TournamentView {
  slug: string;
  name: string;
  imageUrl: string | null;
  teamLabel: string;
  location: string;
  venue: string | null;
  organizer: string | null;
  organizerUrl: string | null;
  info: string;
  datesLabel: string;
  firstDate: string | null;
  minPlayers: number;
  maxPlayers: number;
  count: number;
  reached: boolean;
  pct: number;
  go: boolean;
  costHigh: number | null;
  costLow: number | null;
  priceCents: number | null;
  totalFeesCents: number;
  teams: number;
}

export interface GirlAnswer {
  firstName: string;
  lastName: string;
  answer: TournamentAnswer | null;
  offerStatus: OfferStatus | null;
  payDeadline: string | null;
  token: string | null;
}

export function toView(t: { slug: string; name: string; dates: string[]; datesLabel: string; minPlayers: number; maxPlayers: number; settings: TournamentSettings; progress: { count: number; reached: boolean; pct: number }; cost: { high: number | null; low: number | null; now: number | null } }): TournamentView {
  return {
    slug: t.slug,
    name: t.name,
    imageUrl: t.settings.imageUrl,
    teamLabel: t.settings.teamLabel,
    location: t.settings.location,
    venue: t.settings.venue,
    organizer: t.settings.organizer,
    organizerUrl: t.settings.organizerUrl,
    info: t.settings.info,
    datesLabel: t.datesLabel,
    firstDate: t.dates[0] ?? null,
    minPlayers: t.minPlayers,
    maxPlayers: t.maxPlayers,
    count: t.progress.count,
    reached: t.progress.reached,
    pct: t.progress.pct,
    go: !!t.settings.go,
    costHigh: t.cost.high,
    costLow: t.cost.low,
    priceCents: t.settings.go ? t.settings.go.priceCents : null,
    totalFeesCents: totalFeesCents(t.settings),
    teams: t.settings.teams
  };
}
