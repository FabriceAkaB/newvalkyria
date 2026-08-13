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

/* ── Pièces jointes sur une dépense (facture, reçu, photo) ────────
 *  Bucket privé — jamais d'URL publique, seulement des URLs signées à
 *  courte durée de vie générées à la demande. Plusieurs fichiers possibles
 *  par dépense. */

const EXPENSE_DOCUMENT_BUCKET = "expense-documents";

export interface ExpenseDocument {
  id: string;
  expense_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

export async function addExpenseDocument(expenseId: string, file: File): Promise<ExpenseDocument> {
  const supabase = db();
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${expenseId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(EXPENSE_DOCUMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("revenue_expense_documents")
    .insert({ expense_id: expenseId, file_name: file.name, storage_path: path })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ExpenseDocument;
}

export async function getExpenseDocuments(expenseId: string): Promise<ExpenseDocument[]> {
  const { data, error } = await db().from("revenue_expense_documents").select("*").eq("expense_id", expenseId).order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseDocument[];
}

/** Nombre de pièces jointes par dépense — pour afficher un petit badge
 *  (📎 N) dans les listes sans devoir interroger chaque dépense une à une. */
export async function getExpenseDocumentCounts(): Promise<Record<string, number>> {
  const { data, error } = await db().from("revenue_expense_documents").select("expense_id");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { expense_id: string }[]) counts[row.expense_id] = (counts[row.expense_id] ?? 0) + 1;
  return counts;
}

export async function deleteExpenseDocument(id: string): Promise<void> {
  const supabase = db();
  const { data: doc, error: fetchErr } = await supabase.from("revenue_expense_documents").select("storage_path").eq("id", id).maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (doc) await supabase.storage.from(EXPENSE_DOCUMENT_BUCKET).remove([doc.storage_path]);
  const { error } = await supabase.from("revenue_expense_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** URL signée valide 5 minutes — assez pour un téléchargement immédiat,
 *  jamais stockée ni réutilisable plus tard. */
export async function getExpenseDocumentSignedUrl(id: string): Promise<{ url: string; fileName: string } | null> {
  const supabase = db();
  const { data: doc, error } = await supabase.from("revenue_expense_documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!doc) return null;
  const { data: signed, error: signErr } = await supabase.storage.from(EXPENSE_DOCUMENT_BUCKET).createSignedUrl(doc.storage_path, 300);
  if (signErr) throw new Error(signErr.message);
  return { url: signed.signedUrl as string, fileName: doc.file_name as string };
}
