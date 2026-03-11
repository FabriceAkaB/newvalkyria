"use client";

import Link from "next/link";

interface ConfirmationSuccessProps {
  sessionId?: string;
  isWaitlist?: boolean;
}

const STEPS_REGULAR = [
  { icon: "✉", label: "Courriel de confirmation envoyé" },
  { icon: "📱", label: "Notre équipe vous contacte sous 24h pour votre créneau" },
  { icon: "⚽", label: "Première séance confirmée pour la saison 2026" }
];

const STEPS_WAITLIST = [
  { icon: "✉", label: "Courriel de confirmation envoyé" },
  { icon: "🔔", label: "Vous serez avisé·e en priorité si une place se libère" },
  { icon: "📞", label: "Notre équipe vous contacte dès qu'un groupe s'ouvre" }
];

export function ConfirmationSuccess({ sessionId, isWaitlist = false }: ConfirmationSuccessProps) {
  const steps = isWaitlist ? STEPS_WAITLIST : STEPS_REGULAR;

  return (
    <div className="conf-root">

      {/* ── Icône centrale ── */}
      <div className="conf-icon-wrap" aria-hidden>
        <span className="conf-glow" />
        {isWaitlist ? (
          /* Icône horloge pour la liste d'attente */
          <svg className="conf-svg" viewBox="0 0 72 72" fill="none" aria-label="Sur la liste d'attente">
            <circle cx="36" cy="36" r="34" className="conf-circle" />
            <circle cx="36" cy="36" r="20" stroke="rgba(196,164,228,0.6)" strokeWidth="1.5" fill="none" />
            <path d="M36 22v14l8 5" stroke="#c4a4e4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg className="conf-svg" viewBox="0 0 72 72" fill="none" aria-label="Inscription confirmée">
            <circle cx="36" cy="36" r="34" className="conf-circle" />
            <path d="M20 37.5l11 11 21-22" className="conf-path" />
          </svg>
        )}
      </div>

      {/* ── Texte principal ── */}
      <p className="conf-kicker">
        {isWaitlist ? "Demande enregistrée" : "Paiement confirmé"}
      </p>
      <h1 className="conf-title">
        {isWaitlist ? (
          <>Vous êtes sur<br />la liste</>
        ) : (
          <>Bienvenue dans<br />l&apos;équipe</>
        )}
      </h1>
      <p className="conf-sub">
        {isWaitlist
          ? "Votre demande est enregistrée. Dès qu'une place se libère dans ce groupe, vous serez la première contactée."
          : "Votre fille fait maintenant partie de New Valkyria. On a hâte de la voir progresser."}
      </p>

      {/* ── Prochaines étapes ── */}
      <ul className="conf-steps" aria-label="Prochaines étapes">
        {steps.map((step, i) => (
          <li key={i} className="conf-step">
            <span className="conf-step-icon" aria-hidden>{step.icon}</span>
            <span className="conf-step-label">{step.label}</span>
          </li>
        ))}
      </ul>

      {/* ── CTA ── */}
      <Link href="/" className="conf-cta">
        Retour à l&apos;accueil
      </Link>

      {/* ── Référence discrète ── */}
      {sessionId && (
        <p className="conf-ref">Réf. {sessionId.slice(-12)}</p>
      )}

    </div>
  );
}
