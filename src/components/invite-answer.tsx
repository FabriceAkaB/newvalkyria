"use client";

import { useState } from "react";

/** Oui / Non à l'invitation à la pratique de l'avancé (page du lien envoyé au parent). */
export function InviteAnswer({ token, initial, girl }: { token: string; initial: string; girl: string }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answer = async (accept: boolean) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invitation/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (res?.ok && json?.status) setStatus(json.status);
    else setError("La réponse n'est pas passée. Réessayez dans un instant.");
  };
  const btn = (primary: boolean) => ({ background: primary ? "#5b2a86" : "#fff", color: primary ? "#fff" : "#3b1d5e", border: primary ? 0 : "1px solid #cfc5dd", borderRadius: 12, padding: "14px 20px", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", minHeight: 48, flex: 1 });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {status === "acceptee" && <p style={{ margin: 0, fontWeight: 700, color: "#1f6b3a" }}>Merci ! {girl} est inscrite à cette pratique. Elle apparaîtra dans MonClubSportif.</p>}
      {status === "refusee" && <p style={{ margin: 0, fontWeight: 700, color: "#5d566b" }}>C&apos;est noté, merci de nous avoir répondu. Ce sera pour une prochaine fois !</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" disabled={busy || status === "acceptee"} onClick={() => answer(true)} style={btn(true)}>{status === "acceptee" ? "✓ Elle sera là" : "Oui, elle sera là"}</button>
        <button type="button" disabled={busy || status === "refusee"} onClick={() => answer(false)} style={btn(false)}>{status === "refusee" ? "✓ Pas cette fois" : "Non, pas cette fois"}</button>
      </div>
      {error && <p role="alert" style={{ margin: 0, color: "#a3261b" }}>{error}</p>}
    </div>
  );
}
