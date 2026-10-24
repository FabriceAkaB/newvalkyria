"use client";

import { useState } from "react";

/** Bouton « Payer » d'une offre spéciale : crée la session Stripe au clic (jamais à l'ouverture du courriel). */
export function SpecialOfferPay({ token, label }: { token: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offre/${token}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) throw new Error(json?.error ?? "Erreur. Réessayez.");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        style={{ width: "100%", background: "#5b2a86", color: "#fff", border: "none", borderRadius: 12, padding: "1rem", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
      >
        {busy ? "Ouverture du paiement sécurisé…" : label}
      </button>
      {error && <p style={{ color: "#9b1c1c", background: "#fff0f0", borderRadius: 10, padding: ".7rem .9rem", marginTop: ".8rem" }}>{error}</p>}
    </div>
  );
}
