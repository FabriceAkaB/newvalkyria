"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Annule un envoi programmé (toute la campagne) avant son heure. */
export function ScheduledEmailCancel({ campaign }: { campaign: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="admin-btn-ghost"
      disabled={busy}
      style={{ color: "var(--adm-bad)", minHeight: 40 }}
      onClick={async () => {
        if (!confirm("Annuler cet envoi ? Aucun de ces courriels ne partira.")) return;
        setBusy(true);
        await fetch("/api/admin/courriels-programmes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign }) }).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
    >
      Annuler l&apos;envoi
    </button>
  );
}
