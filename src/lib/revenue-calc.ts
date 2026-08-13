import { startOfWeek } from "@/lib/coach-payroll";
import { getPayrollRows, type PayrollRow } from "@/lib/coach-payroll-data";
import { getAllLeads } from "@/lib/repositories";
import {
  EXPENSE_CATEGORIES,
  getBudgets,
  getMonthlyGoals,
  getRevenueExpenses,
  getRevenueGoals,
  getRevenueSettings,
  PAYMENT_ACCOUNTS,
  type ExpenseStatus,
  type RevenueExpense
} from "@/lib/revenue-repo";
import {
  getAllPaymentPlansOverview,
  getSeasonPaidInstallments,
  getSeasonPrograms,
  getSeasonRegistrations,
  getSeasons,
  type Season
} from "@/lib/season-admin-repo";
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
  status: ExpenseStatus;
  dueDate: string | null;
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
      paidWith: expense.paid_with,
      status: expense.status,
      dueDate: expense.due_date
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
      paidWith: expense.paid_with,
      status: expense.status,
      dueDate: expense.due_date
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

async function computeRevenueData(): Promise<{
  summary: RevenueSummary;
  revenueEvents: RevenueEvent[];
  expenseEvents: ExpenseEvent[];
  payrollRows: PayrollRow[];
  seasons: Season[];
}> {
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
      paidWith: "Compte bancaire",
      status: "paid",
      dueDate: null
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
  // sont réparties selon le compte choisi par l'admin à la saisie. Seules
  // les charges "payées" sortent réellement de l'encaisse — une facture "à
  // payer" est un engagement, pas encore un mouvement d'argent (voir
  // billsDueCents dans le tableau de bord financier). ──
  const accounts: AccountBalance[] = PAYMENT_ACCOUNTS.map((account) => {
    const revenueCents = account === REVENUE_ACCOUNT ? revenueEvents.reduce((sum, e) => sum + e.amountCents, 0) : 0;
    const expenseCents = expenseEvents.filter((e) => e.paidWith === account && e.status === "paid").reduce((sum, e) => sum + e.amountCents, 0);
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
    expenseEvents,
    payrollRows,
    seasons
  };
}

export async function computeRevenueSummary(): Promise<RevenueSummary> {
  const { summary } = await computeRevenueData();
  return summary;
}

/* ── Tableau de bord financier temps réel ─────────────────────────── */

export interface FinancialAlert {
  level: "warning" | "critical";
  message: string;
}

export type FinancialHealth = "excellente" | "a-surveiller" | "critique";

export interface CashFlowProjection {
  horizonDays: number;
  incomingCents: number;
  outgoingCents: number;
  projectedBalanceCents: number;
}

export interface FinancialDashboard {
  cashAvailableCents: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  revenueSeasonCents: number;
  expenseTodayCents: number;
  expenseMonthCents: number;
  expenseSeasonCents: number;
  netProfitMonthCents: number;
  netProfitSeasonCents: number;
  payrollDueCents: number;
  billsDueCents: number;
  parentPaymentsDueCents: number;
  projectedRemainingCents: number;
  activeSeasonLabel: string | null;
  health: FinancialHealth;
  alerts: FinancialAlert[];
  cashFlow: CashFlowProjection[];
}

/** Seuil sous lequel l'encaisse est jugée "faible" par rapport aux
 *  obligations connues (masse salariale due + factures en attente) — un
 *  ratio plutôt qu'un montant fixe, pour rester pertinent peu importe la
 *  taille de l'académie. */
const LOW_CASH_RATIO = 1.2;

export async function computeFinancialDashboard(): Promise<FinancialDashboard> {
  const { summary, revenueEvents, expenseEvents, payrollRows, seasons } = await computeRevenueData();
  const plans = await getAllPaymentPlansOverview();

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const monthKey = todayISO.slice(0, 7);
  const weekStartISO = startOfWeek(now).toISOString().slice(0, 10);

  const sumWhere = (events: { date: string; amountCents: number; status?: ExpenseStatus }[], pred: (date: string) => boolean, onlyPaid = false) =>
    events.filter((e) => pred(e.date) && (!onlyPaid || e.status !== "due")).reduce((sum, e) => sum + e.amountCents, 0);

  // La ligne "ete-2026" dans `seasons` est un vestige de la migration
  // fondatrice, jamais utilisé pour les vraies saisons (Été n'écrit jamais
  // dans `registrations`, voir plus haut) — à exclure ici comme ailleurs
  // dans ce fichier, sans quoi son `is_active` (jamais mis à jour) fausse
  // la détection de la saison en cours.
  const realSeasons = seasons.filter((s) => s.id !== ETE_SEASON_KEY);
  const activeSeason = realSeasons.find((s) => s.is_active) ?? realSeasons[0] ?? null;
  const activeSeasonCard = activeSeason ? summary.seasons.find((c) => c.key === activeSeason.id) : undefined;

  const cashAvailableCents = summary.accounts.reduce((sum, a) => sum + a.balanceCents, 0);

  const revenueTodayCents = sumWhere(revenueEvents, (d) => d === todayISO);
  const revenueWeekCents = sumWhere(revenueEvents, (d) => d >= weekStartISO);
  const revenueMonthCents = sumWhere(revenueEvents, (d) => d.slice(0, 7) === monthKey);
  const revenueSeasonCents = activeSeasonCard?.totalCents ?? 0;

  const expenseTodayCents = sumWhere(expenseEvents, (d) => d === todayISO, true);
  const expenseMonthCents = sumWhere(expenseEvents, (d) => d.slice(0, 7) === monthKey, true);
  const expenseSeasonCents = activeSeasonCard?.expenseCents ?? 0;

  const payrollDueCents = payrollRows.filter((r) => !r.paid).reduce((sum, r) => sum + r.payCents, 0);
  const billsDueCents = expenseEvents.filter((e) => e.status === "due").reduce((sum, e) => sum + e.amountCents, 0);
  const parentPaymentsDueCents = plans.reduce((sum, p) => {
    return sum + p.installments.filter((i) => i.status === "pending" || i.status === "failed").reduce((s, i) => s + i.amountCents, 0);
  }, 0);

  const projectedRemainingCents = cashAvailableCents - payrollDueCents - billsDueCents;

  // ── Trésorerie prévisionnelle : encaisse actuelle + versements de parents
  // attendus dans la fenêtre - factures/salaires dus dans la fenêtre. Les
  // salaires n'ont pas de date d'échéance propre (payés sur confirmation
  // manuelle), donc on les compte entièrement dans les 3 horizons — c'est
  // une obligation déjà due, pas une prévision. ──
  const cashFlow: CashFlowProjection[] = [7, 30, 90].map((horizonDays) => {
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + horizonDays);
    const horizonISO = horizon.toISOString().slice(0, 10);

    const incomingCents = plans.reduce((sum, p) => {
      return sum + p.installments
        .filter((i) => (i.status === "pending" || i.status === "failed") && i.dueDate <= horizonISO)
        .reduce((s, i) => s + i.amountCents, 0);
    }, 0);

    const billsInWindowCents = expenseEvents
      .filter((e) => e.status === "due" && (!e.dueDate || e.dueDate <= horizonISO))
      .reduce((sum, e) => sum + e.amountCents, 0);

    const outgoingCents = billsInWindowCents + payrollDueCents;
    return { horizonDays, incomingCents, outgoingCents, projectedBalanceCents: cashAvailableCents + incomingCents - outgoingCents };
  });

  // ── Alertes ─────────────────────────────────────────────────────────
  const alerts: FinancialAlert[] = [];
  const overdueInstallments = plans.flatMap((p) => p.installments.filter((i) => i.status === "failed" || i.status === "failed_final"));
  if (overdueInstallments.length > 0) {
    alerts.push({ level: "critical", message: `${overdueInstallments.length} versement(s) de parent(s) en échec de prélèvement.` });
  }
  if (payrollDueCents > 0) {
    alerts.push({ level: "warning", message: `${formatCentsFr(payrollDueCents)} de salaires d'entraîneurs non payés.` });
  }
  const overdueBills = expenseEvents.filter((e) => e.status === "due" && e.dueDate && e.dueDate < todayISO);
  if (overdueBills.length > 0) {
    alerts.push({ level: "critical", message: `${overdueBills.length} facture(s) en retard de paiement.` });
  }
  const budgets = await getBudgetVsActual();
  const overBudget = budgets.filter((b) => b.budgetCents > 0 && b.actualCents > b.budgetCents);
  if (overBudget.length > 0) {
    alerts.push({ level: "warning", message: `Budget dépassé pour ${overBudget.length} catégorie(s) : ${overBudget.map((b) => b.category).join(", ")}.` });
  }
  if (cashAvailableCents < (payrollDueCents + billsDueCents) * LOW_CASH_RATIO && payrollDueCents + billsDueCents > 0) {
    alerts.push({ level: "warning", message: "Solde bancaire faible par rapport aux obligations connues (salaires + factures)." });
  }

  const health: FinancialHealth = alerts.some((a) => a.level === "critical")
    ? "critique"
    : alerts.length > 0
      ? "a-surveiller"
      : "excellente";

  return {
    cashAvailableCents,
    revenueTodayCents,
    revenueWeekCents,
    revenueMonthCents,
    revenueSeasonCents,
    expenseTodayCents,
    expenseMonthCents,
    expenseSeasonCents,
    netProfitMonthCents: revenueMonthCents - expenseMonthCents,
    netProfitSeasonCents: revenueSeasonCents - expenseSeasonCents,
    payrollDueCents,
    billsDueCents,
    parentPaymentsDueCents,
    projectedRemainingCents,
    activeSeasonLabel: activeSeason?.label ?? null,
    health,
    alerts,
    cashFlow
  };
}

