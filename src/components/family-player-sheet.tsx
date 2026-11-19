"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { SHEET_FIELDS, SHEET_FIELD_MAX, type SheetAnswers } from "@/lib/player-sheet";

/** Fiche joueuse (P4.1.03) : six questions courtes, toutes facultatives, lues par l'éducatrice avant la pratique. */
export function FamilyPlayerSheet({ registrationId, firstName, initial }: { registrationId: string; firstName: string; initial: SheetAnswers | null }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(SHEET_FIELDS.map((f) => [f.key, initial?.[f.key] ?? ""])));
  const [state, setState] = useState<"idle" | "saving" | "saved">(initial ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setState("saving");
    setError(null);
    const res = await fetch("/api/compte/fiche", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, ...values }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (res?.ok) setState("saved");
    else {
      setState("idle");
      setError(json?.error ?? "Pas enregistré. Réessayez.");
    }
  };

  return (
    <div className="parent-card" style={{ display: "grid", gap: 16 }}>
      {SHEET_FIELDS.map((f) => (
        <label key={f.key} style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>{f.label}</span>
          <span className="parent-muted" style={{ fontSize: "0.85rem" }}>{f.hint}</span>
          <textarea
            className="insc-input"
            rows={f.key === "health" ? 2 : 3}
            maxLength={SHEET_FIELD_MAX}
            value={values[f.key]}
            onChange={(e) => {
              setValues((v) => ({ ...v, [f.key]: e.target.value }));
              setState("idle");
            }}
            style={{ resize: "vertical" }}
          />
        </label>
      ))}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="nv27-btn-primary" style={{ flex: "none" }} disabled={state === "saving"} onClick={save}>
          {state === "saving" ? "Enregistrement…" : `Enregistrer la fiche de ${firstName}`}
        </button>
        {state === "saved" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--adm-good)", fontWeight: 600 }}>
            <Check size={16} aria-hidden /> Enregistrée : son éducatrice la lira avant la pratique.
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, color: "var(--adm-bad)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
