"use client";

import { useState } from "react";

/** Ouvre le paiement Stripe du versement (page du lien envoyé à la famille). */
export function InstallmentPayButton({ source, id, cle, label }: { source: string; id: string; cle: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/paiement/versement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, id, cle }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (res?.ok && json?.url) {
      window.location.href = json.url;
      return;
    }
    setBusy(false);
    if (res?.status === 409) window.location.reload();
    else setError(json?.error ?? "Le paiement n'a pas pu s'ouvrir. Réessayez dans un instant.");
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" onClick={pay} disabled={busy} style={{ background: "#5b2a86", color: "#fff", border: 0, borderRadius: 12, padding: "14px 22px", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", minHeight: 48 }}>
        {busy ? "Ouverture du paiement…" : label}
      </button>
      {error && <p role="alert" style={{ margin: 0, color: "#a3261b" }}>{error}</p>}
    </div>
  );
}
