import type Stripe from "stripe";

/** Programme de partenariat 2027 (voir « New Valkyria — Programme de partenariat »).
 *  13 emplacements ; chacun a un lien de paiement Stripe à usage unique. */

export type SponsorTier = "titre" | "majeur" | "signature" | "manche" | "site";

export const TIER_BENEFITS: Record<SponsorTier, string[]> = {
  titre: [
    "Logo au centre avant de tous les chandails de match et d'entraînement",
    "Logo sur les vestes d'échauffement",
    "Exclusivité complète de votre secteur d'activité",
    "Bannière grand format déployée à chaque séance, sur nos quatre sites",
    "Logo sur toutes nos communications aux familles et sur newvalkyria.com",
    "6 publications dédiées sur nos réseaux sociaux",
    "Kiosque pour votre entreprise lors de nos rassemblements de membres",
    "Possibilité d'offrir vos produits, services ou remises exclusives à nos membres",
    "Photo officielle encadrée de l'académie remise à votre commerce",
    "Rapport de partenariat écrit en fin de saison"
  ],
  majeur: [
    "Logo au haut du dos, juste sous le col, sur tous les chandails de match et d'entraînement",
    "Exclusivité de votre secteur d'activité",
    "Bannière déployée à chaque séance, sur nos quatre sites",
    "Logo sur nos communications aux familles et sur newvalkyria.com",
    "3 publications dédiées sur nos réseaux sociaux",
    "Kiosque pour votre entreprise lors de nos rassemblements de membres",
    "Possibilité d'offrir vos produits, services ou remises exclusives à nos membres",
    "Invitation à nos événements officiels",
    "Rapport de partenariat écrit en fin de saison"
  ],
  signature: [
    "Logo au bas du dos, sous le numéro, sur tous les chandails de match et d'entraînement",
    "Exclusivité de votre secteur d'activité",
    "2 publications dédiées sur nos réseaux sociaux",
    "Possibilité d'offrir vos produits, services ou remises exclusives à nos membres",
    "Logo sur newvalkyria.com et sur nos communications",
    "Rapport de partenariat écrit en fin de saison"
  ],
  manche: [
    "Logo sur la manche de votre choix, sur tous les chandails de l'académie",
    "Exclusivité de votre secteur d'activité",
    "2 publications dédiées sur nos réseaux sociaux",
    "Logo sur newvalkyria.com",
    "Invitation à l'événement de fin de saison"
  ],
  site: [
    "Bannière à votre nom déployée à chaque séance de la saison",
    "Visible à Terrebonne, Sainte-Thérèse, Saint-Jérôme et Rosemère",
    "Logo sur newvalkyria.com",
    "Bannière produite, transportée et installée par l'académie"
  ]
};

export interface SponsorSlot {
  slot_key: string;
  tier: SponsorTier;
  tier_label: string;
  placement: string;
  price_cents: number;
  /** Tarif du document ; diffère de price_cents quand le prix a été négocié. */
  list_price_cents: number | null;
  sort_order: number;
  status: "available" | "reserved" | "sold";
  sponsor_id: string | null;
  payment_link_id: string | null;
  payment_link_url: string | null;
  notes: string | null;
}

/** Objectif de la saison 2027 selon le document (1 + 1 + 1 + 2 + 8 emplacements). */
export const SPONSORSHIP_GOAL_CENTS = 2_930_000;

function money(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 0 })} $`;
}

/** Paramètres du lien de paiement Stripe d'un emplacement : description de l'offre, champs
 *  entreprise/secteur/responsable, facture automatique, usage unique. */
export function buildPaymentLinkParams(slot: Pick<SponsorSlot, "slot_key" | "tier" | "tier_label" | "placement" | "price_cents">): Stripe.PaymentLinkCreateParams {
  const benefits = TIER_BENEFITS[slot.tier];
  const list = benefits.map((b) => `• ${b}`).join("\n");
  const productName = `${slot.tier_label} — ${slot.placement} (saison 2027)`;
  return {
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: slot.price_cents,
          product_data: {
            name: productName,
            description: `Programme de partenariat New Valkyria 2027 — ${benefits.slice(0, 3).join(" · ")}`.slice(0, 480)
          }
        }
      }
    ],
    payment_method_types: ["card"],
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    custom_fields: [
      { key: "company_name", label: { type: "custom", custom: "Nom de l'entreprise (tel qu'il doit apparaître)" }, type: "text" },
      { key: "contact_person", label: { type: "custom", custom: "Personne responsable du partenariat" }, type: "text" },
      { key: "sector", label: { type: "custom", custom: "Secteur d'activité (pour l'exclusivité)" }, type: "text" }
    ],
    custom_text: {
      submit: { message: `Ce que comprend votre partenariat :\n${list}`.slice(0, 1190) },
      after_submit: { message: "Merci de soutenir le sport féminin ! Nous vous écrirons dans les 48 heures pour recueillir votre logo et confirmer les détails." }
    },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: `${productName} — Programme de partenariat New Valkyria`,
        footer: "New Valkyria · info@newvalkyria.com · newvalkyria.com"
      }
    },
    restrictions: { completed_sessions: { limit: 1 } },
    after_completion: {
      type: "hosted_confirmation",
      hosted_confirmation: {
        custom_message: `Merci ! Votre ${slot.tier_label} (${slot.placement}) est confirmé. Jean-Paul vous contactera sous 48 heures pour la suite. Questions : info@newvalkyria.com`
      }
    },
    metadata: {
      checkoutType: "sponsorship",
      tier: slot.tier,
      tierLabel: slot.tier_label,
      placement: slot.placement,
      slot: slot.slot_key,
      amount: money(slot.price_cents)
    }
  };
}
