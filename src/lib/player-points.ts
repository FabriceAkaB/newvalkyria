/** Points des joueuses (demande de JP, 2 nov. 2026 ; P4.6 Appartenance) : règles pures.
 *  On gagne des points en étant présente, en remportant quelque chose (victoire) et grâce à son attitude.
 *  Les points s'échangent contre des récompenses. Chaque fille voit ses points ; pas de classement entre les filles. */

export const POINTS = { presence: 5, victoire: 10, attitude: 10 } as const;
/** Au plus 3 gagnantes par catégorie et par pratique, pour que les points gardent leur valeur. */
export const MAX_WINNERS = 3;

export type WinKind = "victoire" | "attitude";
export const WIN_LABEL: Record<WinKind, string> = { victoire: "A remporté quelque chose", attitude: "Attitude" };

export interface PointsLine {
  kind: "victoire" | "attitude" | "bonus" | "echange";
  points: number;
}

/** Solde d'une joueuse : présences × points de présence + gagnés (victoire, attitude, bonus) − échangés. */
export function pointsBalance(presences: number, lines: PointsLine[]) {
  const earnedWins = lines.filter((l) => l.kind !== "echange").reduce((s, l) => s + l.points, 0);
  const spent = -lines.filter((l) => l.kind === "echange").reduce((s, l) => s + l.points, 0);
  const presence = presences * POINTS.presence;
  return {
    presence,
    victoires: lines.filter((l) => l.kind === "victoire").length,
    attitudes: lines.filter((l) => l.kind === "attitude").length,
    earned: presence + earnedWins,
    spent,
    balance: presence + earnedWins - spent
  };
}

/** Vérifie qu'on peut nommer une gagnante de plus dans une catégorie pour cette pratique. */
export function canAddWinner(currentWinners: number): boolean {
  return currentWinners < MAX_WINNERS;
}

/** Récompenses accessibles avec ce solde (les plus proches d'abord parmi celles pas encore atteintes). */
export function rewardsFor(balance: number, rewards: { id: string; name: string; cost: number }[]) {
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  return { available: sorted.filter((r) => r.cost <= balance), next: sorted.find((r) => r.cost > balance) ?? null };
}

/* ── Progression comme dans un jeu (demande de JP, 3 nov. 2026) ─────────────────────────────────
 *  Les points gagnés (présences, victoires, attitude, bonus) font monter de niveau et ne se perdent jamais.
 *  Chaque récompense se débloque à un nombre de points ; une fois remise, elle ne retire aucun point. */

export const LEVELS = [
  { n: 1, name: "Recrue", min: 0 },
  { n: 2, name: "Apprentie", min: 25 },
  { n: 3, name: "Joueuse", min: 60 },
  { n: 4, name: "Guerrière", min: 100 },
  { n: 5, name: "Capitaine", min: 150 },
  { n: 6, name: "Étoile", min: 220 },
  { n: 7, name: "Valkyrie", min: 300 },
  { n: 8, name: "Légende", min: 400 }
] as const;
export type Level = (typeof LEVELS)[number];

export interface Progress {
  xp: number;
  level: Level;
  next: Level | null;
  /** Part du chemin vers le niveau suivant (0 à 1 ; 1 au dernier niveau). */
  pct: number;
  toNext: number;
  unlocked: { id: string; name: string; cost: number; given: boolean }[];
  nextReward: { id: string; name: string; cost: number; toGo: number } | null;
}

export function progressOf(xp: number, rewards: { id: string; name: string; cost: number }[] = [], givenIds: string[] = []): Progress {
  const points = Math.max(0, Math.floor(xp));
  const idx = LEVELS.reduce((best, l, i) => (points >= l.min ? i : best), 0);
  const level = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const pct = next ? (points - level.min) / (next.min - level.min) : 1;
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  const nr = sorted.find((r) => r.cost > points) ?? null;
  return {
    xp: points,
    level,
    next,
    pct: Math.max(0, Math.min(1, pct)),
    toNext: next ? next.min - points : 0,
    unlocked: sorted.filter((r) => r.cost <= points).map((r) => ({ ...r, given: givenIds.includes(r.id) })),
    nextReward: nr ? { ...nr, toGo: nr.cost - points } : null
  };
}
