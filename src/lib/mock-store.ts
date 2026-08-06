import { randomUUID } from "node:crypto";

import type { AdminLead } from "@/lib/repositories";
import type { LeadFormPayload } from "@/lib/validations";

type MockLead = LeadFormPayload & {
  id: string;
  created_at: string;
  status: "pending" | "confirmed" | "paid" | "cancelled" | "essai";
  is_waitlist: boolean;
  time_slot?: string;
  trial_date?: string | null;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
};

const SEED_LEADS: AdminLead[] = [
  {
    id: "mock-001",
    created_at: "2026-03-10T10:15:00.000Z",
    parent_name: "Marie Tremblay",
    email: "marie.tremblay@gmail.com",
    phone: "514-555-0101",
    player_age: "2015",
    player_level: "AA",
    city: "Montréal",
    goal: "Joueuse: Emma Tremblay · Poste: Milieu · Club: FC Montréal · Recommandé par: Non spécifié",
    availability: "Lundi et Mercredi",
    status: "paid",
    is_waitlist: false,
    time_slot: "lun-2015",
  },
  {
    id: "mock-002",
    created_at: "2026-03-11T14:42:00.000Z",
    parent_name: "Jean-François Gagnon",
    email: "jfgagnon@hotmail.com",
    phone: "438-555-0202",
    player_age: "2015",
    player_level: "A",
    city: "Laval",
    goal: "Joueuse: Léa Gagnon · Poste: Défenseure · Club: Impact Laval · Recommandé par: Coach Beaulieu",
    availability: "Mercredi",
    status: "confirmed",
    is_waitlist: false,
    time_slot: "mer-2015",
  },
  {
    id: "mock-003",
    created_at: "2026-03-12T09:00:00.000Z",
    parent_name: "Sophie Bouchard",
    email: "sophie.bouchard@icloud.com",
    phone: "450-555-0303",
    player_age: "2015",
    player_level: "AA",
    city: "Longueuil",
    goal: "Joueuse: Camille Bouchard · Poste: Attaquante · Club: CS Saint-Laurent · Recommandé par: Non spécifié",
    availability: "Jeudi",
    status: "pending",
    is_waitlist: false,
    time_slot: "jeu-2015",
  },
  {
    id: "mock-004",
    created_at: "2026-03-13T16:20:00.000Z",
    parent_name: "Patrick Côté",
    email: "patrick.cote@videotron.ca",
    phone: "514-555-0404",
    player_age: "2015",
    player_level: "B",
    city: "Montréal",
    goal: "Joueuse: Sarah Côté · Poste: Gardienne · Club: Aucun · Recommandé par: Non spécifié",
    availability: "Lundi",
    status: "cancelled",
    is_waitlist: false,
    time_slot: "lun-2015",
  },
  {
    id: "mock-005",
    created_at: "2026-03-14T11:05:00.000Z",
    parent_name: "Isabelle Roy",
    email: "isabelle.roy@gmail.com",
    phone: "581-555-0505",
    player_age: "2016",
    player_level: "A",
    city: "Brossard",
    goal: "Joueuse: Jade Roy · Poste: Milieu · Club: FC Brossard · Recommandé par: Non spécifié",
    availability: "Mardi",
    status: "paid",
    is_waitlist: false,
    time_slot: "mar-2016",
  },
  {
    id: "mock-006",
    created_at: "2026-03-15T08:30:00.000Z",
    parent_name: "Marc-André Lavoie",
    email: "malavoie@outlook.com",
    phone: "438-555-0606",
    player_age: "2016",
    player_level: "AA",
    city: "Saint-Bruno",
    goal: "Joueuse: Alexia Lavoie · Poste: Attaquante · Club: Impact · Recommandé par: Marie Tremblay",
    availability: "Mardi",
    status: "pending",
    is_waitlist: false,
    time_slot: "mar-2016",
  },
  {
    id: "mock-007",
    created_at: "2026-03-16T13:00:00.000Z",
    parent_name: "Nathalie Fortin",
    email: "nfortin@gmail.com",
    phone: "514-555-0707",
    player_age: "2014-2013",
    player_level: "AAA",
    city: "Montréal",
    goal: "Joueuse: Maëlle Fortin · Poste: Milieu · Club: FC Montréal · Recommandé par: Non spécifié",
    availability: "Lundi soir",
    status: "paid",
    is_waitlist: false,
    time_slot: "lun-2014",
  },
  {
    id: "mock-008",
    created_at: "2026-03-17T15:45:00.000Z",
    parent_name: "Daniel Pelletier",
    email: "dpelletier@bell.net",
    phone: "450-555-0808",
    player_age: "2014-2013",
    player_level: "AA",
    city: "Terrebonne",
    goal: "Joueuse: Rosalie Pelletier · Poste: Défenseure · Club: CS Terrebonne · Recommandé par: Non spécifié",
    availability: "Lundi",
    status: "confirmed",
    is_waitlist: false,
    time_slot: "lun-2014",
  },
  {
    id: "mock-009",
    created_at: "2026-03-18T10:10:00.000Z",
    parent_name: "Catherine Morin",
    email: "cmorin@gmail.com",
    phone: "514-555-0909",
    player_age: "2015",
    player_level: "AA",
    city: "Montréal",
    goal: "Joueuse: Noémie Morin · Poste: Attaquante · Club: CS Saint-Michel · Recommandé par: Non spécifié",
    availability: "Flexible",
    status: "pending",
    is_waitlist: true,
    time_slot: undefined,
  },
];

