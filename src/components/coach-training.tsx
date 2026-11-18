"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ModuleState, TrainingModule } from "@/lib/coach-training";

const STATE: Record<ModuleState, { label: string; tone: string }> = {
  a_lire: { label: "À lire", tone: "var(--adm-text-3)" },
  a_valider: { label: "Lu · JP valide après t'avoir observé", tone: "var(--adm-warn)" },
  valide: { label: "Validé par JP ✓", tone: "var(--adm-good)" }
};

/** Un module de « Ma formation » (portail des éducateurs). */
export function TrainingModuleCard({ module, state, index }: { module: TrainingModule; state: ModuleState; index: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const read = async () => {
    setBusy(true);
    const res = await fetch("/api/coach/formation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: module.key }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return alert("Pas enregistré : réessaie.");
    router.refresh();
  };
  return (
    <div className="coach-card" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <p className="coach-card__label" style={{ margin: 0 }}>Module {index + 1}</p>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: STATE[state].tone }}>{STATE[state].label}</span>
      </div>
      <h2 className="coach-h2" style={{ margin: 0 }}>{module.title}</h2>
      <p className="coach-sub" style={{ margin: 0 }}>{module.why}</p>
      <p className="coach-muted" style={{ margin: 0 }}>Validation : {module.check}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <Link href={module.href} className="admin-btn-ghost" style={{ textDecoration: "none" }}>Lire le module →</Link>
        {state === "a_lire" ? (
          <button type="button" className="admin-btn-primary" disabled={busy} onClick={read}>{busy ? "…" : "J'ai lu et compris"}</button>
        ) : null}
      </div>
    </div>
  );
}

/** JP valide un module après observation (admin, Suivi des éducateurs). */
export function ValidateModule({ coachId, module, state, title }: { coachId: string; module: string; state: ModuleState; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const on = state !== "valide";
    if (!confirm(on ? `Valider « ${title} » ?` : `Retirer la validation de « ${title} » ?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/entraineurs/formation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coachId, module, on }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return alert("Pas enregistré : réessaie.");
    router.refresh();
  };
  const sym = state === "valide" ? "✓" : state === "a_valider" ? "●" : "○";
  const color = state === "valide" ? "var(--adm-good)" : state === "a_valider" ? "var(--adm-warn)" : "var(--adm-text-3)";
  return (
    <button type="button" onClick={toggle} disabled={busy} title={`${title} : ${state === "valide" ? "validé" : state === "a_valider" ? "lu, à valider" : "pas encore lu"}`} style={{ border: 0, background: "none", cursor: "pointer", color, fontSize: "1.05rem", fontWeight: 700, minWidth: 28, minHeight: 28 }}>
      {sym}
    </button>
  );
}
