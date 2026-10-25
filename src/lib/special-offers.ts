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

/** Groupes de l'offre qui n'ont plus assez de places (inscriptions payées seulement),
 *  pour ne jamais vendre plus de places qu'un groupe en contient. */
export async function fullGroupsForOffer(offer: Pick<SpecialOffer, "registrations">): Promise<string[]> {
  const needed = new Map<string, { count: number; label: string }>();
  for (const r of offer.registrations) {
    if (!r.timeSlotTemplateId) continue;
    const cur = needed.get(r.timeSlotTemplateId) ?? { count: 0, label: r.groupLabel };
    cur.count += 1;
    needed.set(r.timeSlotTemplateId, cur);
  }
  if (needed.size === 0) return [];
  const ids = [...needed.keys()];
  const [{ data: slots }, { data: taken }] = await Promise.all([
    db().from("time_slot_templates").select("id, max_places").in("id", ids),
    db()
      .from("registrations")
      .select("id, time_slot_template_id")
      .in("time_slot_template_id", ids)
      .eq("status", "paid")
      .not("id", "in", `(${offer.registrations.map((r) => r.registrationId).join(",")})`)
  ]);
  const full: string[] = [];
  for (const [slotId, need] of needed) {
    const max = (slots ?? []).find((x: any) => x.id === slotId)?.max_places ?? 0;
    const used = (taken ?? []).filter((x: any) => x.time_slot_template_id === slotId).length;
    if (used + need.count > max) full.push(need.label);
  }
  return full;
}
