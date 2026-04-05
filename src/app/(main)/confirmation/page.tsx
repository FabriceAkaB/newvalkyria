import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { Container } from "@/components/container";
import { ConfirmationSuccess } from "@/components/confirmation-success";
import { env } from "@/lib/env";
import { markLeadAsPaid } from "@/lib/repositories";

interface ConfirmationPageProps {
  searchParams: Promise<{
    session_id?: string;
    waitlist?: string;
    trial?: string;
    year?: string;
  }>;
}

/**
 * Vérifie le paiement directement via Stripe en fallback.
 */
async function verifyAndMarkPaid(sessionId: string): Promise<void> {
  if (!env.stripeSecretKey) return;

  try {
    const { getStripeClient } = await import("@/lib/stripe");
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode !== "payment" || session.metadata?.checkoutType === "trial") return;
    if (session.payment_status !== "paid") return;

    const leadId = session.metadata?.leadId;
    if (leadId) {
      await markLeadAsPaid(
        leadId,
        typeof session.payment_intent === "string" ? session.payment_intent : undefined
      );
      revalidateTag("enrollment-capacity", "max");
    }
  } catch {
    // silencieux — le webhook prend le relai
  }
}

async function verifyTrialSession(sessionId: string): Promise<boolean> {
  if (!env.stripeSecretKey) return false;

  try {
    const { getStripeClient } = await import("@/lib/stripe");
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return session.mode === "setup"
      && session.status === "complete"
      && session.metadata?.checkoutType === "trial";
  } catch {
    return false;
  }
}

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const params = await searchParams;

  // ── Essai gratuit : confirmation uniquement après validation Stripe ──────
  if (params.trial === "true") {
    if (!params.session_id || !(await verifyTrialSession(params.session_id))) {
      redirect("/qualification?cancelled=1");
    }

    return (
      <section className="conf-page">
        <Container className="max-w-2xl">
          <ConfirmationSuccess sessionId={params.session_id} isTrial={true} trialYear={params.year} />
        </Container>
      </section>
    );
  }

  // ── Liste d'attente : pas de Stripe, confirmation directe ────
  if (params.waitlist === "true") {
    return (
      <section className="conf-page">
        <Container className="max-w-2xl">
          <ConfirmationSuccess isWaitlist={true} />
        </Container>
      </section>
    );
  }

  // ── Paiement Stripe normal ────────────────────────────────────
  const sessionId = params.session_id;
  if (sessionId) {
    await verifyAndMarkPaid(sessionId);
  }

  return (
    <section className="conf-page">
      <Container className="max-w-2xl">
        <ConfirmationSuccess sessionId={sessionId} isWaitlist={false} />
      </Container>
    </section>
  );
}
