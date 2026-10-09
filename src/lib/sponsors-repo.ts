import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const SPONSOR_CATEGORIES = [
  { value: "equipement", label: "Partenaire équipement" },
  { value: "developpement", label: "Partenaire développement" },
  { value: "evenement", label: "Partenaire événement" },
  { value: "principal", label: "Partenaire principal" }
] as const;

export const SPONSOR_STATUSES = [
  { value: "prospect", label: "Prospect" },
  { value: "contacte", label: "Contacté" },
  { value: "negociation", label: "En négociation" },
  { value: "confirme", label: "Confirmé" },
  { value: "paye", label: "Payé" },
  { value: "refuse", label: "Refusé" },
  { value: "termine", label: "Terminé" }
] as const;

export interface Sponsor {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  category: string;
  partnership_type: string | null;
  proposed_amount_cents: number;
  status: string;
  last_contact_at: string | null;
  last_contact_note: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorPayment {
  id: string;
  sponsor_id: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  method: string | null;
  note: string | null;
  created_at: string;
}

export async function getSponsors(): Promise<Sponsor[]> {
  const { data, error } = await db().from("sponsors").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Sponsor[];
}

export async function getSponsorPayments(): Promise<SponsorPayment[]> {
  const { data, error } = await db().from("sponsor_payments").select("*").order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SponsorPayment[];
}

export type SponsorInput = Partial<{
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  category: string;
  partnershipType: string | null;
  proposedAmountCents: number;
  status: string;
  lastContactAt: string | null;
  lastContactNote: string | null;
  followUpDate: string | null;
  notes: string | null;
}>;

function toColumns(input: SponsorInput): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  if (input.companyName !== undefined) c.company_name = input.companyName;
  if (input.contactName !== undefined) c.contact_name = input.contactName || null;
  if (input.contactEmail !== undefined) c.contact_email = input.contactEmail || null;
  if (input.contactPhone !== undefined) c.contact_phone = input.contactPhone || null;
  if (input.category !== undefined && SPONSOR_CATEGORIES.some((x) => x.value === input.category)) c.category = input.category;
  if (input.partnershipType !== undefined) c.partnership_type = input.partnershipType || null;
  if (input.proposedAmountCents !== undefined) c.proposed_amount_cents = Math.max(0, Math.round(input.proposedAmountCents));
  if (input.status !== undefined && SPONSOR_STATUSES.some((x) => x.value === input.status)) c.status = input.status;
  if (input.lastContactAt !== undefined) c.last_contact_at = input.lastContactAt || null;
  if (input.lastContactNote !== undefined) c.last_contact_note = input.lastContactNote || null;
  if (input.followUpDate !== undefined) c.follow_up_date = input.followUpDate || null;
  if (input.notes !== undefined) c.notes = input.notes || null;
  return c;
}

export async function createSponsor(input: SponsorInput): Promise<string> {
  if (!input.companyName?.trim()) throw new Error("Le nom de l'entreprise est requis.");
  const { data, error } = await db().from("sponsors").insert(toColumns(input)).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateSponsor(id: string, input: SponsorInput): Promise<void> {
  const { error } = await db().from("sponsors").update({ ...toColumns(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await db().from("sponsors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addSponsorPayment(input: { sponsorId: string; amountCents: number; dueDate?: string | null; paidAt?: string | null; method?: string | null; note?: string | null }): Promise<void> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Montant invalide.");
  const { error } = await db().from("sponsor_payments").insert({
    sponsor_id: input.sponsorId,
    amount_cents: input.amountCents,
    due_date: input.dueDate || null,
    paid_at: input.paidAt || null,
    method: input.method || null,
    note: input.note || null
  });
  if (error) throw new Error(error.message);
}

export async function updateSponsorPayment(id: string, patch: { paidAt?: string | null; dueDate?: string | null }): Promise<void> {
  const columns: Record<string, unknown> = {};
  if (patch.paidAt !== undefined) columns.paid_at = patch.paidAt || null;
  if (patch.dueDate !== undefined) columns.due_date = patch.dueDate || null;
  const { error } = await db().from("sponsor_payments").update(columns).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSponsorPayment(id: string): Promise<void> {
  const { error } = await db().from("sponsor_payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
