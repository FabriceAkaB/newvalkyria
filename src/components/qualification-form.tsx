"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import logo from "@/content/image/logo/LogoNewValkeryarealincolor.png";
import { trackEvent } from "@/lib/analytics";
import type { AgeCategory } from "@/lib/categories";
import { getCategoryFromYear } from "@/lib/categories";
import type { CapacityData, CategoryCapacity } from "@/lib/capacity";
import type { CheckoutResponse, LeadFormInput } from "@/types/contracts";

/* ── Données du tunnel ─────────────────────────────────────────────── */

const BIRTH_YEARS = [
  { year: "2016",     label: "Féminin U10 — 2016" },
  { year: "2015",     label: "Féminin U11 — 2015" },
  { year: "2014-2013", label: "Féminin U12-U13 — 2014 & 2013" }
];

const YEAR_TO_CATEGORY: Record<string, AgeCategory> = {
  "2016":     "2016",
  "2015":     "2015",
  "2014-2013": "2014-2013"
};

const POSITIONS = ["Gardien (GK)", "Défenseur", "Milieu", "Attaquant", "Ailier"];
const LEVELS = ["D1", "D2", "D3"];

const HORAIRES: Record<string, string> = {
  "2016":     "18h00 – 19h25",
  "2015":     "19h30 – 20h55",
  "2014-2013": "19h30 – 20h55"
};

const ESSAI_DATES: Record<string, { label: string; dates: string[] }[]> = {
  "2016": [
    { label: "Groupe 2016", dates: ["Dim 13 avril", "Mar 15 avril", "Jeu 17 avril"] }
  ],
  "2015": [
    { label: "Groupe 2015", dates: ["Dim 13 avril", "Mar 15 avril", "Jeu 17 avril"] },
    { label: "Groupe 2015 & 2014-2013", dates: ["Lun 14 avril", "Mer 16 avril", "Ven 18 avril"] }
  ],
  "2014-2013": [
    { label: "Groupe 2014 & 2013", dates: ["Lun 14 avril", "Mer 16 avril", "Ven 18 avril"] }
  ]
};

const ELITE_BENEFITS = [
  "15 pratiques spécialisées — 1x/semaine",
  "Durée : 85 minutes par pratique",
  "Choix : lundi, mercredi ou vendredi",
  "Travail technique avancé",
  "Préparation mentale et confiance",
  "Intelligence de jeu et tactique",
  "Travail sur l\u2019intensité",
  "BONUS : 3 pratiques d\u2019essai gratuites",
  "BONUS : Rencontre téléphonique bilan"
];

const POLL_INTERVAL = 10_000;
const QUALIFICATION_STATE_KEY = "nv_qualification_state";

/* ── Types ─────────────────────────────────────────────────────────── */

type Step = "landing" | "form" | "offer";

type FormData = {
  parent_name: string;
  email: string;
  phone: string;
  child_name: string;
  child_dob: string;
  club_level: string;
  position: string;
  category_year: string;
  level: string;
};

type QualificationState = {
  form: FormData;
  leadId: string | null;
  step: Step;
};

/* ── Composant ─────────────────────────────────────────────────────── */

