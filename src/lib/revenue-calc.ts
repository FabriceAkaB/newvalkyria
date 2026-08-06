import { getAllLeads } from "@/lib/repositories";
import { getRevenueExpenses, getRevenueGoals, type RevenueExpense } from "@/lib/revenue-repo";
import { getSeasonPaidInstallments, getSeasonPrograms, getSeasonRegistrations, getSeasons } from "@/lib/season-admin-repo";
import { getOrders } from "@/lib/shop-repo";
import { getStripeClient } from "@/lib/stripe";

export const ETE_SEASON_KEY = "ete-2026";
export const ETE_SEASON_LABEL = "Été 2026";
export const BOUTIQUE_KEY = "boutique";
export const BOUTIQUE_LABEL = "Boutique";
export const GENERAL_KEY = "general";
export const GENERAL_LABEL = "Charges générales";

interface RevenueEvent {
  date: string; // YYYY-MM-DD
  amountCents: number;
  seasonKey: string;
  description: string;
}

interface ExpenseEvent {
  expenseId: string;
  date: string;
  amountCents: number;
  seasonKey: string;
  category: string;
  label: string;
}

export interface CategoryBreakdown {
  category: string;
  amountCents: number;
}

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
  expensesByCategory: CategoryBreakdown[];
}

export interface MonthlyBucket {
  month: string; // "2026-08"
  revenueCents: number;
  expenseCents: number;
  netCents: number;
}

export interface RevenueSummary {
  seasons: SeasonRevenue[];
  boutique: SeasonRevenue;
  general: SeasonRevenue;
  months: MonthlyBucket[];
  grandTotalCents: number;
  grandGoalCents: number;
  grandExpenseCents: number;
  grandNetCents: number;
}

export interface ExportRow {
  date: string;
  type: "Revenu" | "Charge";
  season: string;
  category: string;
  description: string;
  amountCents: number;
}

function childNameFromGoal(goal: string): string {
  const match = goal.match(/Joueuse:\s*([^·]+)/);
  return match?.[1]?.trim() || "";
}

/** Montant réellement reçu (amount_received) et date de création pour une
 *  liste de PaymentIntent Stripe — utilisé UNIQUEMENT pour l'Été, où aucun
 *  montant n'est stocké en base. Échecs individuels ignorés (montant
 *  "inconnu"), plutôt que de faire échouer tout le calcul. */
async function fetchPaymentIntents(ids: string[]): Promise<Map<string, { amount: number; createdAt: string }>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();

  const stripe = getStripeClient();
  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const pi = await stripe.paymentIntents.retrieve(id);
        return [id, { amount: pi.amount_received, createdAt: new Date(pi.created * 1000).toISOString().slice(0, 10) }] as const;
      } catch {
        return [id, null] as const;
      }
    })
  );

  const map = new Map<string, { amount: number; createdAt: string }>();
  for (const [id, value] of results) {
    if (value) map.set(id, value);
  }
  return map;
}

/** Étale une charge récurrente en une occurrence par mois, de sa date de
 *  départ jusqu'au mois courant (ou jusqu'à sa date de fin si définie). Une
 *  charge non récurrente ne produit qu'une seule occurrence. */
