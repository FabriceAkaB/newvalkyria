"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Une condition à cocher à la main avant de lancer un projet (lieu, éducateurs, assurance…). */
export function FinanceRequirement({ scenarioId, requirement, label, hint, done }: { scenarioId: string; requirement: string; label: string; hint?: string; done: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(done);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    const res = await fetch("/api/admin/projets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "requis", scenarioId, requirement, done: next }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) setOn(!next);
    else router.refresh();
  }
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: busy ? "wait" : "pointer", padding: "4px 0" }} title={hint}>
      <input type="checkbox" checked={on} onChange={toggle} disabled={busy} style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--adm-accent)" }} />
      <span style={{ fontSize: "0.8125rem", color: on ? "var(--adm-text-3)" : "var(--adm-text)", textDecoration: on ? "line-through" : "none" }}>{label}</span>
    </label>
  );
}
