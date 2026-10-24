import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Offre spéciale personnelle (ex. 2 pour 1 pour deux sœurs), valide jusqu'à `expires_at`. */
export interface OfferRegistration {
  registrationId: string;
  playerName: string;
  programId: string;
  timeSlotTemplateId: string;
  groupLabel: string;
}

export interface SpecialOffer {
  id: string;
  token: string;
  title: string;
  description: string | null;
  parent_name: string | null;
  parent_email: string | null;
  amount_cents: number;
  regular_amount_cents: number | null;
  registrations: OfferRegistration[];
  expires_at: string;
  paid_at: string | null;
}

function db() {
  return getSupabaseAdminClient() as any;
}

export async function getOfferByToken(token: string): Promise<SpecialOffer | null> {
  const { data } = await db().from("special_offers").select("*").eq("token", token).maybeSingle();
  return data ?? null;
}

export function isOfferExpired(offer: Pick<SpecialOffer, "expires_at">, now = Date.now()): boolean {
  return new Date(offer.expires_at).getTime() <= now;
}

export async function markOfferPaid(token: string, sessionId: string, paymentIntentId: string | null) {
  await db()
    .from("special_offers")
    .update({ paid_at: new Date().toISOString(), stripe_checkout_session_id: sessionId, stripe_payment_intent_id: paymentIntentId })
    .eq("token", token);
}
