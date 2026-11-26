/** Résultats du sondage des filles (borne) dans l'admin et le portail des éducateurs (JP, 25 nov. 2026) :
 *  pour chaque pratique, le classement des éducateurs qui ont aidé ou encouragé le plus de filles, le résumé
 *  (plaisir, fatigue, aide, thème compris) et la réponse de chaque fille. Règles pures, testées. */

import { wantsLabel } from "@/lib/practice-survey";

/** La réponse d'une fille à la borne (une ligne de activity_player_attendance avec feedback_at). */
export interface ResultRow {
  registrationId: string;
  /** Prénom + initiale (« Léa M. »). */
  name: string;
  practiceRating: number | null;
  fatigue: number | null;
  coachHelped: boolean | null;
  coachHelpers: string[];
  peerHelped: boolean | null;
  peerHelpers: string[];
  themeAnswer: string | null;
  themeCorrect: boolean | null;
  wantsMore: string[];
}

export interface Person {
  id: string;
  name: string;
}

export interface HelperRank {
  coachId: string;
  name: string;
  /** Filles qui disent que cette personne les a aidées ou encouragées (sur une période : une fille par pratique). */
  helped: number;
  /** Filles qui ont répondu à « Ta coach t'a-t-elle aidée ou encouragée ? » là où elle était (oui ou non). */
  asked: number;
  /** helped / asked, de 0 à 100 ; null si personne n'a répondu à la question. */
  pct: number | null;
  /** Rang « 1, 2, 2, 4 » : deux éducateurs à égalité ont le même rang. */
  rank: number;
  /** Un autre éducateur a le même nombre. */
  tied: boolean;
  /** Sur une période : nombre de pratiques sondées où elle était. */
  practices: number;
}

/** Arrondi d'une part, de 0 à 100 ; null sans dénominateur. */
export const pctOf = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);

const capWord = (x: string) => x.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

/** Prénom + initiale du nom (« léa-rose MARTIN » → « Léa-Rose M. »). */
export function girlName(first: string | null | undefined, last: string | null | undefined): string {
  const f = capWord(String(first ?? ""));
  const l = String(last ?? "").trim().charAt(0).toUpperCase();
  return [f, l ? `${l}.` : ""].filter(Boolean).join(" ") || "Joueuse";
}

/** Prénom de l'éducateur ; l'initiale du nom s'ajoute quand deux éducateurs ont le même prénom. */
export function coachNames(coaches: { id: string; first: string | null; last: string | null }[]): Map<string, string> {
  const firsts = new Map<string, number>();
  for (const c of coaches) {
    const f = capWord(String(c.first ?? ""));
    firsts.set(f, (firsts.get(f) ?? 0) + 1);
  }
  return new Map(
    coaches.map((c) => {
      const f = capWord(String(c.first ?? "")) || "Éducateur";
      const l = String(c.last ?? "").trim().charAt(0).toUpperCase();
      return [c.id, (firsts.get(f) ?? 0) > 1 && l ? `${f} ${l}.` : f] as const;
    })
  );
}

/** Rang de compétition : le plus grand d'abord ; égalité = même rang, le suivant saute (1, 2, 2, 4). */
function withRanks<T extends { helped: number; name: string }>(items: T[]): (T & { rank: number; tied: boolean })[] {
  const sorted = [...items].sort((a, b) => b.helped - a.helped || a.name.localeCompare(b.name, "fr"));
  return sorted.map((x) => ({ ...x, rank: 1 + sorted.filter((y) => y.helped > x.helped).length, tied: sorted.filter((y) => y.helped === x.helped).length > 1 }));
}

/** Classement d'une pratique : chaque éducateur sur le terrain (même nommé par personne) et chaque éducateur nommé
 *  par une fille, avec le nombre de filles qui disent avoir été aidées ou encouragées par lui. */
export function rankHelpers(rows: Pick<ResultRow, "coachHelped" | "coachHelpers">[], onField: Person[], names: Map<string, string> = new Map()): HelperRank[] {
  const asked = rows.filter((r) => r.coachHelped === true || r.coachHelped === false).length;
  const ids = new Set(onField.map((p) => p.id));
  for (const r of rows) for (const id of r.coachHelpers) ids.add(id);
  const nameOf = new Map([...names, ...onField.map((p) => [p.id, p.name] as const)]);
  const items = [...ids].map((coachId) => {
    const helped = rows.filter((r) => r.coachHelpers.includes(coachId)).length;
    return { coachId, name: nameOf.get(coachId) ?? "Éducateur", helped, asked, pct: pctOf(helped, asked), practices: 1 };
  });
  return withRanks(items);
}

/** Classement sur une période : on additionne, pratique par pratique, les filles aidées et les filles qui ont
 *  répondu là où l'éducateur était. Une fille aidée à deux pratiques compte deux fois. Les pratiques où la question
 *  n'a pas été posée (avant le 20 nov. 2026) ne comptent pas. */