function formatCentsFr(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/* ── Budget annuel vs dépenses réelles ─────────────────────────────── */

export interface BudgetVsActual {
  category: string;
  budgetCents: number;
  actualCents: number;
}

/** Compare le budget annuel par catégorie aux dépenses réelles (payées ET
 *  à payer — un engagement compte comme une dépense réelle en comptabilité,
 *  même si l'argent n'est pas encore sorti). Couvre toutes les charges,
 *  toutes saisons confondues (le budget est annuel, pas par saison). */
export async function getBudgetVsActual(): Promise<BudgetVsActual[]> {
  const [budgets, { expenseEvents }] = await Promise.all([getBudgets(), computeRevenueData()]);

  const actualByCategory = new Map<string, number>();
  for (const e of expenseEvents) actualByCategory.set(e.category, (actualByCategory.get(e.category) ?? 0) + e.amountCents);

  const categories = new Set<string>([...budgets.map((b) => b.category), ...actualByCategory.keys()]);
  return Array.from(categories)
    .map((category) => ({
      category,
      budgetCents: budgets.find((b) => b.category === category)?.amount_cents ?? 0,
      actualCents: actualByCategory.get(category) ?? 0
    }))
    .sort((a, b) => b.actualCents - a.actualCents);
}

export interface CashMovement {
  date: string;
  amountCents: number;
  description: string;
}

export interface UpcomingMovements {
  incoming: CashMovement[];
  outgoing: CashMovement[];
}

/** Détail des mouvements d'argent connus mais pas encore encaissés/payés —
 *  versements de parents en attente et factures à payer — triés par date,
 *  pour la page Trésorerie. */
export async function getUpcomingMovements(): Promise<UpcomingMovements> {
  const [expenseRows, plans] = await Promise.all([getRevenueExpenses(), getAllPaymentPlansOverview()]);

  const outgoing: CashMovement[] = expenseRows
    .filter((e) => e.status === "due")
    .map((e) => ({ date: e.due_date ?? e.expense_date, amountCents: e.amount_cents, description: `${e.label} (${e.category})` }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const incoming: CashMovement[] = plans
    .flatMap((p) =>
      p.installments
        .filter((i) => i.status === "pending" || i.status === "failed")
        .map((i) => ({ date: i.dueDate, amountCents: i.amountCents, description: `${p.parentName} — versement ${i.sequenceNo}/${p.installmentCount}${i.status === "failed" ? " (échec, réessai)" : ""}` }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  return { incoming, outgoing };
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

/* ── Vue annuelle (revenus/dépenses par catégorie × mois) ──────────
 *  Reproduit l'onglet "Annual" du gabarit comptable de référence du
 *  client : une ligne par catégorie, une colonne par mois de l'année
 *  choisie, plus le cash-flow mois par mois avec objectifs et cumul
 *  depuis le début de l'année. */

export interface AnnualCategoryRow {
  category: string;
  monthlyCents: number[];
  totalCents: number;
}

export interface AnnualCashFlowMonth {
  month: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  profitCents: number;
  goalCents: number;
  goalProgressPct: number | null;
  ytdProfitCents: number;
  yearGoalProgressPct: number | null;
}

export interface AnnualBreakdown {
  year: number;
  months: string[];
  monthLabels: string[];
  income: AnnualCategoryRow[];
  incomeTotalByMonth: number[];
  expense: AnnualCategoryRow[];
  expenseTotalByMonth: number[];
  cashFlow: AnnualCashFlowMonth[];
  annualIncomeCents: number;
  annualExpenseCents: number;
  annualProfitCents: number;
  annualGoalCents: number;
}

export async function getAnnualBreakdown(year: number): Promise<AnnualBreakdown> {
  const [{ revenueEvents, expenseEvents, seasons }, monthlyGoals] = await Promise.all([computeRevenueData(), getMonthlyGoals()]);

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const monthLabels = months.map((m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("fr-CA", { month: "short" }));

  const seasonLabelByKey = new Map<string, string>();
  seasonLabelByKey.set(ETE_SEASON_KEY, ETE_SEASON_LABEL);
  for (const s of seasons.filter((s) => s.id !== ETE_SEASON_KEY)) seasonLabelByKey.set(s.id, s.label);
  seasonLabelByKey.set(BOUTIQUE_KEY, BOUTIQUE_LABEL);

  const incomeMap = new Map<string, number[]>();
  for (const label of seasonLabelByKey.values()) incomeMap.set(label, new Array(12).fill(0));
  for (const e of revenueEvents) {
    const label = seasonLabelByKey.get(e.seasonKey);
    const idx = months.indexOf(e.date.slice(0, 7));
    if (!label || idx === -1) continue;
    incomeMap.get(label)![idx] += e.amountCents;
  }
  const income: AnnualCategoryRow[] = Array.from(incomeMap.entries()).map(([category, monthlyCents]) => ({
    category,
    monthlyCents,
    totalCents: monthlyCents.reduce((a, b) => a + b, 0)
  }));
  const incomeTotalByMonth = months.map((_, i) => income.reduce((sum, r) => sum + r.monthlyCents[i], 0));

  const expenseMap = new Map<string, number[]>();
  for (const cat of EXPENSE_CATEGORIES) expenseMap.set(cat, new Array(12).fill(0));
  for (const e of expenseEvents) {
    const idx = months.indexOf(e.date.slice(0, 7));
    if (idx === -1) continue;
    if (!expenseMap.has(e.category)) expenseMap.set(e.category, new Array(12).fill(0));
    expenseMap.get(e.category)![idx] += e.amountCents;
  }
  const expense: AnnualCategoryRow[] = Array.from(expenseMap.entries()).map(([category, monthlyCents]) => ({
    category,
    monthlyCents,
    totalCents: monthlyCents.reduce((a, b) => a + b, 0)
  }));
  const expenseTotalByMonth = months.map((_, i) => expense.reduce((sum, r) => sum + r.monthlyCents[i], 0));

  let ytdProfit = 0;
  let ytdGoal = 0;
  const cashFlow: AnnualCashFlowMonth[] = months.map((m, i) => {
    const incomeCents = incomeTotalByMonth[i];
    const expenseCents = expenseTotalByMonth[i];
    const profitCents = incomeCents - expenseCents;
    const goalCents = monthlyGoals.find((g) => g.month === m)?.goal_cents ?? 0;
    ytdProfit += profitCents;
    ytdGoal += goalCents;
    return {
      month: m,
      label: monthLabels[i],
      incomeCents,
      expenseCents,
      profitCents,
      goalCents,
      goalProgressPct: goalCents > 0 ? Math.round((profitCents / goalCents) * 100) : null,
      ytdProfitCents: ytdProfit,
      yearGoalProgressPct: ytdGoal > 0 ? Math.round((ytdProfit / ytdGoal) * 100) : null
    };
  });

  const annualIncomeCents = incomeTotalByMonth.reduce((a, b) => a + b, 0);
  const annualExpenseCents = expenseTotalByMonth.reduce((a, b) => a + b, 0);
  const annualGoalCents = cashFlow.reduce((sum, c) => sum + c.goalCents, 0);

  return {
    year,
    months,
    monthLabels,
    income,
    incomeTotalByMonth,
    expense,
    expenseTotalByMonth,
    cashFlow,
    annualIncomeCents,
    annualExpenseCents,
    annualProfitCents: annualIncomeCents - annualExpenseCents,
    annualGoalCents
  };
}
