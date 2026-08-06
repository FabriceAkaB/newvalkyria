import { getAllLeads } from "@/lib/repositories";
import { getRevenueExpenses, getRevenueGoals, type RevenueExpense } from "@/lib/revenue-repo";
import { getSeasonPaymentPlanSummaries, getSeasonPrograms, getSeasonRegistrations, getSeasons } from "@/lib/season-admin-repo";
import { getOrders } from "@/lib/shop-repo";
import { getStripeClient } from "@/lib/stripe";

export const ETE_SEASON_KEY = "ete-2026";
export const ETE_SEASON_LABEL = "Été 2026";
export const BOUTIQUE_KEY = "boutique";
export const BOUTIQUE_LABEL = "Boutique";
export const GENERAL_KEY = "general";
export const GENERAL_LABEL = "Charges générales";

export interface SeasonRevenue {
  key: string;
  label: string;
  totalCents: number;
  paidCount: number;
  unknownCount: number;
  goalCents: number;
  expenseCents: number;
  netCents: number;
  expenses: RevenueExpense[];
}

export interface RevenueSummary {
  seasons: SeasonRevenue[];
  boutique: SeasonRevenue;
  general: SeasonRevenue;
  grandTotalCents: number;
  grandGoalCents: number;
  grandExpenseCents: number;
  grandNetCents: number;
}

/** Récupère le montant réellement reçu (amount_received) pour une liste de
 *  PaymentIntent Stripe — utilisé UNIQUEMENT pour l'Été, où aucun montant
 *  n'est stocké en base. Échecs individuels ignorés (montant "inconnu"),
 *  plutôt que de faire échouer tout le calcul. */
async function fetchPaymentIntentAmounts(ids: string[]): Promise<Map<string, number>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();

  const stripe = getStripeClient();
  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const pi = await stripe.paymentIntents.retrieve(id);
        return [id, pi.amount_received] as const;
      } catch {
        return [id, null] as const;
      }
    })
  );

  const map = new Map<string, number>();
  for (const [id, amount] of results) {
    if (amount !== null) map.set(id, amount);
  }
  return map;
}

function buildCard(input: {
  key: string;
  label: string;
  totalCents: number;
  paidCount: number;
  unknownCount: number;
  goalCents: number;
  expenses: RevenueExpense[];
}): SeasonRevenue {
  const expenseCents = input.expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  return { ...input, expenseCents, netCents: input.totalCents - expenseCents };
}

export async function computeRevenueSummary(): Promise<RevenueSummary> {
  const [leads, seasons, goals, orders, expenses] = await Promise.all([
    getAllLeads(),
    getSeasons(),
    getRevenueGoals(),
    getOrders(),
    getRevenueExpenses()
  ]);

  const goalCents = (key: string) => goals.find((g) => g.season_key === key)?.goal_cents ?? 0;
  const expensesFor = (key: string) => expenses.filter((e) => e.season_key === key);

  // ── Été 2026 — aucun prix stocké en base, seul le PaymentIntent Stripe
  // donne le montant réel. Les leads marqués "payé" manuellement (sans
  // PaymentIntent) sont comptés à part, montant inconnu. ──
  const paidLeads = leads.filter((l) => l.status === "paid" && !l.is_waitlist);
  const eteAmounts = await fetchPaymentIntentAmounts(
    paidLeads.filter((l) => l.stripe_payment_intent_id).map((l) => l.stripe_payment_intent_id!)
  );
  let eteTotalCents = 0;
  let eteUnknown = 0;
  for (const lead of paidLeads) {
    const amount = lead.stripe_payment_intent_id ? eteAmounts.get(lead.stripe_payment_intent_id) : undefined;
    if (amount !== undefined) eteTotalCents += amount;
    else eteUnknown += 1;
  }

  const seasonRevenues: SeasonRevenue[] = [
    buildCard({
      key: ETE_SEASON_KEY,
      label: ETE_SEASON_LABEL,
      totalCents: eteTotalCents,
      paidCount: paidLeads.length,
      unknownCount: eteUnknown,
      goalCents: goalCents(ETE_SEASON_KEY),
      expenses: expensesFor(ETE_SEASON_KEY)
    })
  ];

  // ── Saisons du système multi-saisons (Automne/Hiver 2026 et futures). Le
  // prix de référence est programs.price_cents ; pour un plan de paiement
  // échelonné, on remplace par la somme des versements réellement encaissés
  // (plus précis, et évite d'aller chercher un montant Stripe qui inclurait
  // aussi les articles boutique liés à la même session Checkout). ──
  // La table `seasons` contient une ligne vestige "ete-2026" créée lors de la
  // migration fondatrice, jamais utilisée (Été n'écrit jamais dans
  // `registrations`) — déjà couverte ci-dessus via les leads, à exclure ici
  // pour éviter une carte fantôme en double.
  for (const season of seasons.filter((s) => s.id !== ETE_SEASON_KEY)) {
    const [registrations, programs, planSummaries] = await Promise.all([
      getSeasonRegistrations(season.id),
      getSeasonPrograms(season.id),
      getSeasonPaymentPlanSummaries(season.id)
    ]);
    const priceByProgram = new Map(programs.map((p) => [p.id, p.price_cents]));
    const planByRegistration = new Map(planSummaries.map((p) => [p.registration_id, p.paid_cents]));

    const paidRegs = registrations.filter((r) => r.status === "paid");
    let totalCents = 0;
    let unknownCount = 0;
    for (const r of paidRegs) {
      if (planByRegistration.has(r.id)) {
        totalCents += planByRegistration.get(r.id)!;
        continue;
      }
      const listPrice = r.program_id ? priceByProgram.get(r.program_id) : undefined;
      if (listPrice !== undefined) totalCents += listPrice;
      else unknownCount += 1;
    }

    seasonRevenues.push(
      buildCard({
        key: season.id,
        label: season.label,
        totalCents,
        paidCount: paidRegs.length,
        unknownCount,
        goalCents: goalCents(season.id),
        expenses: expensesFor(season.id)
      })
    );
  }

  // ── Boutique — commandes payées, qu'elles soient autonomes ou liées à une
  // inscription (sac, 2e uniforme). ──
  const paidOrders = orders.filter((o) => o.status === "paid" || o.status === "fulfilled");
  const boutique = buildCard({
    key: BOUTIQUE_KEY,
    label: BOUTIQUE_LABEL,
    totalCents: paidOrders.reduce((sum, o) => sum + o.total_cents, 0),
    paidCount: paidOrders.length,
    unknownCount: 0,
    goalCents: goalCents(BOUTIQUE_KEY),
    expenses: expensesFor(BOUTIQUE_KEY)
  });

  // ── Charges générales — non rattachées à une saison précise (frais fixes,
  // assurance, matériel, etc.). Aucun revenu associé, seulement des charges. ──
  const general = buildCard({
    key: GENERAL_KEY,
    label: GENERAL_LABEL,
    totalCents: 0,
    paidCount: 0,
    unknownCount: 0,
    goalCents: goalCents(GENERAL_KEY),
    expenses: expensesFor(GENERAL_KEY)
  });

  const allCards = [...seasonRevenues, boutique, general];
  const grandTotalCents = allCards.reduce((sum, r) => sum + r.totalCents, 0);
  const grandGoalCents = allCards.reduce((sum, r) => sum + r.goalCents, 0);
  const grandExpenseCents = allCards.reduce((sum, r) => sum + r.expenseCents, 0);
  const grandNetCents = grandTotalCents - grandExpenseCents;

  return { seasons: seasonRevenues, boutique, general, grandTotalCents, grandGoalCents, grandExpenseCents, grandNetCents };
}
