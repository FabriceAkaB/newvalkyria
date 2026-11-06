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
    carte?: string;
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
      redirect("/inscription/essai");
    }

    return (
      <section className="conf-page">
        <Container className="max-w-2xl">
          <ConfirmationSuccess sessionId={params.session_id} isTrial={true} trialYear={params.year} />
        </Container>
      </section>
    );
  }

  // ── Carte enregistrée pour les versements à venir (lien /api/paiement/carte/[planId]) ──
  if (params.carte === "true") {
    return (
      <section className="conf-page">
        <Container className="max-w-2xl">
          <div className="conf-root">
            <div className="conf-icon-wrap" aria-hidden>
              <span className="conf-glow" />
              <svg className="conf-svg" viewBox="0 0 72 72" fill="none" aria-label="Carte enregistrée">
                <circle cx="36" cy="36" r="34" className="conf-circle conf-circle-pop" />
                <path d="M20 37.5l11 11 21-22" className="conf-path" />
              </svg>
            </div>
            <p className="conf-kicker">Carte enregistrée</p>
            <h1 className="conf-title">Merci, c&apos;est<br />réglé</h1>
            <p className="conf-sub">Votre carte est enregistrée pour le prochain versement : il sera prélevé automatiquement à la date prévue. Aucun montant n&apos;a été prélevé aujourd&apos;hui. Une question ? info@newvalkyria.com</p>
          </div>
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
