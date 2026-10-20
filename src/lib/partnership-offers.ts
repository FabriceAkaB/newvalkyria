import { randomBytes } from "node:crypto";

import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PartnershipOption {
  id: string;
  offer_id: string;
  label: string;
  tagline: string | null;
  price_cents: number | null;
  catalog_price_cents: number | null;
  benefits: string[];
  slot_key: string | null;
  sort_order: number;
  status: "open" | "paid" | "unavailable" | "closed";
  payment_link_id: string | null;
  payment_link_url: string | null;
  paid_at: string | null;
}

export interface PartnershipOffer {
  id: string;
  token: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  cc_email: string | null;
  intro: string | null;
  terms_note: string | null;
  respond_by: string | null;
  pdf_path: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  sponsor_id: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  options: PartnershipOption[];
}

export function newOfferToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function getOfferByToken(token: string): Promise<PartnershipOffer | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const { data } = await db().from("partnership_offers").select("*, options:partnership_offer_options(*)").eq("token", token).maybeSingle();
  if (!data) return null;
  return { ...data, options: [...(data.options ?? [])].sort((a: PartnershipOption, b: PartnershipOption) => a.sort_order - b.sort_order) } as PartnershipOffer;
}

export async function getAllOffers(): Promise<PartnershipOffer[]> {
  const { data, error } = await db().from("partnership_offers").select("*, options:partnership_offer_options(*)").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((o: any) => ({ ...o, options: [...(o.options ?? [])].sort((a: PartnershipOption, b: PartnershipOption) => a.sort_order - b.sort_order) })) as PartnershipOffer[];
}

/** Lien de paiement Stripe d'une option (usage unique, facture automatique). */
export function buildOptionLinkParams(offer: Pick<PartnershipOffer, "id" | "company_name">, option: PartnershipOption): Stripe.PaymentLinkCreateParams {
  if (option.price_cents == null) throw new Error("Cette option n'a pas encore de prix.");
  const name = `Partenariat New Valkyria 2027 — ${option.label} — ${offer.company_name}`;
  const list = option.benefits.map((b) => `• ${b}`).join("\n");
  return {
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: option.price_cents,
          product_data: { name: name.slice(0, 250), description: (option.tagline ?? option.benefits.slice(0, 3).join(" · ")).slice(0, 480) }
        }
      }
    ],
    payment_method_types: ["card"],
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    custom_text: {
      submit: { message: `Ce que comprend l'option « ${option.label} » :\n${list}`.slice(0, 1190) },
      after_submit: { message: "Merci pour votre confiance ! Nous vous écrirons dans les 48 heures pour la suite (logo, dates, détails)." }
    },
    invoice_creation: {
      enabled: true,
      invoice_data: { description: name.slice(0, 500), footer: "New Valkyria · info@newvalkyria.com · newvalkyria.com" }
    },
    restrictions: { completed_sessions: { limit: 1 } },
    after_completion: {
      type: "hosted_confirmation",
      hosted_confirmation: { custom_message: `Merci ! Votre option « ${option.label} » est confirmée. Jean-Paul vous contactera sous 48 heures. Questions : info@newvalkyria.com` }
    },
    metadata: {
      checkoutType: "partnership-offer",
      offerId: offer.id,
      optionId: option.id,
      company: offer.company_name.slice(0, 200),
      option: option.label.slice(0, 200),
      ...(option.slot_key ? { slot: option.slot_key } : {})
    }
  };
}

async function setLinkActive(linkId: string | null, active: boolean) {
  if (!linkId) return;
  try {
    await getStripeClient().paymentLinks.update(linkId, { active });
  } catch (error) {
    console.error("Unable to update payment link", linkId, error);
  }
}

/** Un emplacement du chandail vient d'être vendu : toutes les AUTRES offres qui le visaient se ferment
 *  (option « plus disponible », lien Stripe désactivé), ainsi que le lien général de l'emplacement.
 *  Garantit qu'un même emplacement ne se vend jamais deux fois. */
export async function closeOtherOffersForSlot(slotKey: string, exceptOptionId: string | null): Promise<void> {
  const supabase = db();
  let q = supabase.from("partnership_offer_options").select("id, payment_link_id").eq("slot_key", slotKey).eq("status", "open");
  if (exceptOptionId) q = q.neq("id", exceptOptionId);
  const { data: options } = await q;
  for (const o of options ?? []) {
    await setLinkActive(o.payment_link_id, false);
    await supabase.from("partnership_offer_options").update({ status: "unavailable" }).eq("id", o.id);
  }
  const { data: slot } = await supabase.from("sponsor_slots_2027").select("payment_link_id").eq("slot_key", slotKey).maybeSingle();
  await setLinkActive(slot?.payment_link_id ?? null, false);
}

/** Paiement d'une option reçu : option payée, offre acceptée, autres options de l'offre fermées,
 *  commanditaire « Payé », emplacement du chandail vendu (et fermé partout ailleurs). */
