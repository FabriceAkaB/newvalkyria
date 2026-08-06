import { getPayrollRows } from "@/lib/coach-payroll-data";
import { getAllLeads } from "@/lib/repositories";
import {
  getMonthlyGoals,
  getRevenueExpenses,
  getRevenueGoals,
  getRevenueSettings,
  PAYMENT_ACCOUNTS,
  type RevenueExpense
} from "@/lib/revenue-repo";
import { getSeasonPaidInstallments, getSeasonPrograms, getSeasonRegistrations, getSeasons } from "@/lib/season-admin-repo";
import { getOrders } from "@/lib/shop-repo";

export const ETE_SEASON_KEY = "ete-2026";
export const ETE_SEASON_LABEL = "Été 2026";
/** Prix réel payé par toutes les inscriptions Été 2026 — aucun montant n'est
 *  stocké en base pour ce système (voir plus bas), donc on utilise ce prix
 *  fixe confirmé par le client plutôt que d'aller chercher un montant
 *  Stripe (peu fiable : indisponible pour les paiements marqués payés
 *  manuellement, et inutilisable en local avec une clé de test). */
export const ETE_FIXED_PRICE_CENTS = 55000;
export const BOUTIQUE_KEY = "boutique";
export const BOUTIQUE_LABEL = "Boutique";
export const GENERAL_KEY = "general";
export const GENERAL_LABEL = "Charges générales";
/** Toute la trésorerie de l'académie transite par Stripe vers le compte
 *  bancaire — les revenus sont donc toujours attribués à ce compte. Les
 *  charges, elles, sont payées avec le compte choisi par l'admin. */
const REVENUE_ACCOUNT = "Compte bancaire";

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
  taxRate: number;
  paidWith: string;
}

export interface CategoryBreakdown {
  category: string;
  amountCents: number;
}

export interface SeasonRevenue {
  key: string;
  label: string;
  totalCents: number;
  netCents: number;
  taxCents: number;
  paidCount: number;
  unknownCount: number;
  goalCents: number;
  expenseCents: number;
  profitCents: number;
  expenses: RevenueExpense[];
  expensesByCategory: CategoryBreakdown[];
}

export interface MonthlyBucket {
  month: string; // "2026-08"
  revenueCents: number;
  expenseCents: number;
  netCents: number;
  goalCents: number;
}

export interface AccountBalance {
  account: string;
  revenueCents: number;
  expenseCents: number;
  balanceCents: number;
}

export interface RevenueSummary {
  seasons: SeasonRevenue[];
  boutique: SeasonRevenue;
  general: SeasonRevenue;
  months: MonthlyBucket[];
  accounts: AccountBalance[];
  revenueTaxRate: number;
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
  taxRate: number;
  netAmountCents: number;
  taxAmountCents: number;
  paidWith: string;
}

function childNameFromGoal(goal: string): string {
  const match = goal.match(/Joueuse:\s*([^·]+)/);
  return match?.[1]?.trim() || "";
}

/** Le montant saisi/encaissé est le TOTAL taxes incluses (comme sur une
 *  facture Stripe) ; on en déduit le montant net et la taxe, exactement
 *  comme "NET AMOUNT" = TOTAL / (1 + TAX %) dans le gabarit comptable de
 *  référence. */
