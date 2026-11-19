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
export function TrainingModuleCard({ module, state, index, open = true }: { module: TrainingModule; state: ModuleState; index: number; open?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const read = async () => {
    setBusy(true);
    const res = await fetch("/api/coach/formation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: module.key }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return alert("Pas enregistré : réessaie.");
    router.refresh();
  };
  if (!open) {
    return (
      <div className="coach-card" style={{ display: "grid", gap: 6, opacity: 0.7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          <p className="coach-card__label" style={{ margin: 0 }}>Module {index + 1}</p>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--adm-text-3)" }}>Bientôt disponible</span>
        </div>
        <h2 className="coach-h2" style={{ margin: 0 }}>{module.title}</h2>
        <p className="coach-sub" style={{ margin: 0 }}>{module.why}</p>
      </div>
    );
  }
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

/** JP écrit le plan de développement d'un éducateur (Suivi des éducateurs) ; il le lit dans « Mon dossier ». */
export function DevelopmentPlanEditor({ coachId, name, initial }: { coachId: string; name: string; initial: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  if (!open)
    return (
      <button type="button" className="admin-btn-ghost" onClick={() => setOpen(true)}>
        {initial ? "Voir / modifier" : "Écrire le plan"}
      </button>
    );
  const save = async () => {
    setState("saving");
    const res = await fetch("/api/admin/entraineurs/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coachId, plan }) }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  };
  return (
    <div style={{ display: "grid", gap: 6, minWidth: 260 }}>
      <textarea className="admin-input" rows={4} value={plan} maxLength={3000} onChange={(e) => { setPlan(e.target.value); setState("idle"); }} placeholder={`Ex. pour ${name} : diplôme C d'ici l'été, animer seule le bloc ball mastery en décembre, observation filmée en janvier.`} />
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="admin-btn-primary" disabled={state === "saving"} onClick={save}>{state === "saving" ? "…" : "Enregistrer"}</button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
        <span style={{ fontSize: "0.8rem", color: state === "error" ? "var(--adm-bad)" : "var(--adm-good)" }}>{state === "saved" ? "Enregistré : visible dans son dossier" : state === "error" ? "Pas enregistré" : ""}</span>
      </span>
    </div>
  );
}

/** JP ouvre ou ferme un module pour tous les éducateurs (admin, Suivi des éducateurs). */
export function ModuleOpenToggle({ module, open, title }: { module: string; open: boolean; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    const res = await fetch("/api/admin/entraineurs/formation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, open: !open }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return alert("Pas enregistré : réessaie.");
    router.refresh();
  };
  return (
    <button type="button" className={open ? "admin-btn-primary" : "admin-btn-ghost"} style={{ padding: "2px 8px", fontSize: "0.72rem" }} disabled={busy} onClick={toggle} title={open ? `Fermer « ${title} »` : `Ouvrir « ${title} » à tous les éducateurs`}>
      {open ? "Ouvert" : "Fermé"}
    </button>
  );
}
