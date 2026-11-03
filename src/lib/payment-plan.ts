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

/** Plan de paiement pour le Programme Intensif (garçons) — 1 ou 2
 *  versements, calé sur le calendrier réel des séances (pas relatif à la
 *  date d'inscription) : le 2e versement tombe au milieu du programme. */
export function getIntensifInstallmentPlan(installments: 1 | 2, now: Date, totalCents: number): InstallmentPlan {
  if (installments === 1) {
    return { dueDates: [now], amountsCents: [totalCents] };
  }

  const dueDates = [now, new Date("2026-11-03T00:00:00-04:00")];

  const n = dueDates.length;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  const amountsCents = dueDates.map((_, i) => (i === 0 ? base + remainder : base));

  return { dueDates, amountsCents };
}

/** Plan de paiement en 2 versements pour le programme Sport-Études —
 *  moitié aujourd'hui, moitié 2 semaines plus tard (date relative à
 *  l'inscription, contrairement au plan de saison ci-dessus qui utilise
 *  des dates calendaires fixes). Aucun frais de gestion ajouté. */
export function getSportEtudesInstallmentPlan(now: Date, totalCents: number): InstallmentPlan {
  const secondDueDate = new Date(now);
  secondDueDate.setDate(secondDueDate.getDate() + 14);

  const base = Math.floor(totalCents / 2);
  const remainder = totalCents - base * 2;

  return {
    dueDates: [now, secondDueDate],
    amountsCents: [base + remainder, base]
  };
}

/** Calendrier de versements sur mesure, porté par le lien de paiement (metadata `planSchedule`) quand JP accorde
 *  un paiement par mois à une famille : « 11000@2026-11-05,11000@2026-12-01,… » (centimes@date). Le 1er versement
 *  est celui payé par le lien ; les suivants sont prélevés par /api/cron/charge-installments. Retourne null si invalide. */
export function parsePlanSchedule(raw: string | null | undefined): { amountCents: number; dueDate: string }[] | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 12) return null;
  const out: { amountCents: number; dueDate: string }[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,7})@(\d{4}-\d{2}-\d{2})$/);
    if (!m || Number(m[1]) <= 0 || Number.isNaN(Date.parse(`${m[2]}T12:00:00Z`))) return null;
    if (out.length && m[2] <= out[out.length - 1].dueDate) return null;
    out.push({ amountCents: Number(m[1]), dueDate: m[2] });
  }
  return out;
}

export const formatPlanSchedule = (items: { amountCents: number; dueDate: string }[]) => items.map((i) => `${i.amountCents}@${i.dueDate}`).join(",");