function splitTax(totalCents: number, taxRate: number): { netCents: number; taxCents: number } {
  if (taxRate <= 0) return { netCents: totalCents, taxCents: 0 };
  const netCents = Math.round(totalCents / (1 + taxRate));
  return { netCents, taxCents: totalCents - netCents };
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
      label: expense.label,
      taxRate: expense.tax_rate,
      paidWith: expense.paid_with
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
      label: `${expense.label} (récurrente)`,
      taxRate: expense.tax_rate,
      paidWith: expense.paid_with
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
  const [leads, seasons, goals, orders, expenseRows, settings, monthlyGoals, payrollRows] = await Promise.all([
    getAllLeads(),
    getSeasons(),
    getRevenueGoals(),
    getOrders(),
    getRevenueExpenses(),
    getRevenueSettings(),
    getMonthlyGoals(),
    getPayrollRows()
  ]);

  const goalCents = (key: string) => goals.find((g) => g.season_key === key)?.goal_cents ?? 0;
  const monthlyGoalCents = (month: string) => monthlyGoals.find((g) => g.month === month)?.goal_cents ?? 0;
  const revenueTaxRate = settings.revenue_tax_rate;

  const revenueEvents: RevenueEvent[] = [];
  const paidCountBySeasonKey = new Map<string, number>();
  const unknownBySeasonKey = new Map<string, number>();

  // ── Été 2026 — aucun prix stocké en base ; toutes les inscriptions payées
  // sont au même prix fixe (550 $, confirmé par le client). La date de
  // création du lead sert de date de paiement (approximation raisonnable :
  // le paiement Stripe suit la création du lead de quelques minutes). ──
  const paidLeads = leads.filter((l) => l.status === "paid" && !l.is_waitlist);
  paidCountBySeasonKey.set(ETE_SEASON_KEY, paidLeads.length);
  unknownBySeasonKey.set(ETE_SEASON_KEY, 0);
  for (const lead of paidLeads) {
    const childName = childNameFromGoal(lead.goal);
    revenueEvents.push({
      date: lead.created_at.slice(0, 10),
      amountCents: ETE_FIXED_PRICE_CENTS,
      seasonKey: ETE_SEASON_KEY,
      description: `Été 2026 — ${lead.parent_name}${childName ? ` (${childName})` : ""}`
    });
  }

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

  // ── Salaires des entraîneurs réellement payés (section "Gestion des
  // entraîneurs") — comptés automatiquement comme charge ici, pour que le
  // profit net de l'académie reflète l'argent qui sort réellement, sans
  // ressaisie manuelle. N'apparaissent pas dans la liste éditable des
  // charges (ce ne sont pas des lignes de revenue_expenses), seulement
  // dans les totaux, la vue par mois, la ventilation par catégorie et
  // l'export. ──
  for (const r of payrollRows) {
    if (!r.paid || r.payCents <= 0) continue;
    expenseEvents.push({
      expenseId: `coach:${r.assignmentId}`,
      date: r.activityDate,
      amountCents: r.payCents,
      seasonKey: GENERAL_KEY,
      category: "Salaires / Contractants",
      label: `${r.coachName} — ${r.activityType}`,
      taxRate: 0,
      paidWith: "Compte bancaire"
    });
  }

  const buildCard = (key: string, label: string): SeasonRevenue => {
    const revEvents = revenueEvents.filter((e) => e.seasonKey === key);
    const expEvents = expenseEvents.filter((e) => e.seasonKey === key);
    const totalCents = revEvents.reduce((sum, e) => sum + e.amountCents, 0);
    const expenseCents = expEvents.reduce((sum, e) => sum + e.amountCents, 0);
    const { netCents, taxCents } = splitTax(totalCents, revenueTaxRate);
    return {
      key,
      label,
      totalCents,
      netCents,
      taxCents,
      paidCount: paidCountBySeasonKey.get(key) ?? 0,
      unknownCount: unknownBySeasonKey.get(key) ?? 0,
      goalCents: goalCents(key),
      expenseCents,
      profitCents: totalCents - expenseCents,
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
    .map(([month, b]) => ({
      month,
      revenueCents: b.revenueCents,
      expenseCents: b.expenseCents,
      netCents: b.revenueCents - b.expenseCents,
      goalCents: monthlyGoalCents(month)
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // ── Comptes — comme la feuille "Balance" du gabarit de référence. Tous
  // les revenus transitent par Stripe vers le compte bancaire ; les charges
  // sont réparties selon le compte choisi par l'admin à la saisie. ──
  const accounts: AccountBalance[] = PAYMENT_ACCOUNTS.map((account) => {
    const revenueCents = account === REVENUE_ACCOUNT ? revenueEvents.reduce((sum, e) => sum + e.amountCents, 0) : 0;
    const expenseCents = expenseEvents.filter((e) => e.paidWith === account).reduce((sum, e) => sum + e.amountCents, 0);
    return { account, revenueCents, expenseCents, balanceCents: revenueCents - expenseCents };
  });

  const allCards = [...seasonCards, boutique, general];
  const grandTotalCents = allCards.reduce((sum, c) => sum + c.totalCents, 0);
  const grandGoalCents = allCards.reduce((sum, c) => sum + c.goalCents, 0);
  const grandExpenseCents = allCards.reduce((sum, c) => sum + c.expenseCents, 0);
  const grandNetCents = grandTotalCents - grandExpenseCents;

  return {
    summary: {
      seasons: seasonCards,
      boutique,
      general,
      months,
      accounts,
      revenueTaxRate,
      grandTotalCents,
      grandGoalCents,
      grandExpenseCents,
      grandNetCents
    },
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
  const { summary, revenueEvents, expenseEvents } = await computeRevenueData();

  const revenueRows: ExportRow[] = revenueEvents.map((e) => {
    const { netCents, taxCents } = splitTax(e.amountCents, summary.revenueTaxRate);
    return {
      date: e.date,
      type: "Revenu" as const,
      season: e.seasonKey,
      category: "",
      description: e.description,
      amountCents: e.amountCents,
      taxRate: summary.revenueTaxRate,
      netAmountCents: netCents,
      taxAmountCents: taxCents,
      paidWith: REVENUE_ACCOUNT
    };
  });

  const expenseRowsOut: ExportRow[] = expenseEvents.map((e) => {
    const { netCents, taxCents } = splitTax(e.amountCents, e.taxRate);
    return {
      date: e.date,
      type: "Charge" as const,
      season: e.seasonKey,
      category: e.category,
      description: e.label,
      amountCents: e.amountCents,
      taxRate: e.taxRate,
      netAmountCents: netCents,
      taxAmountCents: taxCents,
      paidWith: e.paidWith
    };
  });

  return [...revenueRows, ...expenseRowsOut].sort((a, b) => a.date.localeCompare(b.date));
}