const state = {
  leads: new Map<string, AdminLead>(SEED_LEADS.map((l) => [l.id, { ...l }])),
  // Leads created via the inscription form (mock mode)
  formLeads: new Map<string, MockLead>(),
  stripeEvents: new Set<string>(),
};

// ── Admin lead operations ──────────────────────────────────────────

export function getMockLeads(): AdminLead[] {
  const formAsAdmin: AdminLead[] = Array.from(state.formLeads.values()).map((l) => ({
    id: l.id,
    created_at: l.created_at,
    parent_name: l.parent_name,
    email: l.email,
    phone: l.phone,
    player_age: l.player_age,
    player_level: l.player_level,
    city: l.city ?? "",
    goal: l.goal,
    availability: l.availability ?? "",
    status: l.status,
    is_waitlist: l.is_waitlist,
    time_slot: l.time_slot,
    trial_date: l.trial_date ?? null,
    stripe_checkout_session_id: l.stripe_checkout_session_id,
    stripe_payment_intent_id: l.stripe_payment_intent_id,
  }));

  const all = [
    ...Array.from(state.leads.values()),
    ...formAsAdmin,
  ];
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function updateMockLeadStatus(id: string, status: AdminLead["status"]): void {
  const seed = state.leads.get(id);
  if (seed) { state.leads.set(id, { ...seed, status }); return; }
  const form = state.formLeads.get(id);
  if (form) state.formLeads.set(id, { ...form, status });
}

export function updateMockLeadTrialDate(id: string, trialDate: string | null): void {
  const seed = state.leads.get(id);
  if (seed) { state.leads.set(id, { ...seed, trial_date: trialDate }); return; }
  const form = state.formLeads.get(id);
  if (form) state.formLeads.set(id, { ...form, trial_date: trialDate });
}

export function updateMockLeadTimeSlot(id: string, timeSlot: string): void {
  const seed = state.leads.get(id);
  if (seed) { state.leads.set(id, { ...seed, time_slot: timeSlot || undefined }); return; }
  const form = state.formLeads.get(id);
  if (form) state.formLeads.set(id, { ...form, time_slot: timeSlot || undefined });
}

export function updateMockLeadGoal(id: string, goal: string): void {
  const seed = state.leads.get(id);
  if (seed) { state.leads.set(id, { ...seed, goal }); return; }
  const form = state.formLeads.get(id);
  if (form) state.formLeads.set(id, { ...form, goal });
}

export function deleteMockLead(id: string): void {
  state.leads.delete(id);
  state.formLeads.delete(id);
}

// ── Inscription form operations ────────────────────────────────────

export function createMockLead(payload: LeadFormPayload) {
  const id = randomUUID();
  const record: MockLead = {
    ...payload,
    id,
    created_at: new Date().toISOString(),
    status: "pending",
    is_waitlist: false,
  };
  state.formLeads.set(id, record);
  return record;
}

export function updateMockLeadCheckout(leadId: string, checkoutSessionId: string) {
  const lead = state.formLeads.get(leadId);
  if (lead) state.formLeads.set(leadId, { ...lead, stripe_checkout_session_id: checkoutSessionId });
}

export function markMockLeadPaid(leadId: string, paymentIntentId?: string) {
  const lead = state.formLeads.get(leadId);
  if (!lead) return null;
  const updated = { ...lead, status: "paid" as const, stripe_payment_intent_id: paymentIntentId };
  state.formLeads.set(leadId, updated);
  return updated;
}

export function hasMockStripeEvent(eventId: string) {
  return state.stripeEvents.has(eventId);
}

export function addMockStripeEvent(eventId: string) {
  state.stripeEvents.add(eventId);
}
