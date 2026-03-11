import type { AgeCategory } from "@/lib/categories";
import { AGE_CATEGORIES } from "@/lib/categories";
import type { LeadFormPayload } from "@/lib/validations";
import {
  addMockStripeEvent,
  createMockLead,
  hasMockStripeEvent,
  markMockLeadPaid,
  updateMockLeadCheckout
} from "@/lib/mock-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function isSupabaseAvailable() {
  try {
    getSupabaseAdminClient();
    return true;
  } catch {
    return false;
  }
}

export async function saveLead(payload: LeadFormPayload, isWaitlist = false) {
  if (!isSupabaseAvailable()) {
    return { leadId: createMockLead(payload).id, mode: "mock" as const };
  }

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("leads")
    .insert({
      parent_name: payload.parent_name,
      email: payload.email,
      phone: payload.phone,
      player_age: payload.player_age,
      player_level: payload.player_level,
      city: payload.city,
      goal: payload.goal,
      availability: payload.availability,
      consent: payload.consent,
      status: "pending",
      is_waitlist: isWaitlist
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de sauvegarder le lead");
  }

  return { leadId: data.id as string, mode: "supabase" as const };
}

export async function setLeadCheckoutSession(leadId: string, checkoutSessionId: string) {
  if (!isSupabaseAvailable()) {
    updateMockLeadCheckout(leadId, checkoutSessionId);
    return;
  }

  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase
    .from("leads")
    .update({ stripe_checkout_session_id: checkoutSessionId })
    .eq("id", leadId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function hasProcessedStripeEvent(eventId: string) {
  if (!isSupabaseAvailable()) {
    return hasMockStripeEvent(eventId);
  }

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase.from("stripe_events").select("event_id").eq("event_id", eventId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function recordStripeEvent(eventId: string, payload: object) {
  if (!isSupabaseAvailable()) {
    addMockStripeEvent(eventId);
    return;
  }

  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase.from("stripe_events").insert({ event_id: eventId, payload });

  if (error) {
    throw new Error(error.message);
  }
}

export async function countPaidLeads(): Promise<number> {
  if (!isSupabaseAvailable()) return 0;

  const supabase = getSupabaseAdminClient() as any;
  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "paid");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countPaidLeadsByCategory(): Promise<Record<AgeCategory, number>> {
  const zero = Object.fromEntries(AGE_CATEGORIES.map((c) => [c, 0])) as Record<AgeCategory, number>;

  if (!isSupabaseAvailable()) return zero;

  const supabase = getSupabaseAdminClient() as any;
  const result = { ...zero };

  for (const cat of AGE_CATEGORIES) {
    const { count, error } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid")
      .eq("player_age", cat);

    if (!error) result[cat] = count ?? 0;
  }

  return result;
}

export async function markLeadAsPaid(leadId: string, paymentIntentId?: string) {
  if (!isSupabaseAvailable()) {
    const lead = markMockLeadPaid(leadId, paymentIntentId);
    return {
      email: lead?.email,
      parent_name: lead?.parent_name
    };
  }

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("leads")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId ?? null
    })
    .eq("id", leadId)
    .select("email,parent_name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as { email?: string; parent_name?: string };
}

// ── Admin ──────────────────────────────────────────────────────────

export interface AdminLead {
  id: string;
  created_at: string;
  parent_name: string;
  email: string;
  phone: string;
  player_age: string;
  player_level: string;
  city: string;
  goal: string;
  availability: string;
  status: "pending" | "paid" | "cancelled";
  is_waitlist: boolean;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
}

export async function getAllLeads(): Promise<AdminLead[]> {
  if (!isSupabaseAvailable()) return [];

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminLead[];
}

export async function getCapacityConfig(): Promise<Record<string, number>> {
  if (!isSupabaseAvailable()) return {};

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("capacity_config")
    .select("category, max_spots");

  if (error || !data) return {};

  const config: Record<string, number> = {};
  for (const row of data as { category: string; max_spots: number }[]) {
    config[row.category] = row.max_spots;
  }
  return config;
}

export async function setCapacityConfig(category: string, maxSpots: number): Promise<void> {
  if (!isSupabaseAvailable()) return;

  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase
    .from("capacity_config")
    .upsert({ category, max_spots: maxSpots, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
}
