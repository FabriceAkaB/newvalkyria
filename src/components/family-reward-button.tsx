"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** « Je veux cette récompense » : les points sont retirés tout de suite et l'équipe prépare la récompense. */
export function RewardRequestButton({ registrationId, rewardId, name, cost, firstName, missing }: { registrationId: string; rewardId: string; name: string; cost: number; firstName: string; missing: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (missing > 0) return <span className="fam-reward__missing">Encore {missing} points</span>;
  const ask = async () => {
    if (!confirm(`Échanger ${cost} points de ${firstName} contre « ${name} » ?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/compte/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, rewardId }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Pas envoyé : réessayez.");
    router.refresh();
  };
  return (
    <>
      <button type="button" className="fam-reward__btn" disabled={busy} onClick={ask}>{busy ? "Envoi…" : "Je veux cette récompense"}</button>
      {error ? <span className="fam-reward__error" role="alert">{error}</span> : null}
    </>
  );
}
