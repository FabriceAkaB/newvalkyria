"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { MISSING_MAX, USEFUL_OPTIONS, type Useful } from "@/lib/bulletin-feedback";

/** Sous le bulletin remis, côté parent (P4.8.11) : « Ce bulletin vous est-il utile ? » + ce qui manque.
 *  Une réponse par parent, par fille et par bulletin ; le parent peut la changer. Style du bulletin (.nvb, fond blanc). */
export function BulletinFeedbackCard({
  registrationId,
  period,
  firstName,
  initial
}: {
  registrationId: string;
  period: "mi-saison" | "fin-saison";
  firstName: string;
  initial: { useful: Useful; missing: string | null } | null;
}) {
  const [useful, setUseful] = useState<Useful | null>(initial?.useful ?? null);
  const [missing, setMissing] = useState(initial?.missing ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">(initial ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (next: Useful | null = useful) => {
    if (!next) return setError("Choisissez Oui, En partie ou Non.");
    setState("saving");
    setError(null);
    const res = await fetch("/api/compte/bulletin-avis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId, period, useful: next, missing })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setState("idle");
      return setError(data?.error ?? "Pas enregistré : réessayez.");
    }
    setState("saved");
  };

  return (
    <section className="nvb-feedback no-print" aria-label="Votre avis sur ce bulletin">
      <h3 className="nvb-h">Ce bulletin vous est-il utile ?</h3>
      <p className="nvb-small">Votre réponse aide les éducatrices à améliorer le prochain bulletin de {firstName}.</p>
      <div className="nvb-feedback__choices" role="radiogroup" aria-label="Ce bulletin vous est-il utile ?">
        {USEFUL_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={useful === o.value}
            data-on={useful === o.value || undefined}
            disabled={state === "saving"}
            onClick={() => {
              setUseful(o.value);
              void save(o.value);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="nvb-feedback__label" htmlFor={`nvb-missing-${registrationId}-${period}`}>
        Qu&apos;est-ce qui manque ? <span className="nvb-small">(facultatif)</span>
      </label>
      <textarea
        id={`nvb-missing-${registrationId}-${period}`}
        rows={3}
        maxLength={MISSING_MAX}
        value={missing}
        onChange={(e) => {
          setMissing(e.target.value);
          if (state === "saved") setState("idle");
        }}
        placeholder="Ex. un exemple concret, une vidéo, un exercice à faire à la maison…"
      />
      <div className="nvb-feedback__foot">
        <button type="button" className="nvb-feedback__send" disabled={state === "saving" || !useful} onClick={() => save()}>
          {state === "saving" ? "Envoi…" : initial || state === "saved" ? "Mettre à jour" : "Envoyer"}
        </button>
        {state === "saved" && !error ? (
          <span className="nvb-feedback__ok" role="status">
            <Check size={16} strokeWidth={2.25} aria-hidden /> Merci, c&apos;est noté.
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="nvb-feedback__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
