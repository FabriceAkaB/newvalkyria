"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LabStatus } from "@/lib/coach-lab-core";

/** Décision de JP sur une expérience du laboratoire. */
export function LabDecision({ id, status }: { id: string; status: LabStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (action: "methode" | "abandonner" | "reprendre") => {
    if (action === "methode" && !confirm("Ajouter cette idée aux principes de la méthode Valkyria ?")) return;
    setBusy(true);
    await fetch(`/api/admin/coaching/laboratoire/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    setBusy(false);
    router.refresh();
  };
  if (status === "dans_methode") return <span className="mda-pill" data-tone="good">Dans la méthode</span>;
  return (
    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {status === "abandonne" ? (
        <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => act("reprendre")}>Remettre à l&apos;essai</button>
      ) : (
        <>
          <button type="button" className={status === "concluant" ? "admin-btn-primary" : "admin-btn-ghost"} disabled={busy} onClick={() => act("methode")}>Ajouter à la méthode</button>
          <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => act("abandonner")}>Abandonner</button>
        </>
      )}
    </span>
  );
}
