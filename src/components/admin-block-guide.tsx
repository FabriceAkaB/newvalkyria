"use client";

import { useState } from "react";

import { exerciseGuideFallback } from "@/lib/practice-plan-view";
import { BLOCK_GUIDE_FIELDS, type BlockGuideKey, type SessionBlock } from "@/lib/session-plan-repo";

export { exerciseGuideFallback };

/** Pratique du jour d'un bloc, préparée par JP : montage, matériel, qui fait quoi, points clés, variantes, progressions. */
export function AdminBlockGuide({ activityId, block, exercise }: { activityId: string; block: SessionBlock; exercise?: Record<string, unknown> | null }) {
  const fallback = exerciseGuideFallback(exercise);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<BlockGuideKey, string>>(
    Object.fromEntries(BLOCK_GUIDE_FIELDS.map((f) => [f.key, (block[f.key] as string | null | undefined) ?? ""])) as Record<BlockGuideKey, string>
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [everywhere, setEverywhere] = useState(false);
  const [spread, setSpread] = useState<number | null>(null);
  const exerciseId = block.exercise_id;
  const filled = BLOCK_GUIDE_FIELDS.filter((f) => values[f.key].trim() || fallback[f.key]).length;

  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/admin/coach-activities/${activityId}/blocks/${block.id}/guide`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, everywhere: everywhere && Boolean(exerciseId) })
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setSpread(typeof data?.everywhere === "number" ? data.everywhere : null);
    setState(res?.ok ? "saved" : "error");
  };

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}>
        {open ? "Fermer" : "Pratique du jour"} · {filled}/{BLOCK_GUIDE_FIELDS.length}
      </button>
      {open && (
        <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.6rem" }}>
          {BLOCK_GUIDE_FIELDS.map((f) => (
            <label key={f.key} style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--adm-text-2)" }}>{f.label}</span>
              <textarea
                className="admin-input"
                rows={2}
                value={values[f.key]}
                placeholder={fallback[f.key] ? `Fiche de l'exercice : ${fallback[f.key]}` : f.key === "roles" ? "Ex. Maeva : explique et anime · Will : filme et corrige les appuis" : ""}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setState("idle");
                }}
              />
            </label>
          ))}
          {exerciseId ? (
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.78rem", color: "var(--adm-text-2)" }}>
              <input type="checkbox" checked={everywhere} onChange={(e) => (setEverywhere(e.target.checked), setState("idle"))} style={{ marginTop: 2 }} />
              <span>
                <strong style={{ color: "var(--adm-text)" }}>Appliquer partout</strong> : la fiche de l&apos;exercice dans la banque et toutes les pratiques à venir qui l&apos;utilisent (les pratiques passées ne changent pas).{" "}
                <a href={`/admin/exercices/${exerciseId}`} style={{ color: "var(--adm-accent)" }}>Modifier toute la fiche ↗</a>
              </span>
            </label>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button type="button" className="admin-btn-primary" onClick={save} disabled={state === "saving"} style={{ fontSize: "0.78rem" }}>
              {state === "saving" ? "Enregistrement…" : "Enregistrer"}
            </button>
            {state === "saved" && (
              <span style={{ fontSize: "0.78rem", color: "var(--adm-good)" }}>
                {spread !== null ? `Appliqué partout : la fiche de la banque et ${spread} pratique${spread > 1 ? "s" : ""} à venir.` : "Enregistré : l'éducateur le verra en arrivant."}
              </span>
            )}
            {state === "error" && <span style={{ fontSize: "0.78rem", color: "var(--adm-bad)" }}>Pas enregistré. Réessaie.</span>}
          </div>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--adm-text-3)" }}>Un champ vide reprend la fiche de l&apos;exercice.</p>
        </div>
      )}
    </div>
  );
}
