"use client";

import { useState } from "react";

import { BLOCK_GUIDE_FIELDS, type BlockGuideKey, type SessionBlock } from "@/lib/session-plan-repo";

/** Ce que la fiche de l'exercice dit déjà pour chaque champ (affiché en indice : rien à recopier). */
export function exerciseGuideFallback(exercise: Record<string, unknown> | null | undefined): Partial<Record<BlockGuideKey, string>> {
  if (!exercise) return {};
  const txt = (...keys: string[]) =>
    keys
      .map((k) => exercise[k])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join("\n") || undefined;
  const variants = [
    exercise.variant_easier ? `Plus facile : ${exercise.variant_easier}` : null,
    exercise.variant_harder ? `Plus difficile : ${exercise.variant_harder}` : null,
    exercise.variant_cognitive ? `Cognitive : ${exercise.variant_cognitive}` : null
  ].filter(Boolean);
  return {
    setup: txt("dimensions", "setup_8_10"),
    material: txt("material"),
    key_points: txt("coaching_points"),
    variants: variants.length ? variants.join("\n") : txt("variants"),
    progressions: txt("progression", "progressions")
  };
}

/** Pratique du jour d'un bloc, préparée par JP : montage, matériel, qui fait quoi, points clés, variantes, progressions. */
export function AdminBlockGuide({ activityId, block, exercise }: { activityId: string; block: SessionBlock; exercise?: Record<string, unknown> | null }) {
  const fallback = exerciseGuideFallback(exercise);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<BlockGuideKey, string>>(
    Object.fromEntries(BLOCK_GUIDE_FIELDS.map((f) => [f.key, (block[f.key] as string | null | undefined) ?? ""])) as Record<BlockGuideKey, string>
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const filled = BLOCK_GUIDE_FIELDS.filter((f) => values[f.key].trim() || fallback[f.key]).length;

  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/admin/coach-activities/${activityId}/blocks/${block.id}/guide`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    }).catch(() => null);
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button type="button" className="admin-btn-primary" onClick={save} disabled={state === "saving"} style={{ fontSize: "0.78rem" }}>
              {state === "saving" ? "Enregistrement…" : "Enregistrer"}
            </button>
            {state === "saved" && <span style={{ fontSize: "0.78rem", color: "var(--adm-good)" }}>Enregistré : l&apos;éducateur le verra en arrivant.</span>}
            {state === "error" && <span style={{ fontSize: "0.78rem", color: "var(--adm-bad)" }}>Pas enregistré. Réessaie.</span>}
          </div>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--adm-text-3)" }}>Un champ vide reprend la fiche de l&apos;exercice.</p>
        </div>
      )}
    </div>
  );
}
