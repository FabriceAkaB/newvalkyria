"use client";

import { useState } from "react";

interface DirectCheckoutResponse {
  checkoutUrl: string;
}

export function DirectStripePay() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDirectPay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; checkoutUrl?: string };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Impossible de démarrer le paiement Stripe.");
      }

      const payload = data as DirectCheckoutResponse;
      window.location.href = payload.checkoutUrl;
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : "Erreur Stripe";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleDirectPay} className="direct-pay-card">
      <p className="direct-pay-kicker">Paiement direct Stripe</p>
      <p className="direct-pay-title">Payer maintenant</p>
      <p className="direct-pay-text">Vous serez redirigé vers Stripe pour finaliser le paiement en toute sécurité.</p>

      <label className="direct-pay-field">
        <span>Courriel (optionnel)</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="parent@exemple.com"
          className="direct-pay-input"
        />
      </label>

      {error ? <p className="direct-pay-error">{error}</p> : null}

      <button type="submit" disabled={loading} className="direct-pay-button">
        {loading ? "Ouverture de Stripe..." : "Payer via Stripe"}
      </button>
    </form>
  );
}
