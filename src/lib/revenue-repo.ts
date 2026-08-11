import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface RevenueGoal {
  season_key: string;
  season_label: string;
  goal_cents: number;
  updated_at: string;
}

export async function getRevenueGoals(): Promise<RevenueGoal[]> {
  const supabase = db();
  const { data, error } = await supabase.from("revenue_goals").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as RevenueGoal[];
}

export async function setRevenueGoal(seasonKey: string, seasonLabel: string, goalCents: number): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("revenue_goals")
    .upsert({ season_key: seasonKey, season_label: seasonLabel, goal_cents: goalCents, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export const EXPENSE_CATEGORIES = [
  "Location / Terrain",
  "Équipement",
  "Salaires / Contractants",
  "Marketing / Pub",
  "Assurance",
  "Frais Stripe / Bancaires",
  "Autre"
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_ACCOUNTS = ["Compte bancaire", "Carte de crédit", "Comptant"] as const;
export type PaymentAccount = (typeof PAYMENT_ACCOUNTS)[number];

export type ExpenseStatus = "paid" | "due";

export interface RevenueExpense {
  id: string;
  season_key: string;
  category: string;
  label: string;
  amount_cents: number;
  expense_date: string;
  is_recurring: boolean;
  recurrence_end_date: string | null;
  tax_rate: number;
  paid_with: string;
  status: ExpenseStatus;
  due_date: string | null;
  created_at: string;
}

export async function getRevenueExpenses(): Promise<RevenueExpense[]> {
  const supabase = db();
  const { data, error } = await supabase.from("revenue_expenses").select("*").order("expense_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RevenueExpense[];
}

export async function addRevenueExpense(input: {
  seasonKey: string;
  category: string;
  label: string;
  amountCents: number;
  expenseDate: string;
  isRecurring: boolean;
  recurrenceEndDate: string | null;
  taxRate: number;
  paidWith: string;
  status?: ExpenseStatus;
  dueDate?: string | null;
}): Promise<RevenueExpense> {
  const supabase = db();
  const { data, error } = await supabase
    .from("revenue_expenses")
    .insert({
      season_key: input.seasonKey,
      category: input.category,
      label: input.label,
      amount_cents: input.amountCents,
      expense_date: input.expenseDate,
      is_recurring: input.isRecurring,
      recurrence_end_date: input.recurrenceEndDate,
      tax_rate: input.taxRate,
      paid_with: input.paidWith,
      status: input.status ?? "paid",
      due_date: input.dueDate ?? null
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as RevenueExpense;
}

export async function deleteRevenueExpense(id: string): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("revenue_expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Marque une facture "à payer" comme payée (ou modifie sa date d'échéance) —
 *  ne touche jamais aux montants/catégorie, seulement au statut de paiement. */
export async function updateRevenueExpenseStatus(id: string, patch: { status?: ExpenseStatus; dueDate?: string | null }): Promise<void> {
  const supabase = db();
  const columnPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) columnPatch.status = patch.status;
  if (patch.dueDate !== undefined) columnPatch.due_date = patch.dueDate;
  const { error } = await supabase.from("revenue_expenses").update(columnPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ── Budget annuel par catégorie ──────────────────────────────────── */

export interface RevenueBudget {
  category: string;
  amount_cents: number;
  updated_at: string;
}

export async function getBudgets(): Promise<RevenueBudget[]> {
  const supabase = db();
  const { data, error } = await supabase.from("revenue_budgets").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as RevenueBudget[];
}

export async function setBudget(category: string, amountCents: number): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("revenue_budgets")
    .upsert({ category, amount_cents: amountCents, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export interface RevenueSettings {
  revenue_tax_rate: number;
}

export async function getRevenueSettings(): Promise<RevenueSettings> {
  const supabase = db();
  const { data, error } = await supabase.from("revenue_settings").select("revenue_tax_rate").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return { revenue_tax_rate: data?.revenue_tax_rate ?? 0 };
}

export async function setRevenueTaxRate(rate: number): Promise<void> {
  const supabase = db();
  const { error } = await supabase.from("revenue_settings").update({ revenue_tax_rate: rate }).eq("id", true);
  if (error) throw new Error(error.message);
}

export interface MonthlyGoal {
  month: string;
  goal_cents: number;
}

export async function getMonthlyGoals(): Promise<MonthlyGoal[]> {
  const supabase = db();
  const { data, error } = await supabase.from("revenue_monthly_goals").select("month, goal_cents");
  if (error) throw new Error(error.message);
  return (data ?? []) as MonthlyGoal[];
}

export async function setMonthlyGoal(month: string, goalCents: number): Promise<void> {
  const supabase = db();
  const { error } = await supabase
    .from("revenue_monthly_goals")
    .upsert({ month, goal_cents: goalCents, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
