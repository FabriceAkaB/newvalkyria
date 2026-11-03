"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { isComplete, REVIEW_QUESTIONS, type ReviewKey, type WeeklyReview } from "@/lib/weekly-review";

/** Les 3 questions du bilan de la semaine ; enregistrable à moitié, complet quand les 3 réponses sont écrites. */
export function WeeklyReviewForm({ weekStart, initial }: { weekStart: string; initial: WeeklyReview | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<ReviewKey, string>>({
    wentWell: initial?.wentWell ?? "",
    doDifferently: initial?.doDifferently ?? "",
    nextPriority: initial?.nextPriority ?? ""
  });
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const complete = isComplete(answers);

  const save = async () => {
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/mandalart/bilan", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekStart, ...answers }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "Pas enregistré : réessaie." });
    setState({ kind: "saved", message: complete ? "Bilan enregistré. Ta priorité n° 1 s'affiche dans « Aujourd'hui » toute la semaine." : "Enregistré. Il manque encore une réponse." });
    router.refresh();
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {REVIEW_QUESTIONS.map((q, i) => (
        <label key={q.key} className="ct-field">
          <span style={{ fontSize: "0.9rem", color: "var(--adm-text)", fontWeight: 600 }}>
            {i + 1}. {q.label}
          </span>
          <textarea
            className="admin-input"
            rows={q.key === "nextPriority" ? 2 : 3}
            value={answers[q.key]}
            onChange={(e) => {
              setAnswers((p) => ({ ...p, [q.key]: e.target.value }));
              setState({ kind: "idle" });
            }}
            placeholder={q.key === "nextPriority" ? "Une seule chose." : undefined}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </label>
      ))}
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" onClick={save} disabled={state.kind === "saving"} style={{ minHeight: 44 }}>
          {state.kind === "saving" ? "Enregistrement…" : "Enregistrer le bilan"}
        </button>
        {state.kind === "saved" && <span style={{ color: "var(--adm-good)", fontSize: "0.85rem" }}>{state.message}</span>}
        {state.kind === "error" && <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{state.message}</span>}
      </div>
    </div>
  );
}
