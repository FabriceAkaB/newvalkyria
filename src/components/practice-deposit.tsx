"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Déposer une pratique passée : le lien de ses diapos et l'analyse d'après pratique (ce qui a marché, ce qu'on change). */
export function PracticeDeposit({ practiceKey, deckUrl, analysis }: { practiceKey: string; deckUrl: string | null; analysis: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deck, setDeck] = useState(deckUrl ?? "");
  const [text, setText] = useState(analysis ?? "");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "error"; message?: string }>({ kind: "idle" });
  const save = async () => {
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/coaching/historique", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: practiceKey, deckUrl: deck, analysis: text }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "Pas enregistré : réessaie." });
    setState({ kind: "idle" });
    setOpen(false);
    router.refresh();
  };
  if (!open) {
    return (
      <button type="button" className="admin-btn-ghost" onClick={() => setOpen(true)} style={{ whiteSpace: "nowrap" }}>
        {deckUrl || analysis ? "Modifier" : "Déposer"}
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8, flexBasis: "100%" }}>
      <label className="ct-field">
        <span>Lien des diapos de la pratique</span>
        <input className="admin-input" value={deck} onChange={(e) => setDeck(e.target.value)} placeholder="https://claude.ai/artifact/…" />
      </label>
      <label className="ct-field">
        <span>Analyse d&apos;après pratique : ce qui a marché, ce qu&apos;on change la prochaine fois</span>
        <textarea className="admin-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
      </label>
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" onClick={save} disabled={state.kind === "saving"} style={{ minHeight: 44 }}>{state.kind === "saving" ? "Enregistrement…" : "Enregistrer"}</button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
        {state.kind === "error" && <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{state.message}</span>}
      </div>
    </div>
  );
}
