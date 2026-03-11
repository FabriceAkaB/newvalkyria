"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import type { CapacityData } from "@/lib/capacity";
import { AGE_CATEGORIES, CATEGORY_LABELS, CATEGORY_SUBLABELS } from "@/lib/categories";

interface Props {
  capacity: CapacityData;
}

export function AdminCapacite({ capacity }: Props) {
  const router = useRouter();

  const [maxValues, setMaxValues] = useState<Record<string, number>>(
    Object.fromEntries(AGE_CATEGORIES.map((cat) => [cat, capacity.byCategory[cat].max]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleStep = (cat: string, delta: number) => {
    setMaxValues((prev) => {
      const taken = capacity.byCategory[cat as keyof typeof capacity.byCategory].taken;
      const next = Math.max(taken, Math.min(99, (prev[cat] ?? taken) + delta));
      return { ...prev, [cat]: next };
    });
    setSaved((prev) => ({ ...prev, [cat]: false }));
  };

  const handleSave = async (cat: string) => {
    setSaving((prev) => ({ ...prev, [cat]: true }));
    setErrors((prev) => ({ ...prev, [cat]: "" }));
    try {
      const res = await fetch("/api/admin/capacity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, maxSpots: maxValues[cat] }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setSaved((prev) => ({ ...prev, [cat]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [cat]: false })), 2500);
      router.refresh();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [cat]: err instanceof Error ? err.message : "Erreur",
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [cat]: false }));
    }
  };

  const handleSaveAll = async () => {
    const changed = AGE_CATEGORIES.filter(
      (cat) => maxValues[cat] !== capacity.byCategory[cat].max
    );
    await Promise.all(changed.map((cat) => handleSave(cat)));
  };

  const hasAnyChanged = AGE_CATEGORIES.some(
    (cat) => maxValues[cat] !== capacity.byCategory[cat].max
  );

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <p className="admin-section-title" style={{ margin: 0 }}>
              Gestion de la capacité
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.3)",
                margin: "0.3rem 0 0",
              }}
            >
              Définissez le nombre de places disponibles par groupe d&apos;âge
            </p>
          </div>
          {hasAnyChanged && (
            <button onClick={handleSaveAll} className="admin-btn-primary">
              Sauvegarder tout
            </button>
          )}
        </div>

        {/* Capacity cards */}
        <div className="admin-cap-v2-grid">
          {AGE_CATEGORIES.map((cat) => {
            const cap = capacity.byCategory[cat];
            const localMax = maxValues[cat] ?? cap.max;
            const changed = localMax !== cap.max;
            const pct = Math.min(
              Math.round((cap.taken / Math.max(localMax, 1)) * 100),
              100
            );
            const isFull = cap.taken >= localMax;
            const remaining = localMax - cap.taken;

            return (
              <div
                key={cat}
                className="admin-cap-v2-card"
                data-changed={String(changed)}
              >
                {/* Header */}
                <div className="admin-cap-v2-header">
                  <p className="admin-cap-v2-cat">{CATEGORY_LABELS[cat]}</p>
                  <p className="admin-cap-v2-sub">{CATEGORY_SUBLABELS[cat]}</p>
                </div>

                {/* Enrolled count + bar */}
                <div className="admin-cap-v2-stats">
                  <p className="admin-cap-v2-enrolled">{cap.taken}</p>
                  <p className="admin-cap-v2-enrolled-label">
                    inscription{cap.taken !== 1 ? "s" : ""} confirmée
                    {cap.taken !== 1 ? "s" : ""}
                  </p>
                  <div className="admin-cap-v2-bar-track">
                    <div
                      className="admin-cap-v2-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: isFull
                          ? "rgba(248,113,113,0.7)"
                          : pct > 70
                            ? "rgba(251,191,36,0.7)"
                            : "rgba(196,164,228,0.7)",
                      }}
                    />
                  </div>
                </div>

                {/* Stepper */}
                <div>
                  <p
                    className="admin-cap-v2-step-label"
                    style={{ marginBottom: "0.6rem" }}
                  >
                    Nombre max de places
                  </p>
                  <div className="admin-cap-v2-stepper">
                    <button
                      className="admin-cap-v2-step-btn"
                      onClick={() => handleStep(cat, -1)}
                      disabled={localMax <= cap.taken}
                      aria-label="Diminuer"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={localMax}
                      min={cap.taken}
                      max={99}
                      onChange={(e) => {
                        const v = Math.max(
                          cap.taken,
                          Math.min(99, parseInt(e.target.value) || cap.taken)
                        );
                        setMaxValues((prev) => ({ ...prev, [cat]: v }));
                        setSaved((prev) => ({ ...prev, [cat]: false }));
                      }}
                      className="admin-cap-v2-step-value"
                      aria-label="Nombre maximum de places"
                    />
                    <button
                      className="admin-cap-v2-step-btn"
                      onClick={() => handleStep(cat, 1)}
                      disabled={localMax >= 99}
                      aria-label="Augmenter"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Footer */}
                <div className="admin-cap-v2-footer">
                  <div>
                    {isFull ? (
                      <span className="admin-cap-status-full">Groupe complet</span>
                    ) : (
                      <span className="admin-cap-status-ok">
                        {remaining} place{remaining > 1 ? "s" : ""} restante
                        {remaining > 1 ? "s" : ""}
                      </span>
                    )}
                    {errors[cat] && (
                      <p
                        className="admin-error"
                        style={{ marginTop: "0.3rem", textAlign: "left" }}
                      >
                        {errors[cat]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave(cat)}
                    disabled={saving[cat] || !changed}
                    className="admin-cap-save-btn"
                    style={{
                      opacity: !changed ? 0 : 1,
                      transition: "opacity 0.2s",
                      pointerEvents: !changed ? "none" : "auto",
                    }}
                  >
                    {saving[cat] ? "…" : saved[cat] ? "✓ Sauvegardé" : "Sauvegarder"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info note */}
        <div
          style={{
            background: "rgba(196,164,228,0.04)",
            border: "1px solid rgba(196,164,228,0.1)",
            borderRadius: "0.875rem",
            padding: "1.25rem 1.5rem",
            marginTop: "1rem",
          }}
        >
          <p
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "rgba(196,164,228,0.5)",
              margin: "0 0 0.5rem",
            }}
          >
            À noter
          </p>
          <p
            style={{
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.35)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Le minimum de places ne peut être inférieur au nombre de joueuses déjà
            confirmées. Lorsqu&apos;un groupe est complet, les nouvelles inscriptions sont
            automatiquement dirigées vers la liste d&apos;attente sans paiement.
          </p>
        </div>
      </div>
    </>
  );
}
