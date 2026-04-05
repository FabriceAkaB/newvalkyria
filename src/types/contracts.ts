export type PlayerLevel = "Débutante" | "Intermédiaire" | "Élite" | "D1" | "D2" | "D3";

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
  /** Tunnel fields (optional for backward compat with existing leads) */
  player_name?: string;
  player_position?: string;
  player_club?: string;
}

export interface LeadRecord extends LeadFormInput {
  id: string;
  created_at: string;
  status: "pending" | "paid" | "cancelled";
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
}

export type AddonId = "tir" | "dribble" | "analyse";
export type CheckoutType = "elite" | "trial";

export interface CheckoutRequest {
  leadId: string;
  email: string;
  addons?: AddonId[];
  category?: "2016-2017" | "2014-2015" | "2012-2013";
  checkoutType?: CheckoutType;
  trialYear?: "2016" | "2015" | "2014" | "2013";
  cancelPath?: string;
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