export function QualificationForm() {
  const [step, setStep] = useState<Step>("landing");
  const [form, setForm] = useState<FormData>({
    parent_name: "",
    email: "",
    phone: "",
    child_name: "",
    child_dob: "",
    club_level: "",
    position: "",
    category_year: "",
    level: ""
  });
  const [leadId, setLeadId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<"elite" | "trial" | null>(null);

  // Live capacity
  const [liveCapacity, setLiveCapacity] = useState<Record<string, CategoryCapacity> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/capacity", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as CapacityData;
        setLiveCapacity(data.byCategory as Record<string, CategoryCapacity>);
      } catch { /* silencieux */ }
    };
    void poll();
    intervalRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (step !== "landing") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  const category = YEAR_TO_CATEGORY[form.category_year] ?? null;
  const catCap = category && liveCapacity ? (liveCapacity as Record<string, CategoryCapacity>)[category] : null;
  const remaining = catCap?.remaining ?? 20;
  const maxCap = catCap ? catCap.remaining + catCap.taken : 20;
  const horaire = HORAIRES[form.category_year] ?? "";
  const essai = ESSAI_DATES[form.category_year] ?? null;

  const saveQualificationState = (nextState?: Partial<QualificationState>) => {
    if (typeof window === "undefined") return;

    const snapshot: QualificationState = {
      form,
      leadId,
      step,
      ...nextState
    };

    window.sessionStorage.setItem(QUALIFICATION_STATE_KEY, JSON.stringify(snapshot));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("cancelled") !== "1") return;

    const raw = window.sessionStorage.getItem(QUALIFICATION_STATE_KEY);
    if (!raw) {
      setStep("form");
      setCheckoutError("Paiement annulé. Vous pouvez reprendre votre choix ci-dessous.");
      window.history.replaceState({}, "", "/qualification");
      return;
    }

    try {
      const saved = JSON.parse(raw) as QualificationState;
      setForm(saved.form);
      setLeadId(saved.leadId);
      setStep(saved.step === "offer" ? "offer" : "form");
      setCheckoutError("Paiement annulé. Vous pouvez reprendre votre choix ci-dessous.");
    } catch {
      setStep("form");
      setCheckoutError("Paiement annulé. Vous pouvez reprendre votre choix ci-dessous.");
    } finally {
      setCheckoutLoading(false);
      setCheckoutTarget(null);
      window.history.replaceState({}, "", "/qualification");
    }
  }, []);

  /* ── Form submit → save lead ── */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    const payload: LeadFormInput = {
      parent_name: form.parent_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      player_age: category ?? form.category_year,
      player_level: form.level as LeadFormInput["player_level"],
      city: "Non spécifié",
      goal: `Poste: ${form.position} · Club: ${form.club_level || "Aucun"}`,
      availability: "Flexible",
      consent: true,
      player_name: form.child_name,
      player_position: form.position,
      player_club: form.club_level || undefined
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Impossible d\u2019enregistrer le formulaire.");
      }

      const data = (await res.json()) as { leadId: string };
      trackEvent("tunnel_lead_submitted", { level: form.level, position: form.position });

      // Store for inscription page pre-fill
      if (typeof window !== "undefined") {
        localStorage.setItem("nv_birth_year", form.category_year);
        if (category) localStorage.setItem("nv_category", category);
      }

      setLeadId(data.leadId);
      setStep("offer");
      saveQualificationState({ form, leadId: data.leadId, step: "offer" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue");
      setFormLoading(false);
    }
  };

  /* ── Save recap data to localStorage for confirmation page ── */
  const saveRecapData = (programme: string, montant: string) => {
    const yearLabel = BIRTH_YEARS.find((b) => b.year === form.category_year)?.label ?? "";
    const recap = {
      child_name: form.child_name,
      parent_email: form.email,
      programme,
      category_label: yearLabel,
      year: form.category_year,
      horaire: HORAIRES[form.category_year] ?? "",
      montant
    };
    localStorage.setItem("nv_recap", JSON.stringify(recap));
  };

  /* ── Elite → Stripe checkout ── */
  const handleEliteClick = async () => {
    if (!leadId) return;
    saveQualificationState({ step: "offer" });
    setCheckoutLoading(true);
    setCheckoutTarget("elite");
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          email: form.email,
          category,
          cancelPath: "/qualification?cancelled=1"
        })
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Impossible de d\u00e9marrer le paiement.");
      }

      const checkout = (await res.json()) as CheckoutResponse;
      trackEvent("tunnel_elite_selected", { leadId });
      saveRecapData("Programme \u00c9lite New Valkyria", "550 $");

      if (checkout.waitlistUrl) {
        window.location.href = checkout.waitlistUrl;
        return;
      }
      window.location.href = checkout.checkoutUrl!;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Une erreur est survenue");
      setCheckoutLoading(false);
      setCheckoutTarget(null);
    }
  };

  /* ── Essai gratuit → confirmation ── */
  const handleEssaiClick = async () => {
    if (!leadId) return;

    saveQualificationState({ step: "offer" });
    setCheckoutLoading(true);
    setCheckoutTarget("trial");
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          email: form.email,
          checkoutType: "trial",
          trialYear: form.category_year,
          cancelPath: "/qualification?cancelled=1"
        })
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Impossible de démarrer la validation de carte.");
      }

      const checkout = (await res.json()) as CheckoutResponse;
      trackEvent("tunnel_trial_selected", { leadId, birthYear: form.category_year });
      saveRecapData("Essai gratuit — 3 s\u00e9ances", "0 $");
      window.location.href = checkout.checkoutUrl!;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Une erreur est survenue");
      setCheckoutLoading(false);
      setCheckoutTarget(null);
    }
  };

  /* ════════════════════════════════════════════════════════════════
     ÉTAPE 1 — LANDING (Logo + CTA unique)
  ════════════════════════════════════════════════════════════════ */
  if (step === "landing") {
    return (
      <div className="qual-shell">
        <div className="tunnel-landing">
          <Image
            src={logo}
            alt="New Valkyria"
            width={140}
            height={140}
            className="tunnel-landing-logo"
            priority
          />
          <h1 className="tunnel-landing-title">NEW VALKYRIA</h1>
          <p className="tunnel-landing-sub">
            Programme d&apos;excellence pour<br />joueuses de soccer
          </p>
          <p className="tunnel-landing-desc">
            Rejoins le programme qui transforme<br />les joueuses ambitieuses en athlètes d&apos;élite.
          </p>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="tunnel-landing-cta"
          >
            Réserver ma place maintenant
          </button>
          <p className="tunnel-landing-hint">
            Places limitées — Essai gratuit inclus
          </p>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     ÉTAPE 2 — FORMULAIRE D'INSCRIPTION
  ════════════════════════════════════════════════════════════════ */
  if (step === "form") {
    return (
      <div className="qual-shell">
        <div className="qual-logo">
          <span className="qual-logo-text">NEW VALKYRIA</span>
        </div>

        <div className="tunnel-form-header">
          <p className="tunnel-form-kicker">Inscription — Essais gratuits</p>
        </div>

        <form onSubmit={handleFormSubmit} className="qual-card tunnel-form-card">

          {/* Parent info */}
          <div className="tunnel-section">
            <label className="tunnel-field">
              <span>Nom complet du parent <span className="tunnel-req">*</span></span>
              <input
                required
                autoComplete="name"
                placeholder="Prénom Nom de famille"
                value={form.parent_name}
                onChange={(e) => setForm((p) => ({ ...p, parent_name: e.target.value }))}
                className="qual-input"
              />
            </label>
            <label className="tunnel-field">
              <span>Adresse courriel du parent <span className="tunnel-req">*</span></span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="exemple@exemple.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="qual-input"
              />
            </label>
            <label className="tunnel-field">
              <span>Numéro de téléphone du parent <span className="tunnel-req">*</span></span>
              <input
                type="tel"
                required
                autoComplete="tel"
                placeholder="514 000-0000"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="qual-input"
              />
            </label>
          </div>

          {/* Child info */}
          <div className="tunnel-section">
            <label className="tunnel-field">
              <span>Nom complet de l&apos;enfant <span className="tunnel-req">*</span></span>
              <input
                required
                placeholder="Prénom Nom de famille"
                value={form.child_name}
                onChange={(e) => setForm((p) => ({ ...p, child_name: e.target.value }))}
                className="qual-input"
              />
            </label>
            <label className="tunnel-field">
              <span>Date de naissance de l&apos;enfant <span className="tunnel-req">*</span></span>
              <input
                type="date"
                required
                value={form.child_dob}
                onChange={(e) => setForm((p) => ({ ...p, child_dob: e.target.value }))}
                className="qual-input"
              />
            </label>
            <label className="tunnel-field">
              <span>Club actuel et niveau <span className="tunnel-req">*</span></span>
              <input
                required
                placeholder="Ex: FC Laval — D2"
                value={form.club_level}
                onChange={(e) => setForm((p) => ({ ...p, club_level: e.target.value }))}
                className="qual-input"
              />
            </label>
          </div>

          {/* Position pills */}
          <div className="tunnel-section">
            <div className="tunnel-field">
              <span>Poste préféré <span className="tunnel-req">*</span></span>
              <div className="insc-pills">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, position: pos }))}
                    className={`insc-pill${form.position === pos ? " insc-pill-active" : ""}`}
                    aria-pressed={form.position === pos}
                  >
                    {pos}
                  </button>
                ))}
              </div>
              {!form.position && (
                <input required value="" onChange={() => {}} className="insc-hidden-required" tabIndex={-1} aria-hidden />
              )}
            </div>
          </div>

          {/* Category pills */}
          <div className="tunnel-section">
            <div className="tunnel-field">
              <span>Catégorie <span className="tunnel-req">*</span></span>
              <div className="insc-pills tunnel-pills-wrap">
                {BIRTH_YEARS.map((by) => (
                  <button
                    key={by.year}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, category_year: by.year }))}
                    className={`insc-pill${form.category_year === by.year ? " insc-pill-active" : ""}`}
                    aria-pressed={form.category_year === by.year}
                  >
                    {by.label}
                  </button>
                ))}
              </div>
              {!form.category_year && (
                <input required value="" onChange={() => {}} className="insc-hidden-required" tabIndex={-1} aria-hidden />
              )}
            </div>
          </div>

          {/* Level pills */}
          <div className="tunnel-section">
            <div className="tunnel-field">
              <span>Niveau <span className="tunnel-req">*</span></span>
              <div className="insc-pills">
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, level: lv }))}
                    className={`insc-pill${form.level === lv ? " insc-pill-active" : ""}`}
                    aria-pressed={form.level === lv}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              {!form.level && (
                <input required value="" onChange={() => {}} className="insc-hidden-required" tabIndex={-1} aria-hidden />
              )}
            </div>
          </div>

          {formError && <p className="tunnel-error" role="alert">{formError}</p>}

          <button type="submit" disabled={formLoading} className="tunnel-submit">
            {formLoading ? "Enregistrement..." : "Continuer"}
          </button>
        </form>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     ÉTAPE 3 — CHOIX DE L'OFFRE (Elite vs Essai gratuit)
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="qual-shell tunnel-offer-shell">
      <div className="qual-logo">
        <span className="qual-logo-text">NEW VALKYRIA</span>
      </div>

      <div className="tunnel-offer-grid">
        {/* ── Programme Élite ── */}
        <div className="tunnel-offer-card tunnel-offer-elite">
          <h2 className="tunnel-offer-title">Programme Élite<br />New Valkyria</h2>
          <p className="tunnel-offer-tagline">Le programme complet pour joueuses ambitieuses</p>

          {/* Scarcity dynamique */}
          <div className="tunnel-scarcity">
            <span className="tunnel-scarcity-num">{remaining}</span> places restantes sur {maxCap}
          </div>

          <ul className="tunnel-benefits">
            {ELITE_BENEFITS.map((b, i) => (
              <li key={i}>
                <span className="tunnel-check" aria-hidden>✓</span>
                {b}
              </li>
            ))}
          </ul>

          {/* Horaires */}
          <div className="tunnel-horaires">
            <p>2016 : 18h00-19h25 / 2015 : 19h30-20h55</p>
            <p>2013-2014 : 19h30 à 20h55</p>
          </div>

          {/* Garantie */}
          <div className="tunnel-garantie">
            <p className="tunnel-garantie-title">Garantie 7 semaines</p>
            <p className="tunnel-garantie-sub">Non satisfait après 7 semaines = remboursé</p>
          </div>

          {/* Price anchoring */}
          <div className="tunnel-price-block">
            <p className="tunnel-price-anchor">Valeur totale : <span className="tunnel-price-strike">1 200 $</span></p>
            <p className="tunnel-price-real">550 $</p>
            <p className="tunnel-price-sub">Paiement unique — Tout inclus</p>
          </div>

          {checkoutError && <p className="tunnel-error" role="alert">{checkoutError}</p>}

          <button
            type="button"
            disabled={checkoutLoading}
            onClick={handleEliteClick}
            className="tunnel-cta-elite"
          >
            {checkoutLoading && checkoutTarget === "elite"
              ? "Redirection vers le paiement..."
              : "Choisir le programme Élite"}
          </button>
        </div>

        {/* ── Essai gratuit ── */}
        <div className="tunnel-offer-card tunnel-offer-free">
          <div className="tunnel-free-badge">Gratuit</div>
          <h2 className="tunnel-offer-title-sm">Essai gratuit — 3 pratiques</h2>
          <p className="tunnel-offer-tagline">Découvrez le programme sans engagement.<br />Rencontre téléphonique bilan à la fin.</p>

          {/* Dates par groupe */}
          {essai && essai.map((group, i) => (
            <div key={i} className="tunnel-essai-dates">
              <p className="tunnel-essai-group">{group.label}</p>
              <div className="tunnel-essai-pills">
                {group.dates.map((d) => (
                  <span key={d} className="tunnel-essai-pill">{d}</span>
                ))}
              </div>
            </div>
          ))}

          <div className="tunnel-essai-horaires">
            <p className="tunnel-essai-horaires-title">Horaires (85 min par pratique) :</p>
            <p>2016 (U10) : 18h00 à 19h25</p>
            <p>2015 (U11) : 19h30 à 20h55</p>
            <p>2013-2014 (U12-U13) : 19h30 à 20h55</p>
          </div>

          <button
            type="button"
            disabled={checkoutLoading}
            onClick={handleEssaiClick}
            className="tunnel-cta-essai"
          >
            {checkoutLoading && checkoutTarget === "trial"
              ? "Redirection vers la validation..."
              : "Commencer l'essai gratuit"}
          </button>
          <p className="tunnel-essai-note">
            Carte requise pour valider. Aucun prélèvement.
          </p>
        </div>
      </div>
    </div>
  );
}
