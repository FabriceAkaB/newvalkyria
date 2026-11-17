/** Programmes et factures de l'espace parent (JP, 17 nov. 2026) : chaque paiement fait en ligne (Stripe) avec sa date,
 *  pour ce qu'il paie, et un reçu imprimable (impôts). Règles pures, testées (parent-billing.test.ts). */

export interface Payment {
  /** Identifiant Stripe du paiement (payment_intent) : sert d'adresse du reçu. */
  id: string;
  date: string;
  amountCents: number;
  label: string;
  child: string | null;
  source: "paiement" | "versement";
}

const TYPE_LABEL: Record<string, string> = {
  "season-registration": "Inscription à la saison",
  "trial-conversion": "Inscription à la saison",
  "special-offer": "Inscription à la saison (offre)",
  "season-completion": "2e partie de la saison",
  "half-season": "Demi-saison",
  trial: "Essai",
  elite: "Programme d'été",
  "installment-retry": "Versement",
  sessionprogram: "Programme",
  sportetudes: "Sport-Études",
  "shop-order": "Boutique",
  "terrain-rental": "Location de terrain",
  "match-slot": "Match",
  sponsorship: "Commandite",
  "partnership-offer": "Partenariat"
};

export const paymentLabel = (checkoutType: string | null | undefined, detail?: string | null) => {
  const base = TYPE_LABEL[checkoutType ?? ""] ?? "Paiement";
  return detail ? `${base} : ${detail}` : base;
};

/** Paiements de la famille, du plus récent au plus ancien, sans doublon (un versement prélevé qui est aussi un
 *  paiement en ligne compte une fois). */
export function mergePayments(checkouts: Payment[], installments: Payment[]): Payment[] {
  const seen = new Set(checkouts.map((p) => p.id));
  return [...checkouts, ...installments.filter((i) => !seen.has(i.id))].sort((a, b) => b.date.localeCompare(a.date));
}

/** Total payé par année civile (pour les impôts). */
export function totalsByYear(payments: Payment[]): { year: string; cents: number }[] {
  const by = new Map<string, number>();
  for (const p of payments) by.set(p.date.slice(0, 4), (by.get(p.date.slice(0, 4)) ?? 0) + p.amountCents);
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, cents]) => ({ year, cents }));
}

export const money = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
