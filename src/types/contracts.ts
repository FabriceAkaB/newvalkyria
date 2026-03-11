export type PlayerLevel = "Débutante" | "Intermédiaire" | "Élite";

export interface LeadFormInput {
  parent_name: string;
  email: string;
  phone: string;
  player_age: string;
  player_level: PlayerLevel;
  city: string;
  goal: string;
  availability: string;
  consent: boolean;
}

export interface LeadRecord extends LeadFormInput {
  id: string;
  created_at: string;
  status: "pending" | "paid" | "cancelled";
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
}

export type AddonId = "tir" | "dribble" | "analyse";

export interface CheckoutRequest {
  leadId: string;
  email: string;
  addons?: AddonId[];
}

export interface CheckoutResponse {
  sessionId?: string;
  checkoutUrl?: string;
  /** Retourné quand la catégorie est pleine — redirige vers la confirmation liste d'attente sans passer par Stripe */
  waitlistUrl?: string;
}

export interface ProgramOffer {
  title: string;
  priceLabel: string;
  duration: string;
  capacity: string;
  includes: string[];
  policy: string;
}

export interface CoachProfile {
  fullName: string;
  experienceYears: number;
  certifications: string[];
  mission: string;
  values: string[];
}

export interface MethodSection {
  title: string;
  description: string;
  points: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  status: "published" | "collecting" | "verified";
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}
