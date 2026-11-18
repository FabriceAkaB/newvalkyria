/** Rapprochement Stripe ↔ site (Mandalart P7.7.04, JP 18 nov. 2026) : chaque paiement reçu dans Stripe doit exister dans
 *  le site, et un paiement remboursé dans Stripe ne doit plus être « payé » dans le site. Règles pures ; la lecture de
 *  Stripe et des tables est dans stripe-reconcile-repo.ts. */

export interface StripeCharge {
  id: string;
  paymentIntent: string | null;
  amountCents: number;
  refundedCents: number;
  created: string;
  email: string | null;
  description: string | null;
}

export interface SitePayment {
  table: string;
  status: string | null;
  label: string;
}

/** Statuts du site qui veulent dire « l'argent est gardé ». */
const KEPT = new Set(["paid", "confirmed", "completed", "fulfilled", "essai", null as unknown as string]);

export interface ReconcileReport {
  checked: number;
  matched: number;
  /** Payé dans Stripe, introuvable dans le site (webhook manqué, ou lien de paiement fait à la main). */
  missing: StripeCharge[];
  /** Remboursé (en tout ou en partie) dans Stripe, mais encore compté comme payé dans le site. */
  refundNotRecorded: (StripeCharge & { site: SitePayment })[];
  totalCents: number;
  refundedCents: number;
}

export function reconcile(charges: StripeCharge[], site: Map<string, SitePayment>): ReconcileReport {
  const report: ReconcileReport = { checked: charges.length, matched: 0, missing: [], refundNotRecorded: [], totalCents: 0, refundedCents: 0 };
  for (const c of charges) {
    report.totalCents += c.amountCents;
    report.refundedCents += c.refundedCents;
    const s = c.paymentIntent ? site.get(c.paymentIntent) : undefined;
    if (!s) {
      report.missing.push(c);
      continue;
    }
    report.matched++;
    if (c.refundedCents > 0 && KEPT.has(s.status as string)) report.refundNotRecorded.push({ ...c, site: s });
  }
  report.missing.sort((a, b) => b.created.localeCompare(a.created));
  return report;
}
