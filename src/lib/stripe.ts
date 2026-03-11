import Stripe from "stripe";

import { env } from "@/lib/env";

let stripe: Stripe | null = null;

export function getStripeClient() {
  if (stripe) {
    return stripe;
  }

  if (!env.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  stripe = new Stripe(env.stripeSecretKey);

  return stripe;
}
