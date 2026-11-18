"use client";

import { useState } from "react";

/** Mes objectifs professionnels (Mon dossier) : écrits par l'éducateur, lus par JP. */
export function CoachDossierGoals({ initial }: { initial: string }) {
  const [goals, setGoals] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const save = async () => {
    setState("saving");
    const res = await fetch("/api/coach/dossier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goals }) }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <textarea
        className="admin-input"
        rows={4}
        value={goals}
        maxLength={2000}
        onChange={(e) => {
          setGoals(e.target.value);
          setState("idle");
        }}
        placeholder="Ex. Obtenir mon diplôme C de Soccer Québec d'ici l'été, mieux gérer les groupes de 12 filles, apprendre à animer une séance de A à Z."
        style={{ width: "100%", resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" className="admin-btn-primary" disabled={state === "saving"} onClick={save}>
          {state === "saving" ? "Enregistrement…" : "Enregistrer mes objectifs"}
        </button>
        <span className="coach-muted">{state === "saved" ? "Enregistré ✓ JP les lira." : state === "error" ? "Pas enregistré : réessaie." : ""}</span>
      </div>
    </div>
  );
}
