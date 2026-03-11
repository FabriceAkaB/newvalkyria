import { randomUUID } from "node:crypto";

import type { LeadFormPayload } from "@/lib/validations";

type MockLead = LeadFormPayload & {
  id: string;
  created_at: string;
  status: "pending" | "paid";
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
};

const state = {
  leads: new Map<string, MockLead>(),
  stripeEvents: new Set<string>()
};

export function createMockLead(payload: LeadFormPayload) {
  const id = randomUUID();
  const record: MockLead = {
    ...payload,
    id,
    created_at: new Date().toISOString(),
    status: "pending"
  };

  state.leads.set(id, record);

  return record;
}

export function updateMockLeadCheckout(leadId: string, checkoutSessionId: string) {
  const lead = state.leads.get(leadId);
  if (!lead) {
    return;
  }

  lead.stripe_checkout_session_id = checkoutSessionId;
}

export function markMockLeadPaid(leadId: string, paymentIntentId?: string) {
  const lead = state.leads.get(leadId);
  if (!lead) {
    return null;
  }

  lead.status = "paid";
  lead.stripe_payment_intent_id = paymentIntentId;

  return lead;
}

export function hasMockStripeEvent(eventId: string) {
  return state.stripeEvents.has(eventId);
}

export function addMockStripeEvent(eventId: string) {
  state.stripeEvents.add(eventId);
}
