/** Plan de paiement échelonné pour l'inscription à la saison — calé sur des
 *  dates fixes (pas "N jours après l'achat") car le dernier versement doit
 *  toujours tomber en octobre au plus tard :
 *    - Janvier à août  → 3 versements : aujourd'hui, 1er septembre, 1er octobre
 *    - Septembre       → 2 versements : aujourd'hui, 1er octobre
 *    - Octobre et après → aucun plan, paiement complet uniquement
 *  Des frais de gestion de INSTALLMENT_FEE_CENTS s'ajoutent à CHAQUE
 *  versement (pas seulement une fois) pour couvrir les frais de
 *  prélèvements automatiques répétés.
 *  Pur et sans dépendance : importable côté client (affichage) et côté
 *  serveur (source de vérité, jamais confiance au choix du client). */

export const INSTALLMENT_FEE_CENTS = 1575;

export interface InstallmentPlan {
  dueDates: Date[];
  amountsCents: number[];
}

export function getInstallmentPlan(now: Date, totalCents: number): InstallmentPlan | null {
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  if (month >= 10) return null;

  const dueDates = [
    now,
    ...(month <= 8
      ? [new Date(year, 8, 1), new Date(year, 9, 1)] // 1er septembre, 1er octobre
      : [new Date(year, 9, 1)]) // 1er octobre
  ];

  const n = dueDates.length;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  const amountsCents = dueDates.map((_, i) => (i === 0 ? base + remainder : base) + INSTALLMENT_FEE_CENTS);

  return { dueDates, amountsCents };
}
