"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Relit tout de suite le calendrier MonClubSportif de la saison (1 à 3 minutes). */
export function DeliveryRefresh() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="admin-btn-ghost"
        disabled={busy}
        style={{ minHeight: 44 }}
        onClick={async () => {
          setBusy(true);
          setMsg("Lecture de MonClubSportif… (1 à 3 minutes)");
          const res = await fetch("/api/admin/promesses", { method: "POST" }).catch(() => null);
          const data = await res?.json().catch(() => null);
          setBusy(false);
          setMsg(res?.ok ? `À jour : ${data?.events ?? 0} activités relues dans ${data?.teams ?? 0} équipes.` : data?.error ?? "Lecture impossible, réessaie.");
          if (res?.ok) router.refresh();
        }}
      >
        {busy ? "Lecture en cours…" : "Recalculer maintenant"}
      </button>
      {msg && <span className="mda-muted" style={{ fontSize: "0.85rem" }}>{msg}</span>}
    </div>
  );
}
