/** Le palmarès d'une fille dans l'espace famille (JP, 25 nov. 2026) : chaque fois qu'elle a été championne du jour,
 *  la plus récente en haut, regroupées par mois, avec le compte total (« 5 fois championne »). Règles pures, testées.
 *  Données : getChampionTitles (player-points-repo.ts). */

import { CHAMPION_KINDS, type ChampionKind } from "@/lib/player-points";

export interface ChampionTitle {
  /** La ligne de points de la fille (player_points.id). */
  id: string;
  postId: string;
  registrationId: string;
  /** Jour de la pratique (AAAA-MM-JJ). */
  date: string;
  createdAt: string;
  kind: ChampionKind;
  /** Le jeu ou le défi écrit par l'éducatrice (« Roi du carré »), s'il existe. */
  title: string | null;
  /** Points reçus par elle pour ce titre. */
  points: number;
  /** La pratique ou le groupe. */
  group: string;
  coachName: string | null;
  /** Les autres filles du même titre (groupe gagnant), prénom et initiale seulement. */
  teammates: string[];
  /** Photo signée, seulement si chaque fille de la photo a l'autorisation de sa famille. */
  photoUrl: string | null;
}

/** La plus récente en haut : jour de la pratique, puis l'heure de publication. */
export function sortTitles<T extends Pick<ChampionTitle, "date" | "createdAt">>(titles: T[]): T[] {
  return [...titles].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** « Pas encore championne », « 1 fois championne », « 5 fois championne ». */
export function timesLabel(n: number): string {
  return n <= 0 ? "Pas encore championne" : `${n} fois championne`;
}

/** Le résumé en haut du palmarès : total, points gagnés par ses titres, compte par catégorie (dans l'ordre des
 *  catégories, seulement celles qu'elle a), date du dernier titre. */
export function palmaresSummary(titles: Pick<ChampionTitle, "kind" | "points" | "date">[]) {
  const byKind = CHAMPION_KINDS.map((k) => ({ kind: k.kind, label: k.label, count: titles.filter((t) => t.kind === k.kind).length })).filter((k) => k.count > 0);
  const last = titles.reduce<string | null>((max, t) => (!max || t.date > max ? t.date : max), null);
  return { total: titles.length, points: titles.reduce((s, t) => s + Math.max(0, t.points), 0), byKind, last };
}

const KIND_COUNT: Record<ChampionKind, (n: number) => string> = {
  individuel: (n) => `${n} fois gagnante`,
  groupe: (n) => (n > 1 ? `${n} fois en groupe gagnant` : "1 fois en groupe gagnant"),
  attitude: (n) => `${n} fois pour l'attitude`,
  special: (n) => (n > 1 ? `${n} parties spéciales` : "1 partie spéciale")
};

/** Une ligne de résumé lisible : « 3 fois gagnante · 1 fois pour l'attitude ». */
export function kindsLine(byKind: { kind: ChampionKind; count: number }[]): string {
  return byKind.map((k) => KIND_COUNT[k.kind](k.count)).join(" · ");
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Regroupe les titres par mois (« Novembre 2026 »), le mois le plus récent en haut, l'ordre des titres gardé. */
export function groupByMonth<T extends Pick<ChampionTitle, "date" | "createdAt">>(titles: T[]): { key: string; label: string; items: T[] }[] {
  const out: { key: string; label: string; items: T[] }[] = [];
  for (const t of sortTitles(titles)) {
    const key = t.date.slice(0, 7);
    let g = out.find((x) => x.key === key);
    if (!g) {
      const m = MONTHS[Number(key.slice(5, 7)) - 1] ?? "";
      g = { key, label: `${m.charAt(0).toUpperCase()}${m.slice(1)} ${key.slice(0, 4)}`, items: [] };
      out.push(g);
    }
    g.items.push(t);
  }
  return out;
}
