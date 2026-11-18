import Stripe from "stripe";

import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { reconcile, type ReconcileReport, type SitePayment, type StripeCharge } from "@/lib/stripe-reconcile";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Lecture seule : les paiements Stripe (compte réel) des N derniers jours et tous les paiements connus du site. */

const TABLES: Record<string, string> = {
  registrations: "Saison filles",
  registration_payment_plan_installments: "Versement saison",
  registration_completions: "Complément de saison",
  session_program_registrations: "Programme à dates fixes",
  session_program_payment_plan_installments: "Versement programme",
  sport_etudes_registrations: "Sport-Études",
  sport_etudes_payment_plan_installments: "Versement Sport-Études",
  special_offers: "Offre spéciale",
  shop_orders: "Boutique",
  match_slot_bookings: "Vente de match",
  terrain_rentals: "Location de terrain",
  leads: "Été 2026"
};

/** Le compte Stripe réel : la clé du site si elle est live (production), sinon la clé restreinte live (ordinateur de JP). */
function liveStripe(): Stripe | null {
  if (/^(sk|rk)_live_/.test(env.stripeSecretKey ?? "")) return getStripeClient();
  const key = process.env.STRIPE_LIVE_SYNC_KEY;
  return key ? new Stripe(key) : null;
}

const who = (r: any) => {
  const player = [r.player_first_name, r.player_last_name].filter(Boolean).join(" ").trim();
  return player || r.parent_name || r.org_name || r.team_label || r.customer_name || r.name || r.title || "";
};

interface SiteIndex {
  byIntent: Map<string, SitePayment>;
  bySession: Map<string, SitePayment>;
  byEmail: Map<string, SitePayment[]>;
}

async function sitePayments(): Promise<SiteIndex> {
  const db = getSupabaseAdminClient() as any;
  const idx: SiteIndex = { byIntent: new Map(), bySession: new Map(), byEmail: new Map() };
  await Promise.all(
    Object.entries(TABLES).map(async ([table, label]) => {
      const { data } = await db.from(table).select("*");
      for (const r of (data ?? []) as any[]) {
        const p: SitePayment = { table, status: r.status ?? null, label: `${label}${who(r) ? ` · ${who(r)}` : ""}` };
        if (r.stripe_payment_intent_id) idx.byIntent.set(r.stripe_payment_intent_id, p);
        if (r.stripe_checkout_session_id) idx.bySession.set(r.stripe_checkout_session_id, p);
        const email = String(r.parent_email ?? r.email ?? r.customer_email ?? r.contact_email ?? "").trim().toLowerCase();
        if (email) idx.byEmail.set(email, [...(idx.byEmail.get(email) ?? []), p]);
      }
    })
  );
  // Commanditaires et partenaires (souvent payés par un lien Stripe fait à la main) : reconnus par le courriel du contact.
  for (const [table, label] of [["sponsors", "Commandite"], ["partnership_offers", "Partenariat"]] as const) {
    const { data } = await db.from(table).select("company_name, contact_email, status");
    for (const r of (data ?? []) as any[]) {
      const email = String(r.contact_email ?? "").trim().toLowerCase();
      if (email) idx.byEmail.set(email, [...(idx.byEmail.get(email) ?? []), { table, status: r.status ?? null, label: `${label} · ${r.company_name ?? ""}` }]);
    }
  }
  return idx;
}

export type ReconciliationResult = Omit<ReconcileReport, "missing"> & { missing: (StripeCharge & { probable: string[] })[]; days: number };

export async function getStripeReconciliation(days = 30): Promise<ReconciliationResult | { error: string }> {
  const stripe = liveStripe();
  if (!stripe) return { error: "Clé Stripe réelle absente sur cet ordinateur : le rapprochement se fait en production." };
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  const charges: StripeCharge[] = [];
  try {
    for await (const ch of stripe.charges.list({ created: { gte: since }, limit: 100 })) {
      if (ch.status !== "succeeded" || !ch.paid) continue;
      charges.push({
        id: ch.id,
        paymentIntent: typeof ch.payment_intent === "string" ? ch.payment_intent : (ch.payment_intent?.id ?? null),
        amountCents: ch.amount,
        refundedCents: ch.amount_refunded,
        created: new Date(ch.created * 1000).toISOString(),
        email: ch.billing_details?.email ?? ch.receipt_email ?? null,
        description: ch.description ?? (ch.metadata?.checkoutType ? `checkoutType ${ch.metadata.checkoutType}` : null)
      });
      if (charges.length >= 1000) break;
    }
  } catch (e) {
    return { error: `Stripe n'a pas répondu : ${e instanceof Error ? e.message : "erreur"}` };
  }
  const idx = await sitePayments();
  // 2e passe pour les paiements introuvables par leur paiement Stripe : la session de paiement (liens directs), puis le
  // courriel du parent (paiement fait par un lien envoyé à la main : « probablement »).
  const known = new Map(idx.byIntent);
  for (const c of charges) {
    if (!c.paymentIntent || known.has(c.paymentIntent)) continue;
    try {
      const sessions = await stripe.checkout.sessions.list({ payment_intent: c.paymentIntent, limit: 1 });
      const hit = sessions.data[0] ? idx.bySession.get(sessions.data[0].id) : undefined;
      if (hit) known.set(c.paymentIntent, hit);
    } catch {
      /* on garde le paiement comme introuvable */
    }
  }
  const report = reconcile(charges, known);
  const probable = report.missing.map((c) => ({ ...c, probable: c.email ? (idx.byEmail.get(c.email.toLowerCase()) ?? []).map((p) => p.label).slice(0, 3) : [] }));
  return { ...report, missing: probable, days };
}
