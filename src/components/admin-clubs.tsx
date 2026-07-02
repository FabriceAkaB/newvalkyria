"use client";

import { useEffect, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { ClubGroup } from "@/lib/club-aliases-store";

interface Props {
  allRawClubs: string[];
}

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function AdminClubs({ allRawClubs }: Props) {
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing groups
  useEffect(() => {
    fetch("/api/admin/clubs")
      .then((r) => r.json())
      .then((data: { groups: ClubGroup[] }) => {
        setGroups(data.groups ?? []);
      })
      .catch(() => setError("Impossible de charger les groupes"))
      .finally(() => setLoading(false));
  }, []);

  // All raw clubs that are NOT yet assigned to any group
  const assignedKeys = new Set<string>();
  for (const g of groups) {
    assignedKeys.add(normalizeKey(g.canonical));
    for (const a of g.aliases) assignedKeys.add(normalizeKey(a));
  }
  const ungroupedClubs = allRawClubs.filter((c) => !assignedKeys.has(normalizeKey(c)));

  const handleAddGroup = () => {
    setGroups((prev) => [...prev, { canonical: "", aliases: [] }]);
  };

  const handleRemoveGroup = (idx: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCanonicalChange = (idx: number, value: string) => {
    setGroups((prev) => prev.map((g, i) => i === idx ? { ...g, canonical: value } : g));
  };

  const handleAddAlias = (idx: number, alias: string) => {
    if (!alias.trim()) return;
    setGroups((prev) => prev.map((g, i) =>
      i === idx ? { ...g, aliases: [...g.aliases, alias.trim()] } : g
    ));
  };

  const handleRemoveAlias = (idx: number, aliasIdx: number) => {
    setGroups((prev) => prev.map((g, i) =>
      i === idx ? { ...g, aliases: g.aliases.filter((_, ai) => ai !== aliasIdx) } : g
    ));
  };

  const handleQuickAssign = (groupIdx: number, club: string) => {
    handleAddAlias(groupIdx, club);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveOk(false);
    try {
      const res = await fetch("/api/admin/clubs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groups.filter((g) => g.canonical.trim()) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur de sauvegarde");
      }
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <AdminTopbar />
        <div className="admin-content">
          <div className="admin-section">
            <p style={{ color: "#6d6b71" }}>Chargement...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>
              Regroupement des clubs
            </p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {saveOk && <span style={{ color: "#9ec99e", fontSize: "0.75rem" }}>✓ Sauvegardé</span>}
              <button onClick={handleAddGroup} className="admin-btn-ghost" style={{ padding: "0.45rem 0.85rem", fontSize: "0.78rem" }}>
                + Nouveau groupe
              </button>
              <button onClick={handleSave} disabled={saving} className="admin-btn-primary" style={{ padding: "0.45rem 1rem", fontSize: "0.78rem" }}>
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </div>

          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem", lineHeight: 1.55 }}>
            Regroupez les différentes orthographes d'un même club. Par exemple : « FC Laval », « fc laval », « f.c. laval » → un seul groupe canonique « FC Laval ».
            Les filtres et l'export utiliseront automatiquement le nom canonique.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {/* Groups list */}
          {groups.length === 0 && (
            <div style={{ padding: "1.5rem", border: "1px dashed #23222a", borderRadius: "8px", textAlign: "center", color: "#605f65", fontSize: "0.85rem" }}>
              Aucun groupe créé. Cliquez sur « + Nouveau groupe » pour commencer.
            </div>
          )}

          {groups.map((group, idx) => (
            <div
              key={idx}
              style={{
                background: "#100e17",
                border: "1px solid #1f1d25",
                borderRadius: "10px",
                padding: "1rem 1.2rem",
                marginBottom: "0.85rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.85rem" }}>
                <input
                  type="text"
                  placeholder="Nom canonique du club (ex: FC Laval)"
                  value={group.canonical}
                  onChange={(e) => handleCanonicalChange(idx, e.target.value)}
                  className="qual-input"
                  style={{ flex: 1, fontWeight: 600, fontSize: "0.95rem" }}
                />
                <button
                  onClick={() => handleRemoveGroup(idx)}
                  style={{
                    padding: "0.45rem 0.7rem",
                    background: "transparent",
                    border: "1px solid rgba(255,100,100,0.3)",
                    color: "rgba(255,150,150,0.8)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.72rem",
                  }}
                  title="Supprimer le groupe"
                >
                  ✕ Supprimer
                </button>
              </div>

              {/* Existing aliases */}
              <div style={{ marginBottom: "0.6rem" }}>
                <p style={{ fontSize: "0.68rem", color: "#6d6b71", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
                  Variantes ({group.aliases.length})
                </p>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {group.aliases.length === 0 && (
                    <span style={{ fontSize: "0.75rem", color: "#48474d", fontStyle: "italic" }}>
                      Aucune variante
                    </span>
                  )}
                  {group.aliases.map((alias, ai) => (
                    <span
                      key={ai}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.3rem 0.6rem",
                        background: "#211c2b",
                        border: "1px solid #393047",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        color: "#e0d4f0",
                      }}
                    >
                      {alias}
                      <button
                        onClick={() => handleRemoveAlias(idx, ai)}
                        style={{ background: "none", border: "none", color: "#858489", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}
                        title="Retirer cette variante"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick add from ungrouped clubs */}
              {ungroupedClubs.length > 0 && (
                <details style={{ marginTop: "0.6rem" }}>
                  <summary style={{ fontSize: "0.7rem", color: "#8d76a5", cursor: "pointer", padding: "0.3rem 0" }}>
                    + Ajouter depuis les clubs non assignés ({ungroupedClubs.length})
                  </summary>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
                    {ungroupedClubs.map((c) => (
                      <button
                        key={c}
                        onClick={() => handleQuickAssign(idx, c)}
                        style={{
                          padding: "0.25rem 0.55rem",
                          background: "#15131b",
                          border: "1px solid #23222a",
                          borderRadius: "12px",
                          fontSize: "0.7rem",
                          color: "#9d9da0",
                          cursor: "pointer",
                        }}
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}

          {/* Ungrouped clubs section */}
          {ungroupedClubs.length > 0 && (
            <div style={{ marginTop: "2rem", padding: "1rem 1.2rem", background: "#151115", border: "1px solid #30261e", borderRadius: "8px" }}>
              <p style={{ fontSize: "0.78rem", color: "#f0c878", marginBottom: "0.5rem", fontWeight: 600 }}>
                ⚠ Clubs non assignés ({ungroupedClubs.length})
              </p>
              <p style={{ fontSize: "0.7rem", color: "#6d6b71", marginBottom: "0.6rem" }}>
                Ces clubs apparaissent dans les inscriptions mais ne sont assignés à aucun groupe.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {ungroupedClubs.map((c) => (
                  <span
                    key={c}
                    style={{
                      padding: "0.25rem 0.55rem",
                      background: "#15131b",
                      border: "1px solid #23222a",
                      borderRadius: "12px",
                      fontSize: "0.72rem",
                      color: "#919094",
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
