"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ConfirmationSuccessProps {
  sessionId?: string;
  isWaitlist?: boolean;
  isTrial?: boolean;
  trialYear?: string;
}

interface RecapData {
  child_name: string;
  parent_email: string;
  programme: string;
  category_label: string;
  year: string;
  horaire: string;
  montant: string;
}

const ESSAI_DATES: Record<string, string> = {
  "2016":     "Mar 14, Jeu 16, Sam 18 avril",
  "2015":     "Groupe 1 : Mar 14, Jeu 16, Sam 18 avril — Groupe 2 : Lun 13, Mer 15, Ven 17 avril",
  "2014-2013": "Lun 13, Mer 15, Ven 17 avril"
};

const HORAIRES: Record<string, string> = {
  "2016":     "18h00 à 19h25 (Sam 18 : 13h30 à 14h55)",
  "2015":     "Gr.1 : 19h30 à 20h55 / Gr.2 : 18h00 à 19h25 (Sam 18 : 15h00 à 16h30)",
  "2014-2013": "19h30 à 20h55"
};

const ESSAI_LIEU = "Terrain synthétique — Parc à Rosemère, Rue Charbonneau, Rosemère, QC J7A 1G1";

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

const STEPS_TRIAL = [
  { icon: "✉", label: "Courriel de confirmation envoyé" },
  { icon: "📱", label: "Notre équipe vous contacte pour confirmer votre créneau" },
  { icon: "⚽", label: "3 séances d'essai gratuites — sans engagement" }
];