export async function onPartnershipOptionPaid(input: { offerId: string; optionId: string; amountCents: number; sessionId: string; email: string | null; phone: string | null }): Promise<{ offer: any; option: any } | null> {
  const supabase = db();
  const { data: option } = await supabase.from("partnership_offer_options").select("*").eq("id", input.optionId).maybeSingle();
  const { data: offer } = await supabase.from("partnership_offers").select("*").eq("id", input.offerId).maybeSingle();
  if (!option || !offer) return null;
  const now = new Date().toISOString();

  await supabase.from("partnership_offer_options").update({ status: "paid", paid_at: now }).eq("id", option.id);
  // L'entreprise a choisi sa formule : les autres formules de SA proposition se ferment. L'option chandail
  // reste ouverte (elle s'ajoute à une formule), et payer l'option chandail ne ferme pas les formules.
  if (!option.slot_key) {
    const { data: siblings } = await supabase.from("partnership_offer_options").select("id, payment_link_id, slot_key").eq("offer_id", offer.id).eq("status", "open").neq("id", option.id);
    for (const s of siblings ?? []) {
      if (s.slot_key) continue;
      await setLinkActive(s.payment_link_id, false);
      await supabase.from("partnership_offer_options").update({ status: "closed" }).eq("id", s.id);
    }
  }
  await supabase.from("partnership_offers").update({ status: "accepted", accepted_at: now, updated_at: now }).eq("id", offer.id);

  let sponsorId = offer.sponsor_id as string | null;
  const partnership = `${option.label}${option.slot_key ? ` (chandail : ${option.slot_key})` : ""} — 2027`;
  if (sponsorId) {
    await supabase.from("sponsors").update({ status: "paye", partnership_type: partnership, proposed_amount_cents: input.amountCents, updated_at: now }).eq("id", sponsorId);
  } else {
    const { data: created } = await supabase
      .from("sponsors")
      .insert({ company_name: offer.company_name, contact_name: offer.contact_name, contact_email: input.email ?? offer.contact_email, contact_phone: input.phone, category: "principal", partnership_type: partnership, proposed_amount_cents: input.amountCents, status: "paye" })
      .select("id")
      .single();
    sponsorId = created?.id ?? null;
    if (sponsorId) await supabase.from("partnership_offers").update({ sponsor_id: sponsorId }).eq("id", offer.id);
  }
  if (sponsorId) {
    await supabase.from("sponsor_payments").insert({ sponsor_id: sponsorId, amount_cents: input.amountCents, paid_at: now, method: "Stripe", note: `Proposition personnalisée — ${option.label} (session ${input.sessionId})` });
  }

  if (option.slot_key) {
    await supabase.from("sponsor_slots_2027").update({ status: "sold", sponsor_id: sponsorId, price_cents: input.amountCents, updated_at: now }).eq("slot_key", option.slot_key);
    await closeOtherOffersForSlot(option.slot_key, option.id);
  }
  return { offer, option };
}

/** L'emplacement redevient disponible : les options d'offres qui le visaient se rouvrent. */
export async function reopenOffersForSlot(slotKey: string): Promise<void> {
  const supabase = db();
  const { data: options } = await supabase.from("partnership_offer_options").select("id, payment_link_id").eq("slot_key", slotKey).eq("status", "unavailable");
  for (const o of options ?? []) {
    await setLinkActive(o.payment_link_id, true);
    await supabase.from("partnership_offer_options").update({ status: "open" }).eq("id", o.id);
  }
}

/** Fixe (ou change) le prix d'une option — p. ex. l'option chandail « à convenir » — et crée son lien de paiement. */
export async function setOptionPrice(optionId: string, priceCents: number): Promise<PartnershipOption> {
  const supabase = db();
  const { data: option } = await supabase.from("partnership_offer_options").select("*").eq("id", optionId).maybeSingle();
  if (!option) throw new Error("Option introuvable.");
  if (option.status !== "open") throw new Error("Cette option n'est plus ouverte.");
  if (option.slot_key) {
    const { data: slot } = await supabase.from("sponsor_slots_2027").select("status").eq("slot_key", option.slot_key).maybeSingle();
    if (slot && slot.status !== "available") throw new Error("Cet emplacement du chandail n'est plus disponible.");
  }
  const { data: offer } = await supabase.from("partnership_offers").select("id, company_name").eq("id", option.offer_id).single();
  await setLinkActive(option.payment_link_id, false);
  const updated = { ...option, price_cents: priceCents } as PartnershipOption;
  const link = await getStripeClient().paymentLinks.create(buildOptionLinkParams(offer, updated));
  await supabase.from("partnership_offer_options").update({ price_cents: priceCents, payment_link_id: link.id, payment_link_url: link.url }).eq("id", optionId);
  return { ...updated, payment_link_id: link.id, payment_link_url: link.url };
}
