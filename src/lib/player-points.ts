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
