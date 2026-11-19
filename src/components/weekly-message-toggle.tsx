"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Interrupteur Actif / Inactif du message de la semaine aux parents. Inactif = mode assistant (rien ne part). */
export function WeeklyMessageToggle({ initial, when }: { initial: boolean; when: string }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flip = async () => {
    const next = !on;
    if (next && !window.confirm(`Activer l'envoi ? Le message partira à toutes les familles chaque ${when}, avec une copie à Christine.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/communications/message-hebdo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: next }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Pas enregistré : réessayez.");
    setOn(next);
    router.refresh();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Envoi automatique du message de la semaine"
        disabled={busy}
        onClick={flip}
        style={{
          position: "relative",
          width: 46,
          height: 26,
          borderRadius: 999,
          border: "1px solid var(--adm-border)",
          background: on ? "var(--adm-accent)" : "var(--adm-surface-3)",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          padding: 0,
          transition: "background 0.15s"
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: on ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: on ? "var(--adm-on-accent)" : "var(--adm-surface)",
            boxShadow: "var(--adm-shadow)",
            transition: "left 0.15s"
          }}
        />
      </button>
      <span style={{ fontWeight: 600, color: on ? "var(--adm-good)" : "var(--adm-text-2)" }}>{on ? "Actif" : "Inactif (mode assistant)"}</span>
      {error ? (
        <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
