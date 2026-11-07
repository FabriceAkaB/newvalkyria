"use client";

import { useState } from "react";

type Status = "a_faire" | "en_cours" | "fait" | "abandonne";

const btn = (primary: boolean): React.CSSProperties => ({
  minHeight: 46,
  padding: "0 18px",
  borderRadius: 10,
  border: primary ? "none" : "1px solid #cfc6dc",
  background: primary ? "#5b2a86" : "#fff",
  color: primary ? "#fff" : "#3b1d5e",
  fontWeight: 700,
  fontSize: "0.95rem",
  cursor: "pointer"
});

/** Les boutons de la page /tache/[token] : je m'en occupe, c'est fait (note et lien facultatifs). */
export function TaskResponse({ token, initialStatus, initialNote, initialLink }: { token: string; initialStatus: Status; initialNote: string; initialLink: string }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [link, setLink] = useState(initialLink);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  if (status === "abandonne") {
    return <p style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #e6e0ee", margin: 0 }}>JP a repris cette tâche : tu n&apos;as plus rien à faire. Merci !</p>;
  }

  const send = async (next: Status) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch(`/api/tache/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next, note, evidenceUrl: link }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur");
      setStatus(next);
      setSaved(next === "fait" ? "Merci ! JP est avisé que c'est fait." : next === "en_cours" ? "Noté : JP sait que tu t'en occupes." : "Noté.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid #cfc6dc", padding: "10px 12px", fontSize: "1rem", fontFamily: "inherit" };
  return (
    <section style={{ background: "#fff", borderRadius: 14, padding: "18px", border: "1px solid #e6e0ee", display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        Où en es-tu ?{" "}
        <span style={{ fontWeight: 600, color: status === "fait" ? "#027a48" : status === "en_cours" ? "#b54708" : "#6b6478" }}>
          {status === "fait" ? "C'est fait" : status === "en_cours" ? "Tu t'en occupes" : "Pas encore commencée"}
        </span>
      </p>
      <label style={{ display: "grid", gap: 4, fontSize: "0.9rem", color: "#3b3550" }}>
        Note pour JP (facultatif)
        <textarea rows={3} style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que tu as fait, ce qui bloque, une question…" />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.9rem", color: "#3b3550" }}>
        Lien (document, photo, page), facultatif
        <input style={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {status !== "fait" ? (
          <button type="button" style={btn(true)} disabled={busy} onClick={() => send("fait")}>
            C&apos;est fait
          </button>
        ) : null}
        {status === "a_faire" ? (
          <button type="button" style={btn(false)} disabled={busy} onClick={() => send("en_cours")}>
            Je m&apos;en occupe
          </button>
        ) : null}
        {status === "fait" ? (
          <button type="button" style={btn(false)} disabled={busy} onClick={() => send("fait")}>
            Mettre à jour la note
          </button>
        ) : null}
      </div>
      {saved ? <p style={{ margin: 0, color: "#027a48", fontWeight: 600 }}>{saved}</p> : null}
      {error ? <p style={{ margin: 0, color: "#b42318", fontWeight: 600 }}>{error}</p> : null}
    </section>
  );
}
