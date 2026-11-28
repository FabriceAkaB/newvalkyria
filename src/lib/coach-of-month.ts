import { rankHelpersOverPeriod, type HelperRank } from "@/lib/practice-survey-results-core";

/** Entraîneur du mois (JP, 27 nov. 2026) : chaque mois, l'éducateur que le plus de filles ont nommé à « Ta coach
 *  t'a-t-elle aidée ou encouragée ? » sur la borne (une fille aidée à deux pratiques compte deux fois), avec
 *  l'historique de tous les mois. Égalité = co-entraîneurs du mois. Règles pures, testées (coach-of-month.test.ts). */

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export interface CoachOfMonth {
  /** AAAA-MM */
  month: string;
  label: string;
  /** Le mois n'est pas fini : c'est le classement en cours. */
  inProgress: boolean;
  winners: HelperRank[];
  ranking: HelperRank[];
  practices: number;
}

/** Les mois, du plus récent au plus ancien, à partir des pratiques sondées (chacune avec son classement). */
export function coachOfMonthHistory(blocks: { date: string; ranking: HelperRank[] }[], today: string): CoachOfMonth[] {
  const byMonth = new Map<string, { ranking: HelperRank[] }[]>();
  for (const b of blocks) {
    if (!b.ranking.some((r) => r.helped > 0 || r.asked > 0)) continue;
    const m = b.date.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), b]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, list]) => {
      const ranking = rankHelpersOverPeriod(list);
      const winners = ranking.filter((r) => r.rank === 1 && r.helped > 0);
      return { month, label: monthLabel(month), inProgress: month === today.slice(0, 7), winners, ranking, practices: list.length };
    });
}
