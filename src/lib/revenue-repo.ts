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

export interface RevenueExpense {
  id: string;
  season_key: string;
  label: string;
  amount_cents: number;
  expense_date: string;
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
  label: string;
  amountCents: number;
  expenseDate: string;
}): Promise<RevenueExpense> {
  const supabase = db();
  const { data, error } = await supabase
    .from("revenue_expenses")
    .insert({ season_key: input.seasonKey, label: input.label, amount_cents: input.amountCents, expense_date: input.expenseDate })
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