function expandExpense(expense: RevenueExpense, today: Date): ExpenseEvent[] {
  if (!expense.is_recurring) {
    return [{
      expenseId: expense.id,
      date: expense.expense_date,
      amountCents: expense.amount_cents,
      seasonKey: expense.season_key,
      category: expense.category,
      label: expense.label
    }];
  }

  const start = new Date(expense.expense_date + "T00:00:00");
  const end = expense.recurrence_end_date ? new Date(expense.recurrence_end_date + "T00:00:00") : today;
  const events: ExpenseEvent[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    events.push({
      expenseId: expense.id,
      date: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
      amountCents: expense.amount_cents,
      seasonKey: expense.season_key,
      category: expense.category,
      label: `${expense.label} (récurrente)`
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return events;
}

function categoryBreakdown(events: ExpenseEvent[]): CategoryBreakdown[] {
  const map = new Map<string, number>();
  for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents);
  return Array.from(map.entries())
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

async function computeRevenueData(): Promise<{ summary: RevenueSummary; revenueEvents: RevenueEvent[]; expenseEvents: ExpenseEvent[] }> {
  const [leads, seasons, goals, orders, expenseRows] = await Promise.all([
    getAllLeads(),
    getSeasons(),
    getRevenueGoals(),
    getOrders(),
    getRevenueExpenses()
  ]);

  const goalCents = (key: string) => goals.find((g) => g.season_key === key)?.goal_cents ?? 0;

  const revenueEvents: RevenueEvent[] = [];
  const paidCountBySeasonKey = new Map<string, number>();
  const unknownBySeasonKey = new Map<string, number>();

  // ── Été 2026 — aucun prix stocké en base, seul le PaymentIntent Stripe
  // donne le montant et la date réels. Les leads marqués "payé" manuellement
  // (sans PaymentIntent) sont comptés à part, montant inconnu. ──
  const paidLeads = leads.filter((l) => l.status === "paid" && !l.is_waitlist);
  const eteIntents = await fetchPaymentIntents(
    paidLeads.filter((l) => l.stripe_payment_intent_id).map((l) => l.stripe_payment_intent_id!)
  );
  paidCountBySeasonKey.set(ETE_SEASON_KEY, paidLeads.length);
  let eteUnknown = 0;
  for (const lead of paidLeads) {
    const info = lead.stripe_payment_intent_id ? eteIntents.get(lead.stripe_payment_intent_id) : undefined;
    if (info) {
      const childName = childNameFromGoal(lead.goal);
      revenueEvents.push({
        date: info.createdAt,
        amountCents: info.amount,
        seasonKey: ETE_SEASON_KEY,
        description: `Été 2026 — ${lead.parent_name}${childName ? ` (${childName})` : ""}`
      });
    } else {
      eteUnknown += 1;
    }
  }
  unknownBySeasonKey.set(ETE_SEASON_KEY, eteUnknown);

  // ── Saisons du système multi-saisons (Automne/Hiver 2026 et futures). Le
  // prix de référence est programs.price_cents ; pour un plan de paiement
  // échelonné, on utilise chaque versement réellement encaissé (montant ET
  // date exacts) plutôt que le prix de vente théorique du plan — plus
  // précis, et évite d'aller chercher un montant Stripe qui inclurait aussi
  // les articles boutique liés à la même session Checkout. ──
  // La table `seasons` contient une ligne vestige "ete-2026" créée lors de la
  // migration fondatrice, jamais utilisée (Été n'écrit jamais dans
  // `registrations`) — déjà couverte ci-dessus via les leads, à exclure ici.
  for (const season of seasons.filter((s) => s.id !== ETE_SEASON_KEY)) {
    const [registrations, programs, paidInstallments] = await Promise.all([
      getSeasonRegistrations(season.id),
      getSeasonPrograms(season.id),
      getSeasonPaidInstallments(season.id)
    ]);
    const priceByProgram = new Map(programs.map((p) => [p.id, p.price_cents] as const));
    const nameByProgram = new Map(programs.map((p) => [p.id, p.name] as const));
    const registrationById = new Map(registrations.map((r) => [r.id, r] as const));
    const hasPlanRegistrationIds = new Set(paidInstallments.map((i) => i.registration_id));

    for (const inst of paidInstallments) {
      const r = registrationById.get(inst.registration_id);
      const programName = r?.program_id ? (nameByProgram.get(r.program_id) ?? r.program_id) : "Programme";
      revenueEvents.push({
        date: inst.paid_at.slice(0, 10),
        amountCents: inst.amount_cents,
        seasonKey: season.id,
        description: `${season.label} — ${programName} — ${r?.parent_name ?? "?"} (versement)`
      });
    }

    const paidRegs = registrations.filter((r) => r.status === "paid");
    paidCountBySeasonKey.set(season.id, paidRegs.length);
    let unknown = 0;
    for (const r of paidRegs) {
      if (hasPlanRegistrationIds.has(r.id)) continue; // déjà compté ci-dessus via les versements
      const listPrice = r.program_id ? priceByProgram.get(r.program_id) : undefined;
      if (listPrice !== undefined) {
        const programName = r.program_id ? (nameByProgram.get(r.program_id) ?? r.program_id) : "Programme";
        revenueEvents.push({
          date: r.created_at.slice(0, 10),
          amountCents: listPrice,
          seasonKey: season.id,
          description: `${season.label} — ${programName} — ${r.parent_name}`
        });
      } else {
        unknown += 1;
      }
    }
    unknownBySeasonKey.set(season.id, unknown);
  }

  // ── Boutique — commandes payées, qu'elles soient autonomes ou liées à une
  // inscription (sac, 2e uniforme). ──
  const paidOrders = orders.filter((o) => o.status === "paid" || o.status === "fulfilled");
  paidCountBySeasonKey.set(BOUTIQUE_KEY, paidOrders.length);
  for (const o of paidOrders) {
    revenueEvents.push({
      date: o.created_at.slice(0, 10),
      amountCents: o.total_cents,
      seasonKey: BOUTIQUE_KEY,
      description: `Boutique — ${o.customer_name}`
    });
  }

  const today = new Date();
  const expenseEvents = expenseRows.flatMap((e) => expandExpense(e, today));

  const buildCard = (key: string, label: string): SeasonRevenue => {
    const revEvents = revenueEvents.filter((e) => e.seasonKey === key);
    const expEvents = expenseEvents.filter((e) => e.seasonKey === key);
    const totalCents = revEvents.reduce((sum, e) => sum + e.amountCents, 0);
    const expenseCents = expEvents.reduce((sum, e) => sum + e.amountCents, 0);
    return {
      key,
      label,
      totalCents,
      paidCount: paidCountBySeasonKey.get(key) ?? 0,
      unknownCount: unknownBySeasonKey.get(key) ?? 0,
      goalCents: goalCents(key),
      expenseCents,
      netCents: totalCents - expenseCents,
      expenses: expenseRows.filter((e) => e.season_key === key),
      expensesByCategory: categoryBreakdown(expEvents)
    };
  };

  const seasonCards = [
    buildCard(ETE_SEASON_KEY, ETE_SEASON_LABEL),
    ...seasons.filter((s) => s.id !== ETE_SEASON_KEY).map((s) => buildCard(s.id, s.label))
  ];
  const boutique = buildCard(BOUTIQUE_KEY, BOUTIQUE_LABEL);
  const general = buildCard(GENERAL_KEY, GENERAL_LABEL);

  const monthMap = new Map<string, { revenueCents: number; expenseCents: number }>();
  for (const e of revenueEvents) {
    const month = e.date.slice(0, 7);
    const bucket = monthMap.get(month) ?? { revenueCents: 0, expenseCents: 0 };
    bucket.revenueCents += e.amountCents;
    monthMap.set(month, bucket);
  }
  for (const e of expenseEvents) {
    const month = e.date.slice(0, 7);
    const bucket = monthMap.get(month) ?? { revenueCents: 0, expenseCents: 0 };
    bucket.expenseCents += e.amountCents;
    monthMap.set(month, bucket);
  }
  const months: MonthlyBucket[] = Array.from(monthMap.entries())
    .map(([month, b]) => ({ month, revenueCents: b.revenueCents, expenseCents: b.expenseCents, netCents: b.revenueCents - b.expenseCents }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const allCards = [...seasonCards, boutique, general];
  const grandTotalCents = allCards.reduce((sum, c) => sum + c.totalCents, 0);
  const grandGoalCents = allCards.reduce((sum, c) => sum + c.goalCents, 0);
  const grandExpenseCents = allCards.reduce((sum, c) => sum + c.expenseCents, 0);
  const grandNetCents = grandTotalCents - grandExpenseCents;

  return {
    summary: { seasons: seasonCards, boutique, general, months, grandTotalCents, grandGoalCents, grandExpenseCents, grandNetCents },
    revenueEvents,
    expenseEvents
  };
}

export async function computeRevenueSummary(): Promise<RevenueSummary> {
  const { summary } = await computeRevenueData();
  return summary;
}

/** Lignes brutes (revenus + charges, y compris les occurrences mensuelles
 *  des charges récurrentes) triées par date — pour l'export CSV comptable. */
export async function getRevenueExportRows(): Promise<ExportRow[]> {
  const { revenueEvents, expenseEvents } = await computeRevenueData();

  const rows: ExportRow[] = [
    ...revenueEvents.map((e) => ({ date: e.date, type: "Revenu" as const, season: e.seasonKey, category: "", description: e.description, amountCents: e.amountCents })),
    ...expenseEvents.map((e) => ({ date: e.date, type: "Charge" as const, season: e.seasonKey, category: e.category, description: e.label, amountCents: e.amountCents }))
  ];

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
