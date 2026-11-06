import type Stripe from "stripe";

import { logAudit } from "@/lib/audit-repo";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Carte pour les versements à venir d'un plan de saison qui n'en a pas (ex. une famille a payé au complet, puis JP lui
 *  accorde de payer en 2 fois : on rembourse une partie et le reste est prélevé à sa date). Le parent ouvre un lien
 *  permanent (`planCardUrl`) qui crée une session Stripe « setup » neuve à chaque clic (aucun montant prélevé) ; le
 *  webhook (`checkoutType: "plan-card"`) range la carte sur le plan, puis le cron charge-installments prélève à la date. */

function db() {
  return getSupabaseAdminClient() as any;
}

export const planCardUrl = (planId: string) => `${env.publicSiteUrl}/api/paiement/carte/${planId}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startPlanCardSession(planId: string): Promise<{ url: string } | { done: true } | { error: string }> {
  if (!UUID.test(planId)) return { error: "Lien invalide." };
  const { data: plan } = await db().from("registration_payment_plans").select("id, stripe_customer_id, stripe_payment_method_id, registration:registrations(parent_name, parent_email, player_first_name, player_last_name)").eq("id", planId).maybeSingle();
  if (!plan) return { error: "Lien invalide." };
  if (plan.stripe_payment_method_id) return { done: true };
  const { count } = await db().from("registration_payment_plan_installments").select("id", { count: "exact", head: true }).eq("plan_id", planId).in("status", ["pending", "failed"]);
  if (!count) return { done: true };
  const stripe = getStripeClient();
  let customer = plan.stripe_customer_id as string | null;
  if (!customer) {
    const r = plan.registration ?? {};
    const c = await stripe.customers.create({ email: r.parent_email ?? undefined, name: r.parent_name ?? undefined, metadata: { planId, player: `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim() } });
    customer = c.id;
    await db().from("registration_payment_plans").update({ stripe_customer_id: customer }).eq("id", planId);
  }
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer,
    currency: "cad",
    payment_method_types: ["card"],
    metadata: { checkoutType: "plan-card", planId },
    setup_intent_data: { metadata: { checkoutType: "plan-card", planId } },
    success_url: `${env.publicSiteUrl}/confirmation?carte=true`,
    cancel_url: `${env.publicSiteUrl}/`
  });
  return session.url ? { url: session.url } : { error: "Stripe n'a pas ouvert la page." };
}

/** Webhook : la carte enregistrée devient celle des versements à venir du plan. */
export async function savePlanCard(session: Stripe.Checkout.Session): Promise<boolean> {
  const planId = session.metadata?.planId;
  const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  if (!planId || !setupIntentId) return false;
  const si = await getStripeClient().setupIntents.retrieve(setupIntentId);
  const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!pm || !customer) return false;
  const { data } = await db().from("registration_payment_plans").update({ stripe_customer_id: customer, stripe_payment_method_id: pm }).eq("id", planId).select("registration_id").maybeSingle();
  await logAudit({ actorRole: "system", actorLabel: "Paiement Stripe", action: "plan_card_saved", entityType: "registration_payment_plan", entityId: planId, entityLabel: data?.registration_id ?? null, before: null, after: { customer } }).catch(() => null);
  return Boolean(data);
}
