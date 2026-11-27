/** Adversaires (JP, 27 nov. 2026) : chaque club qui joue (ou veut jouer) contre nous, avec ses équipes (catégorie,
 *  calibre, combien d'équipes de cette catégorie), ses matchs et ce qu'il a payé ; actif ou archivé. Une équipe vient du
 *  formulaire du club (/prive/matchs) ou est ajoutée à la main par JP. Règles pures, testées (match-opponents.test.ts). */

export interface OpponentTeamRow {
  id: string;
  org_name: string;
  org_key: string;
  team_label: string;
  team_gender: string;
  team_birth_year: number;
  team_birth_year_to: number | null;
  team_level: string;
  team_players: number | null;
  team_count?: number | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string | null;
  logo_url?: string | null;
  archived_at?: string | null;
  source?: string | null;
  created_at: string;
}

export interface OpponentBookingRow {
  org_key: string | null;
  org_name: string;
  status: string;
  price_cents: number | null;
  balance_due_cents?: number | null;
  balance_paid_at?: string | null;
  slot_date: string | null;
}

export interface Opponent {
  key: string;
  name: string;
  logo: string | null;
  archived: boolean;
  teams: OpponentTeamRow[];
  /** Nombre d'équipes en tout (une ligne peut dire « 2 équipes de cette catégorie »). */
  teamTotal: number;
  contacts: { name: string; email: string; phone: string }[];
  matchesPaid: number;
  paidCents: number;
  lastMatch: string | null;
  nextMatch: string | null;
}

export const GENDER_WORD: Record<string, string> = { filles: "Filles", garcons: "Garçons", mixte: "Mixte", tous: "Tous" };

/** « Filles 2015 · AA » ou « Garçons 2014-2015 · Compétitif ». */
export function categoryLabel(t: Pick<OpponentTeamRow, "team_gender" | "team_birth_year" | "team_birth_year_to" | "team_level">): string {
  const years = t.team_birth_year_to && t.team_birth_year_to !== t.team_birth_year ? `${Math.min(t.team_birth_year, t.team_birth_year_to)}-${Math.max(t.team_birth_year, t.team_birth_year_to)}` : String(t.team_birth_year);
  return [GENDER_WORD[t.team_gender] ?? t.team_gender, years, t.team_level].filter(Boolean).join(" · ");
}

/** Regroupe les équipes et les réservations par club ; un club est archivé quand toutes ses équipes le sont. */
export function groupOpponents(teams: OpponentTeamRow[], bookings: OpponentBookingRow[], today: string): Opponent[] {
  const by = new Map<string, Opponent>();
  const get = (key: string, name: string) => {
    let o = by.get(key);
    if (!o) {
      o = { key, name, logo: null, archived: false, teams: [], teamTotal: 0, contacts: [], matchesPaid: 0, paidCents: 0, lastMatch: null, nextMatch: null };
      by.set(key, o);
    }
    return o;
  };
  for (const t of teams) {
    const o = get(t.org_key || t.org_name.toLowerCase(), t.org_name);
    o.teams.push(t);
    o.teamTotal += Math.max(1, Number(t.team_count) || 1);
    if (!o.logo && t.logo_url) o.logo = t.logo_url;
    const email = t.contact_email.trim().toLowerCase();
    if (email && !o.contacts.some((c) => c.email.toLowerCase() === email)) o.contacts.push({ name: t.contact_name, email: t.contact_email.trim(), phone: t.contact_phone });
    else if (!email && t.contact_name && !o.contacts.some((c) => c.name === t.contact_name)) o.contacts.push({ name: t.contact_name, email: "", phone: t.contact_phone });
  }
  for (const b of bookings) {
    if (b.status !== "paid") continue;
    const o = get(b.org_key || b.org_name.toLowerCase(), b.org_name);
    o.matchesPaid++;
    o.paidCents += (b.price_cents ?? 0) + (b.balance_paid_at ? b.balance_due_cents ?? 0 : 0);
    const d = b.slot_date ? String(b.slot_date).slice(0, 10) : null;
    if (d && d < today && (!o.lastMatch || d > o.lastMatch)) o.lastMatch = d;
    if (d && d >= today && (!o.nextMatch || d < o.nextMatch)) o.nextMatch = d;
  }
  for (const o of by.values()) o.archived = o.teams.length > 0 && o.teams.every((t) => t.archived_at);
  return [...by.values()].sort((a, b) => Number(Boolean(b.nextMatch)) - Number(Boolean(a.nextMatch)) || b.matchesPaid - a.matchesPaid || a.name.localeCompare(b.name, "fr"));
}

/* ── Matchs à l'extérieur ─────────────────────────────────────────── */

export interface McsGame {
  date: string;
  start: string | null;
  end: string | null;
  team: string;
  title: string;
  location: string | null;
  type: string | null;
}

export interface SlotTime {
  slot_date: string;
  start_time: string;
}

const toMin = (t: string | null | undefined) => (t && /^\d{1,2}:\d{2}/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** Les matchs de nos équipes dans MonClubSportif qui ne sont sur aucune de nos plages (même jour, ± 15 min) :
 *  matchs à l'extérieur ou ajoutés directement dans MonClubSportif. Les annulés ne comptent pas. */
export function awayMatches(games: McsGame[], slots: SlotTime[], today: string): McsGame[] {
  return games
    .filter((g) => (g.type === "Match" || g.type === "Tournoi") && g.date >= today && !/annul/i.test(g.title))
    .filter((g) => !slots.some((s) => String(s.slot_date).slice(0, 10) === g.date && Math.abs((toMin(s.start_time) ?? -999) - (toMin(g.start) ?? 999)) <= 15))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.start ?? "").localeCompare(String(b.start ?? "")));
}

/** « Équipe 2015 AV c. JF Prépa » à partir du titre MonClubSportif (« Hors-concours Équipe 2015 AV c. JF Prépa »). */
export const gameLabel = (title: string) => title.replace(/^(Other|Autre|Event|Événement|Hors-concours|Pre-season|Exhibition|Regular|Régulier)\s+/i, "").trim();