export function rankHelpersOverPeriod(blocks: { ranking: HelperRank[] }[]): HelperRank[] {
  const acc = new Map<string, { name: string; helped: number; asked: number; practices: number }>();
  for (const b of blocks) {
    for (const r of b.ranking) {
      if (r.asked === 0 && r.helped === 0) continue;
      const a = acc.get(r.coachId) ?? { name: r.name, helped: 0, asked: 0, practices: 0 };
      a.helped += r.helped;
      a.asked += r.asked;
      a.practices += 1;
      acc.set(r.coachId, a);
    }
  }
  return withRanks([...acc.entries()].map(([coachId, a]) => ({ coachId, ...a, pct: pctOf(a.helped, a.asked) })));
}

export interface BlockSummary {
  /** Filles qui ont répondu à au moins une question. */
  respondents: number;
  pleasure: number | null;
  fatigue: number | null;
  coachHelp: { yes: number; answered: number; pct: number | null };
  peerHelp: { yes: number; answered: number; pct: number | null };
  theme: { understood: number; answered: number; pct: number | null };
  /** « Plus de… » les plus demandés d'abord. */
  wants: { key: string; label: string; count: number }[];
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
};

const answeredAny = (r: ResultRow) => r.practiceRating != null || r.fatigue != null || r.coachHelped != null || r.peerHelped != null || r.themeCorrect != null || r.wantsMore.length > 0;

/** Le résumé d'une pratique (ou d'une période : toutes les réponses mises ensemble). */
export function summarizeResults(rows: ResultRow[]): BlockSummary {
  const yesNo = (pick: (r: ResultRow) => boolean | null) => {
    const answered = rows.filter((r) => pick(r) === true || pick(r) === false).length;
    const yes = rows.filter((r) => pick(r) === true).length;
    return { yes, answered, pct: pctOf(yes, answered) };
  };
  const theme = yesNo((r) => r.themeCorrect);
  const counts = new Map<string, number>();
  for (const r of rows) for (const k of r.wantsMore) counts.set(k, (counts.get(k) ?? 0) + 1);
  return {
    respondents: rows.filter(answeredAny).length,
    pleasure: avg(rows.map((r) => r.practiceRating)),
    fatigue: avg(rows.map((r) => r.fatigue)),
    coachHelp: yesNo((r) => r.coachHelped),
    peerHelp: yesNo((r) => r.peerHelped),
    theme: { understood: theme.yes, answered: theme.answered, pct: theme.pct },
    wants: [...counts.entries()].map(([key, count]) => ({ key, label: wantsLabel(key), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"))
  };
}

/** Les filles nommées le plus souvent à « Est-ce que quelqu'un t'a aidée ? ». */
export function topPeers(rows: ResultRow[], names: Map<string, string>): { id: string; name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const id of r.peerHelpers) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()]
    .map(([id, count]) => ({ id, name: names.get(id) ?? "", count }))
    .filter((x) => x.name)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

/** Même pratique sur le terrain : même jour, même endroit, début à 15 minutes près (groupes fusionnés au sondage). */
export function sameField(a: { date: string; start: string; location: string | null }, b: { date: string; start: string; location: string | null }): boolean {
  const min = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  return a.date === b.date && (a.location ?? "") === (b.location ?? "") && Math.abs(min(a.start) - min(b.start)) <= 15;
}

/** Un éducateur actif voit les résultats d'une pratique de l'Académie déjà passée (ou du jour), qu'il y ait été
 *  assigné ou non (toute l'équipe, comme « Pratiques du jour ») ; une activité hors Académie, seulement s'il y était. */
export function canSeeSurveyResults(input: { coachActive: boolean; assigned: boolean; activity: { activity_date: string; activity_type: string; organization?: string | null }; today: string }): boolean {
  if (!input.coachActive) return false;
  if (input.assigned) return true;
  const d = String(input.activity.activity_date).slice(0, 10);
  return !input.activity.organization && ["Pratique", "Camp"].includes(input.activity.activity_type) && d <= input.today;
}

/** Période du filtre : « du » et « au » (AAAA-MM-JJ) valides, sinon les 28 derniers jours ; au plus 1 an. */
export function parsePeriod(raw: { du?: string; au?: string; jours?: string }, today: string): { from: string; to: string; days: number | null } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const days = Number(raw.jours);
  if (!raw.du && !raw.au && [7, 28, 70].includes(days)) return { from: shift(today, -(days - 1)), to: today, days };
  let to = raw.au && iso.test(raw.au) ? raw.au : today;
  let from = raw.du && iso.test(raw.du) ? raw.du : shift(to, -27);
  if (from > to) [from, to] = [to, from];
  if (from < shift(to, -365)) from = shift(to, -365);
  return { from, to, days: raw.du || raw.au ? null : 28 };
}
