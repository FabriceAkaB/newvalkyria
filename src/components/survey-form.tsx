"use client";

import { useState } from "react";

import type { SurveyQuestion } from "@/lib/surveys-repo";

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.2rem 1.2rem", border: "1px solid #e6e0ee", marginTop: "0.9rem" };
const chip = (on: boolean): React.CSSProperties => ({
  minWidth: 44,
  minHeight: 44,
  padding: "0.55rem 0.8rem",
  borderRadius: 10,
  border: `2px solid ${on ? "#5b2a86" : "#e0d8ea"}`,
  background: on ? "#5b2a86" : "#fff",
  color: on ? "#fff" : "#1d1730",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer"
});
const SCALE5 = ["Pas du tout", "Peu", "Moyen", "Bien", "Excellent"];

/** Formulaire du sondage côté famille : gros boutons, utilisable d'une main sur téléphone. */
export function SurveyForm({ token, questions, initial }: { token: string; questions: SurveyQuestion[]; initial: Record<string, unknown> | null }) {
  const [a, setA] = useState<Record<string, unknown>>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (id: string, v: unknown) => setA({ ...a, [id]: v });

  if (done) {
    return (
      <div style={card}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>✓ Merci beaucoup !</h2>
        <p style={{ color: "#5d566b", lineHeight: 1.6 }}>Votre réponse est bien reçue. Chaque réponse est lue par l'équipe et sert à améliorer l'expérience de votre enfant.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(`/api/sondage/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: a }) });
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error ?? "Erreur");
          setDone(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      {initial ? <p style={{ ...card, background: "#f3edf9", color: "#3b1d5e", fontSize: "0.92rem" }}>Vous avez déjà répondu. Vous pouvez modifier vos réponses et les renvoyer.</p> : null}
      {questions.map((q, idx) => (
        <fieldset key={q.id} style={{ ...card, margin: "0.9rem 0 0" }}>
          <legend style={{ fontWeight: 700, fontSize: "1rem", color: "#1d1730", padding: 0, marginBottom: "0.7rem", float: "left", width: "100%" }}>
            {idx + 1}. {q.label}
            {q.required ? <span style={{ color: "#b3261e" }}> *</span> : null}
            {q.help ? <span style={{ display: "block", fontWeight: 400, fontSize: "0.85rem", color: "#6b6478", marginTop: 4 }}>{q.help}</span> : null}
          </legend>
          <div style={{ clear: "both", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {q.type === "note10"
              ? Array.from({ length: 11 }, (_, n) => (
                  <button key={n} type="button" style={chip(a[q.id] === n)} onClick={() => set(q.id, n)} aria-pressed={a[q.id] === n}>
                    {n}
                  </button>
                ))
              : null}
            {q.type === "echelle5"
              ? SCALE5.map((l, k) => (
                  <button key={l} type="button" style={chip(a[q.id] === k + 1)} onClick={() => set(q.id, k + 1)} aria-pressed={a[q.id] === k + 1}>
                    {l}
                  </button>
                ))
              : null}
            {q.type === "oui_non" || q.type === "choix"
              ? (q.type === "oui_non" ? ["Oui", "Non"] : q.options ?? []).map((o) => (
                  <button key={o} type="button" style={chip(a[q.id] === o)} onClick={() => set(q.id, o)} aria-pressed={a[q.id] === o}>
                    {o}
                  </button>
                ))
              : null}
            {q.type === "choix_multiple"
              ? (q.options ?? []).map((o) => {
                  const cur = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
                  const on = cur.includes(o);
                  return (
                    <button key={o} type="button" style={chip(on)} aria-pressed={on} onClick={() => set(q.id, on ? cur.filter((x) => x !== o) : [...cur, o])}>
                      {on ? "✓ " : ""}
                      {o}
                    </button>
                  );
                })
              : null}
            {q.type === "texte" ? (
              <textarea
                rows={3}
                value={String(a[q.id] ?? "")}
                onChange={(e) => set(q.id, e.target.value)}
                style={{ width: "100%", borderRadius: 10, border: "2px solid #e0d8ea", padding: "0.7rem", fontSize: "1rem", fontFamily: "inherit", color: "#1d1730", background: "#fff" }}
              />
            ) : null}
          </div>
        </fieldset>
      ))}
      {error ? <p style={{ color: "#b3261e", fontWeight: 600, marginTop: "1rem" }}>{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        style={{ marginTop: "1.2rem", width: "100%", minHeight: 52, borderRadius: 12, border: "none", background: "#5b2a86", color: "#fff", fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}
      >
        {busy ? "Envoi…" : "Envoyer mes réponses"}
      </button>
    </form>
  );
}
