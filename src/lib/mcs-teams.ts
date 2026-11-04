/** MonClubSportif relié au site, une équipe à la fois (agent A12) : règles pures, testées.
 *  - l'adversaire d'un match lu dans le titre MCS (« U10 F vs Laval », « Match contre Blainville », « @ Rosemère ») ;
 *  - un match sans adversaire (titre vide ou « à déterminer ») est à combler ;
 *  - une plage de match à vendre est en conflit si une équipe Valkyria du même âge a déjà un événement MCS qui la
 *    chevauche, déplacement compris. */

export interface McsEventLite {
  date: string;
  start: string | null;
  end: string | null;
  title: string;
  type: string;
}

/** « À déterminer (équipe extérieure) », « TBD », « ? »… : pas encore d'adversaire. */
const PLACEHOLDER = /^(?:\?+|tbd|tba|a determiner|a confirmer|a venir|adversaire|inconnu|equipe exterieure|-+)(?:\b|$)/;
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** L'adversaire écrit dans le titre d'un match MonClubSportif, ou null s'il n'y en a pas encore. */
export function opponentOf(title: string): string | null {
  const m = title.match(/(?:\bvs\.?|\bv\.|\bcontre\b|(?:^|\s)c\.|@|\bversus\b)\s*(.+)$/i);
  if (!m) return null;
  const raw = m[1].replace(/[()[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/[-–—:,.\s]+$/, "");
  if (!raw || PLACEHOLDER.test(norm(raw))) return null;
  return raw;
}

const VERSUS = /(?:\bvs\.?|\bv\.|\bcontre\b|(?:^|\s)c\.|@|\bversus\b)/i;

/** Un match contre une équipe extérieure dont l'adversaire n'est pas encore trouvé (« vs. À déterminer »).
 *  Un match interne sans adversaire écrit (« Simulation match #2 ») n'en a pas besoin. */
export const needsOpponent = (e: Pick<McsEventLite, "type" | "title">) => e.type === "Match" && VERSUS.test(e.title) && opponentOf(e.title) === null;

const toMin = (t: string | null | undefined) => {
  const m = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Deux créneaux du même jour se chevauchent-ils, avec `bufferMin` de déplacement avant et après ? */
export function overlaps(a: { date: string; start: string | null; end: string | null }, b: { date: string; start: string | null; end: string | null }, bufferMin = 30): boolean {
  if (a.date !== b.date) return false;
  const as = toMin(a.start);
  const bs = toMin(b.start);
  if (as === null || bs === null) return true; // événement sans heure : la journée est prise
  const ae = toMin(a.end) ?? as + 90;
  const be = toMin(b.end) ?? bs + 90;
  return as < be + bufferMin && bs < ae + bufferMin;
}

export interface SlotForConflict {
  slot_date: string;
  start_time: string | null;
  end_time: string | null;
  birth_year_min: number | null;
  birth_year_max: number | null;
  allowed_categories?: { birthYearMin: number | null; birthYearMax: number | null }[] | null;
}

/** Les années de naissance visées par une plage (null = pas de restriction : on ne peut pas savoir quelle équipe joue). */
export function slotYears(s: SlotForConflict): ((y: number) => boolean) | null {
  const rules = s.allowed_categories?.length ? s.allowed_categories : s.birth_year_min || s.birth_year_max ? [{ birthYearMin: s.birth_year_min, birthYearMax: s.birth_year_max }] : [];
  if (!rules.length) return null;
  return (y) => rules.some((r) => (r.birthYearMin === null || y >= r.birthYearMin) && (r.birthYearMax === null || y <= r.birthYearMax));
}

/** Le premier événement MCS d'une équipe du même âge qui empêche de vendre la plage, ou null. */
export function slotConflict(
  slot: SlotForConflict,
  teams: { id: string; name: string; birth_years: number[] }[],
  events: (McsEventLite & { team_id: string })[]
): { team: string; event: McsEventLite } | null {
  const fits = slotYears(slot);
  if (!fits) return null;
  const concerned = teams.filter((t) => t.birth_years.some(fits));
  for (const t of concerned) {
    const hit = events.find((e) => e.team_id === t.id && overlaps({ date: slot.slot_date, start: slot.start_time, end: slot.end_time }, { date: e.date, start: e.start, end: e.end }));
    if (hit) return { team: t.name, event: hit };
  }
  return null;
}

/** Les années de naissance écrites librement (« 2016 », « 2013-2014 », « 2017 et 2018 »). */
export function parseBirthYears(raw: string): number[] {
  const out = new Set<number>();
  for (const m of raw.matchAll(/(20\d{2})\s*[-–à]\s*(20\d{2})/g)) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort();
    for (let y = a; y <= b && y - a < 10; y++) out.add(y);
  }
  for (const m of raw.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)) out.add(Number(m[1]));
  return [...out].sort();
}
