"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BirthCategory, Program, ProgramCategoryCapacity, Registration, Season } from "@/lib/season-admin-repo";

interface Props {
  season: Season;
  categories: BirthCategory[];
  programs: Program[];
  programCategories: ProgramCategoryCapacity[];
  registrations: Registration[];
}

function key(programId: string, categoryId: string) {
  return `${programId}::${categoryId}`;
}

export function AdminSaisonCapacite({ season, categories, programs, programCategories, registrations }: Props) {
  const [maxValues, setMaxValues] = useState<Record<string, number>>(
    Object.fromEntries(programCategories.map((pc) => [key(pc.program_id, pc.category_id), pc.max_places]))
  );
  const [committed, setCommitted] = useState<Record<string, number>>(
    Object.fromEntries(programCategories.map((pc) => [key(pc.program_id, pc.category_id), pc.max_places]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const active = registrations.filter((r) => r.status !== "cancelled");

  const takenFor = (programId: string, categoryId: string) =>
    active.filter((r) => r.program_id === programId && r.category_id === categoryId).length;

  const handleStep = (programId: string, categoryId: string, delta: number) => {
    const k = key(programId, categoryId);
    const taken = takenFor(programId, categoryId);
    setMaxValues((prev) => ({ ...prev, [k]: Math.max(taken, Math.min(99, (prev[k] ?? taken) + delta)) }));
    setSaved((prev) => ({ ...prev, [k]: false }));
  };

  const handleSave = async (programId: string, categoryId: string) => {
    const k = key(programId, categoryId);
    setSaving((prev) => ({ ...prev, [k]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${season.id}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "program", programId, categoryId, maxPlaces: maxValues[k] })
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setCommitted((prev) => ({ ...prev, [k]: maxValues[k] }));
      setSaved((prev) => ({ ...prev, [k]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [k]: false })), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving((prev) => ({ ...prev, [k]: false }));
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Capacité par programme et catégorie</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Modifiez le nombre maximal de places pour chaque combinaison programme × catégorie d&apos;âge — public ou avancé.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {programs.map((program) => {
            const rows = programCategories.filter((pc) => pc.program_id === program.id);
            if (rows.length === 0) return null;
            return (
              <div key={program.id} style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
                  <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", margin: 0 }}>{program.name}</p>
                  <span style={{ fontSize: "0.62rem", color: "#9f85ba", background: "rgba(159,133,186,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>{program.id}</span>
                  {program.invitation && (
                    <span style={{ fontSize: "0.6rem", color: "#f0c878", background: "rgba(240,200,120,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>Sur invitation</span>
                  )}
                </div>
                <div className="admin-cap-v2-grid">
                  {rows.map((pc) => {
                    const k = key(pc.program_id, pc.category_id);
                    const cat = categories.find((c) => c.id === pc.category_id);
                    const taken = takenFor(pc.program_id, pc.category_id);
                    const localMax = maxValues[k] ?? committed[k];
                    const changed = localMax !== committed[k];
                    const isFull = taken >= localMax;
                    const remaining = localMax - taken;
                    const pct = Math.min(Math.round((taken / Math.max(localMax, 1)) * 100), 100);

                    return (
                      <div key={k} className="admin-cap-v2-card" data-changed={String(changed)}>
                        <div className="admin-cap-v2-header">
                          <p className="admin-cap-v2-cat">{cat?.label ?? pc.category_id}</p>
                        </div>
                        <div className="admin-cap-v2-stats">
                          <p className="admin-cap-v2-enrolled">{taken}</p>
                          <p className="admin-cap-v2-enrolled-label">inscrite{taken !== 1 ? "s" : ""}</p>
                          <div className="admin-cap-v2-bar-track">
                            <div
                              className="admin-cap-v2-bar-fill"
                              style={{ width: `${pct}%`, background: isFull ? "rgba(248,113,113,0.7)" : pct > 70 ? "rgba(251,191,36,0.7)" : "#8d76a5" }}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="admin-cap-v2-step-label" style={{ marginBottom: "0.6rem" }}>Nombre max de places</p>
                          <div className="admin-cap-v2-stepper">
                            <button className="admin-cap-v2-step-btn" onClick={() => handleStep(pc.program_id, pc.category_id, -1)} disabled={localMax <= taken} aria-label="Diminuer">−</button>
                            <input
                              type="number"
                              value={localMax}
                              min={taken}
                              max={99}
                              onChange={(e) => {
                                const v = Math.max(taken, Math.min(99, parseInt(e.target.value) || taken));
                                setMaxValues((prev) => ({ ...prev, [k]: v }));
                                setSaved((prev) => ({ ...prev, [k]: false }));
                              }}
                              className="admin-cap-v2-step-value"
                            />
                            <button className="admin-cap-v2-step-btn" onClick={() => handleStep(pc.program_id, pc.category_id, 1)} disabled={localMax >= 99} aria-label="Augmenter">+</button>
                          </div>
                        </div>
                        <div className="admin-cap-v2-footer">
                          {isFull ? (
                            <span className="admin-cap-status-full">Complet</span>
                          ) : (
                            <span className="admin-cap-status-ok">{remaining} place{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}</span>
                          )}
                          <button
                            onClick={() => handleSave(pc.program_id, pc.category_id)}
                            disabled={saving[k] || !changed}
                            className="admin-cap-save-btn"
                            style={{ opacity: !changed ? 0 : 1, pointerEvents: !changed ? "none" : "auto" }}
                          >
                            {saving[k] ? "…" : saved[k] ? "✓ Sauvegardé" : "Sauvegarder"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
