import { revalidateTag } from "next/cache";

import { Container } from "@/components/container";
import { ConfirmationSuccess } from "@/components/confirmation-success";
import { env } from "@/lib/env";
import { markLeadAsPaid } from "@/lib/repositories";

interface ConfirmationPageProps {
  searchParams: Promise<{
    session_id?: string;
    waitlist?: string;
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

    if (session.payment_status !== "paid") return;

    const leadId = session.metadata?.leadId;
    if (leadId) {
      await markLeadAsPaid(
        leadId,
        typeof session.payment_intent === "string" ? session.payment_intent : undefined
      );
      revalidateTag("enrollment-capacity", {});
    }
  } catch {
    // silencieux — le webhook prend le relai
  }
}

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const params = await searchParams;

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
