"use client";

import { useState } from "react";

import { trackEvent } from "@/lib/analytics";
import type { AgeCategory } from "@/lib/categories";
import { CATEGORY_LABELS, CATEGORY_SUBLABELS } from "@/lib/categories";
import type { AddonId, CheckoutResponse, LeadFormInput } from "@/types/contracts";

const CITIES = [
  "Rosemère",
  "Mirabel",
  "Saint-Thérèse",
  "Boisbriand",
  "Blainville",
  "Sainte-Thérèse",
  "Autre"
];

const AVAILABILITIES = [
  "Lundi, Mercredi, Vendredi",
  "Lundi, Mercredi",
  "Mercredi, Vendredi",
  "Lundi, Vendredi",
  "Lundi seulement",
  "Mercredi seulement",
  "Vendredi seulement",
  "Flexible"
];

const GOALS = [
  "Améliorer la technique individuelle",
  "Gagner en confiance en match",
  "Développer le QI foot et la lecture du jeu",
  "Progresser plus vite qu'en club classique",
  "Se préparer pour le niveau élite",
  "Améliorer le contrôle et la précision",
  "Autre"
];

const initialForm: LeadFormInput = {
  parent_name: "",
  email: "",
  phone: "",
  player_age: "",
  player_level: "Intermédiaire",
  city: "",
  goal: "",
  availability: "Lundi, Mercredi, Vendredi",
  consent: false
};

type Props = {
  addons?: AddonId[];
  category?: AgeCategory | null;
  isWaitlist?: boolean;
};

export function LeadCaptureForm({ addons = [], category, isWaitlist = false }: Props) {
  const [form, setForm] = useState<LeadFormInput>({
    ...initialForm,
    player_age: category ?? ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const leadResponse = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isWaitlist: isWaitlist || undefined })
      });

      if (!leadResponse.ok) {
        const leadError = (await leadResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(leadError.error ?? "Impossible d'enregistrer le formulaire.");
      }

      const leadData = (await leadResponse.json()) as { leadId: string };
      trackEvent("lead_submitted", { city: form.city, level: form.player_level });

      // ── Liste d'attente : pas de Stripe, redirection directe ──────
      if (isWaitlist) {
        trackEvent("waitlist_registered", { leadId: leadData.leadId });
        window.location.href = "/confirmation?waitlist=true";
        return;
      }

      // ── Paiement normal ───────────────────────────────────────────
      const checkoutResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: leadData.leadId, email: form.email, addons, category: category ?? undefined })
      });

      if (!checkoutResponse.ok) {
        const checkoutError = (await checkoutResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(checkoutError.error ?? "Impossible de démarrer le paiement.");
      }

      const checkout = (await checkoutResponse.json()) as CheckoutResponse;
      trackEvent("checkout_started", { leadId: leadData.leadId });

      // Auto-waitlist côté serveur (race condition — catégorie remplie pendant la saisie)
      if (checkout.waitlistUrl) {
        window.location.href = checkout.waitlistUrl;
        return;
      }

      window.location.href = checkout.checkoutUrl!;
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Une erreur est survenue";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="insc-form">

      {/* ── Section 1 : Votre profil ── */}
      <div className="insc-form-section">
        <p className="insc-section-label">Votre profil</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="insc-field">
            <span>Nom du parent</span>
            <input
              required
              autoComplete="name"
              value={form.parent_name}
              onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.target.value }))}
              className="insc-input"
            />
          </label>
          <label className="insc-field">
            <span>Courriel</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="insc-input"
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="insc-field">
            <span>Téléphone</span>
            <input
              type="tel"
              required
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="insc-input"
            />
          </label>
          <label className="insc-field">
            <span>Ville</span>
            <select
              required
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              className="insc-input insc-select"
            >
              <option value="" disabled>Sélectionner...</option>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* ── Section 2 : Votre joueuse ── */}
      <div className="insc-form-section">
        <p className="insc-section-label">Votre joueuse</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="insc-field">
            <span>Catégorie d&apos;âge</span>
            {category ? (
              <div className="insc-cat-locked-chip" aria-label={`Catégorie: ${CATEGORY_LABELS[category]}`}>
                <span className="insc-cat-locked-label">{CATEGORY_LABELS[category]}</span>
                <span className="insc-cat-locked-sub">{CATEGORY_SUBLABELS[category]}</span>
                <span className="insc-cat-locked-badge">✓ Confirmé</span>
              </div>
            ) : (
              <select
                required
                value={form.player_age}
                onChange={(e) => setForm((prev) => ({ ...prev, player_age: e.target.value }))}
                className="insc-input insc-select"
              >
                <option value="" disabled>Sélectionner...</option>
                <option value="2016-2017">Nées 2016–2017 (U8–U9)</option>
                <option value="2014-2015">Nées 2014–2015 (U10–U11)</option>
                <option value="2012-2013">Nées 2012–2013 (U12–U13)</option>
              </select>
            )}
          </div>
          <label className="insc-field">
            <span>Niveau actuel</span>
            <select
              value={form.player_level}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  player_level: e.target.value as LeadFormInput["player_level"]
                }))
              }
              className="insc-input insc-select"
            >
              <option>Débutante</option>
              <option>Intermédiaire</option>
              <option>Élite</option>
            </select>
          </label>
        </div>
        <label className="insc-field">
          <span>Objectif principal</span>
          <select
            required
            value={form.goal}
            onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))}
            className="insc-input insc-select"
          >
            <option value="" disabled>Sélectionner...</option>
            {GOALS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
      </div>

      {/* ── Section 3 : Disponibilités ── */}
      <div className="insc-form-section">
        <p className="insc-section-label">Disponibilités</p>
        <label className="insc-field">
          <span>Jours préférés</span>
          <select
            required
            value={form.availability}
            onChange={(e) => setForm((prev) => ({ ...prev, availability: e.target.value }))}
            className="insc-input insc-select"
          >
            {AVAILABILITIES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {/* ── Consentement ── */}
      <label className="insc-consent">
        <div className="insc-checkbox-wrap">
          <input
            type="checkbox"
            required
            checked={form.consent}
            onChange={(e) => setForm((prev) => ({ ...prev, consent: e.target.checked }))}
            className="insc-checkbox"
          />
          <span className="insc-checkbox-custom" aria-hidden>
            {form.consent && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </div>
        <span>
          {isWaitlist
            ? "J'autorise New Valkyria à me contacter si une place se libère dans ce groupe."
            : "J'autorise New Valkyria à me contacter pour finaliser l'inscription et l'organisation de la saison."}
        </span>
      </label>

      {error && (
        <p className="insc-error" role="alert">{error}</p>
      )}

      <button type="submit" disabled={loading} className={`insc-submit${isWaitlist ? " insc-submit-waitlist" : ""}`}>
        {loading ? (
          <span className="insc-submit-loading">
            <span className="insc-spinner" aria-hidden />
            Préparation du paiement...
          </span>
        ) : (
          <span>{isWaitlist ? "Réserver ma place sur la liste d'attente →" : "Valider et passer au paiement →"}</span>
        )}
      </button>

      <p className="insc-submit-note">
        Aucun paiement à cette étape · Redirection sécurisée vers Stripe
      </p>
    </form>
  );
}
