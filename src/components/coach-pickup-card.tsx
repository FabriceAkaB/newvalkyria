"use client";

import { Gift, Package } from "lucide-react";
import { useState } from "react";

import { GIFT_NOTE } from "@/lib/shop-pickup-core";
import type { ActivityPickup } from "@/lib/shop-pickup-repo";

/** Colis de la boutique à remettre à cette séance (choisie par le parent, JP 25 nov. 2026). Cadeau : remise discrète. */
export function CoachPickupCard({ activityId, pickups, isToday }: { activityId: string; pickups: ActivityPickup[]; isToday: boolean }) {
  const [done, setDone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (pickups.length === 0) return null;

  const deliver = async (orderId: string) => {
    setBusy(orderId);
    setError(null);
    const res = await fetch(`/api/coach/activities/${activityId}/colis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) }).catch(() => null);
    setBusy(null);
    if (res?.ok) setDone((d) => [...d, orderId]);
    else setError((await res?.json().catch(() => null))?.error ?? "La remise n'est pas passée. Réessaie.");
  };

  return (
    <div className="coach-card" style={{ marginTop: 16 }}>
      <p className="coach-card__label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Package size={15} aria-hidden /> {isToday ? "Colis à remettre aujourd'hui" : "Colis à remettre à cette séance"} ({pickups.length})
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {pickups.map((p) => {
          const given = done.includes(p.id);
          return (
            <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid var(--adm-line)", paddingTop: 10 }}>
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                  {p.parentName}
                  {p.playerName ? <span className="coach-muted"> · parent de {p.playerName}</span> : null}
                </p>
                <p className="coach-muted" style={{ margin: "2px 0 0" }}>{p.items}{p.parentPhone ? ` · ${p.parentPhone}` : ""}</p>
                {p.isGift && (
                  <p style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 6, color: "var(--adm-warn)", fontWeight: 600, fontSize: "0.85rem" }}>
                    <Gift size={14} aria-hidden /> {GIFT_NOTE}
                  </p>
                )}
              </div>
              {given ? (
                <span style={{ color: "var(--adm-good)", fontWeight: 600 }}>Remis</span>
              ) : (
                <button type="button" className="coach-primary" disabled={busy === p.id} onClick={() => deliver(p.id)}>
                  {busy === p.id ? "…" : "Remis"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" style={{ margin: "8px 0 0", color: "var(--adm-bad)" }}>{error}</p>}
    </div>
  );
}