export function ConfirmationSuccess({ sessionId, isWaitlist = false, isTrial = false, trialYear }: ConfirmationSuccessProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("https://newvalkyria.ca/inscription");
  const [recap, setRecap] = useState<RecapData | null>(null);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/inscription`);

    try {
      const raw = localStorage.getItem("nv_recap");
      if (raw) {
        const data = JSON.parse(raw) as RecapData;
        setRecap(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const steps = isTrial ? STEPS_TRIAL : isWaitlist ? STEPS_WAITLIST : STEPS_REGULAR;
  const shareText = "Ma fille s'inscrit chez New Valkyria — un programme d'entraînement de soccer élite pour filles. Regarde ça !";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const yearKey = trialYear ?? recap?.year ?? null;
  const essaiDates = yearKey ? (ESSAI_DATES[yearKey] ?? null) : null;
  const horaire = yearKey ? (HORAIRES[yearKey] ?? null) : null;

  return (
    <div className="conf-root">

      {/* — Icon with animation — */}
      <div className="conf-icon-wrap" aria-hidden>
        <span className="conf-glow" />
        {isWaitlist ? (
          <svg className="conf-svg" viewBox="0 0 72 72" fill="none" aria-label="Sur la liste d'attente">
            <circle cx="36" cy="36" r="34" className="conf-circle" />
            <circle cx="36" cy="36" r="20" stroke="rgba(196,164,228,0.6)" strokeWidth="1.5" fill="none" />
            <path d="M36 22v14l8 5" stroke="#c4a4e4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : isTrial ? (
          <svg className="conf-svg" viewBox="0 0 72 72" fill="none" aria-label="Essai gratuit confirmé">
            <circle cx="36" cy="36" r="34" className="conf-circle conf-circle-pop" />
            <path d="M20 37.5l11 11 21-22" className="conf-path" />
          </svg>
        ) : (
          <svg className="conf-svg" viewBox="0 0 72 72" fill="none" aria-label="Inscription confirmée">
            <circle cx="36" cy="36" r="34" className="conf-circle conf-circle-pop" />
            <path d="M20 37.5l11 11 21-22" className="conf-path" />
          </svg>
        )}
      </div>

      {/* — Main text — */}
      <p className="conf-kicker">
        {isTrial ? "Essai confirmé" : isWaitlist ? "Demande enregistrée" : "Paiement confirmé"}
      </p>
      <h1 className="conf-title">
        {isTrial ? (
          <>Bienvenue pour<br />l&apos;essai gratuit</>
        ) : isWaitlist ? (
          <>Vous êtes sur<br />la liste</>
        ) : (
          <>Bienvenue dans<br />l&apos;équipe</>
        )}
      </h1>
      <p className="conf-sub">
        {isTrial
          ? "Votre fille est inscrite pour 3 séances d'essai gratuites. Aucun frais ne sera prélevé."
          : isWaitlist
          ? "Votre demande est enregistrée. Dès qu'une place se libère dans ce groupe, vous serez la première contactée."
          : "Votre fille fait maintenant partie de New Valkyria. On a hâte de la voir progresser. Vous bénéficiez de 3 pratiques d'essai gratuites incluses dans votre programme."}
      </p>

      {/* — Recap summary — */}
      {recap && (
        <div className="conf-recap">
          <p className="conf-recap-header">Récapitulatif</p>
          <div className="conf-recap-grid">
            {recap.parent_email && (
              <div className="conf-recap-row">
                <span className="conf-recap-label">Courriel</span>
                <span className="conf-recap-value">{recap.parent_email}</span>
              </div>
            )}
            {recap.child_name && (
              <div className="conf-recap-row">
                <span className="conf-recap-label">Joueuse</span>
                <span className="conf-recap-value">{recap.child_name}</span>
              </div>
            )}
            <div className="conf-recap-row">
              <span className="conf-recap-label">Programme</span>
              <span className="conf-recap-value">{recap.programme}</span>
            </div>
            {recap.category_label && (
              <div className="conf-recap-row">
                <span className="conf-recap-label">Catégorie</span>
                <span className="conf-recap-value">{recap.category_label}</span>
              </div>
            )}
            {essaiDates && (
              <div className="conf-recap-row">
                <span className="conf-recap-label">Essais gratuits</span>
                <span className="conf-recap-value">{essaiDates}</span>
              </div>
            )}
            {horaire && (
              <div className="conf-recap-row">
                <span className="conf-recap-label">Horaire essais</span>
                <span className="conf-recap-value">{horaire}</span>
              </div>
            )}
            {essaiDates && (
              <div className="conf-recap-row">
                <span className="conf-recap-label">Lieu</span>
                <span className="conf-recap-value">{ESSAI_LIEU}</span>
              </div>
            )}
            <div className="conf-recap-row conf-recap-row-highlight">
              <span className="conf-recap-label">Montant</span>
              <span className="conf-recap-value">{recap.montant}</span>
            </div>
          </div>
          {essaiDates && (
            <p className="conf-recap-note">* Le terrain peut changer — vous serez avertis par courriel.</p>
          )}
        </div>
      )}

      {/* — Next steps — */}
      <ul className="conf-steps" aria-label="Prochaines étapes">
        {steps.map((s, i) => (
          <li key={i} className="conf-step">
            <span className="conf-step-icon" aria-hidden>{s.icon}</span>
            <span className="conf-step-label">{s.label}</span>
          </li>
        ))}
      </ul>

      {/* — Contact button — */}
      <div className="conf-contact">
        <p className="conf-contact-text">Une question ? Contactez-nous directement.</p>
        <div className="conf-contact-actions">
          <a href="mailto:info@newvalkyria.com" className="conf-contact-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
            Courriel
          </a>
          <a href="tel:+15146883600" className="conf-contact-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            514 688-3600
          </a>
        </div>
      </div>

      {/* — Share section — */}
      <div className="conf-share">
        <p className="conf-share-title">Partagez le lien</p>
        <p className="conf-share-sub">
          Vous connaissez une joueuse qui aimerait rejoindre ? Partagez-lui le lien d&apos;inscription.
        </p>
        <div className="conf-share-actions">
          <button type="button" onClick={handleCopy} className="conf-share-btn conf-share-copy">
            {copied ? "✓ Copié !" : "Copier le lien"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="conf-share-btn conf-share-wa"
          >
            WhatsApp
          </a>
          <a
            href={`sms:?body=${encodeURIComponent(shareText + " " + shareUrl)}`}
            className="conf-share-btn conf-share-sms"
          >
            SMS
          </a>
        </div>
      </div>

      {/* — CTA — */}
      <Link href="/" className="conf-cta">
        Retour à l&apos;accueil
      </Link>

      {/* — Ref — */}
      {sessionId && (
        <p className="conf-ref">Réf. {sessionId.slice(-12)}</p>
      )}

    </div>
  );
}
