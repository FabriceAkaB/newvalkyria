"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getCategoryFromYear } from "@/lib/categories";

type FormData = {
  birth_year: string;
  club: string;
  division: string;
  phone: string;
  email: string;
  expectations: string;
};

const TOTAL_STEPS = 5;

export function QualificationForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<FormData>({
    birth_year: "",
    club: "",
    division: "",
    phone: "",
    email: "",
    expectations: ""
  });

  const progress = (step / TOTAL_STEPS) * 100;

  function set(field: keyof FormData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function canAdvance() {
    if (step === 1) return data.birth_year.length >= 4;
    if (step === 2) return data.club.trim().length >= 2;
    if (step === 3) return data.division !== "";
    if (step === 4) return data.phone.trim().length >= 8 && /\S+@\S+\.\S+/.test(data.email);
    if (step === 5) return data.expectations.trim().length >= 20;
    return false;
  }

  async function handleSubmit() {
    setSubmitting(true);

    // Persist birth year so the inscription page can pre-fill the category
    if (typeof window !== "undefined" && data.birth_year) {
      localStorage.setItem("nv_birth_year", data.birth_year);
      const cat = getCategoryFromYear(data.birth_year);
      if (cat) localStorage.setItem("nv_category", cat);
    }

    try {
      await fetch("/api/qualification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
    } catch {
      // Non-blocking — redirect regardless
    }
    router.push("/");
  }

  return (
    <div className="qual-shell">
      {/* Logo */}
      <div className="qual-logo">
        <span className="qual-logo-text">NEW VALKYRIA</span>
      </div>

      {/* Progress bar */}
      <div className="qual-progress-bar">
        <div className="qual-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="qual-progress-label">Étape {step} sur {TOTAL_STEPS}</p>

      {/* Steps */}
      <div className="qual-card">

        {step === 1 && (
          <div className="qual-step">
            <p className="qual-q-num">Question 1</p>
            <h2 className="qual-question">Quelle est l'année de naissance de votre fille ?</h2>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ex. 2013"
              min={2005}
              max={2020}
              className="qual-input"
              value={data.birth_year}
              onChange={(e) => set("birth_year", e.target.value)}
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <div className="qual-step">
            <p className="qual-q-num">Question 2</p>
            <h2 className="qual-question">Dans quel club votre fille joue-t-elle ?</h2>
            <input
              type="text"
              placeholder="Nom du club ou « Aucun club »"
              className="qual-input"
              value={data.club}
              onChange={(e) => set("club", e.target.value)}
              autoFocus
            />
          </div>
        )}

        {step === 3 && (
          <div className="qual-step">
            <p className="qual-q-num">Question 3</p>
            <h2 className="qual-question">Dans quelle division joue-t-elle ?</h2>
            <div className="qual-choices">
              {["Division 1", "Division 2", "Division 3", "Ne joue pas en club"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set("division", opt)}
                  className={`qual-choice${data.division === opt ? " qual-choice-selected" : ""}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="qual-step">
            <p className="qual-q-num">Question 4</p>
            <h2 className="qual-question">Comment vous joindre ?</h2>
            <div className="qual-inputs-group">
              <input
                type="tel"
                inputMode="tel"
                placeholder="Numéro de téléphone"
                className="qual-input"
                value={data.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoFocus
              />
              <input
                type="email"
                inputMode="email"
                placeholder="Adresse courriel"
                className="qual-input"
                value={data.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="qual-step">
            <p className="qual-q-num">Question 5</p>
            <h2 className="qual-question">
              Décrivez brièvement ce que l'académie pourra apporter au développement de votre fille.
            </h2>
            <textarea
              placeholder="Ex. Elle manque de confiance technique, on cherche un suivi individualisé..."
              className="qual-textarea"
              rows={5}
              value={data.expectations}
              onChange={(e) => set("expectations", e.target.value)}
              autoFocus
            />
            <p className="qual-char-hint">{data.expectations.length} / 20 minimum</p>
          </div>
        )}

        {/* Navigation */}
        <div className="qual-nav">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="qual-btn-back"
            >
              ← Retour
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
              className="qual-btn-next"
            >
              Continuer →
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance() || submitting}
              onClick={handleSubmit}
              className="qual-btn-next"
            >
              {submitting ? "Envoi…" : "Accéder au site →"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
