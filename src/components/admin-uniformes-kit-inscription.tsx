"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { UniformKitRow } from "@/lib/uniform-kits-repo";

/** Le nom "remis par" est déduit du compte connecté — jamais saisi à la
 *  main, pour que ce soit toujours fiable. */
const DELIVERED_BY_LABEL: Record<"admin" | "gerante", string> = {
  admin: "JP",
  gerante: "Gérante"
};

interface Props {
  initialRows: UniformKitRow[];
  initialSeasonFilter?: string;
}

function RowActions({ row, deliveredByName, onChanged }: { row: UniformKitRow; deliveredByName: string | null; onChanged: (patch: Partial<UniformKitRow>) => void }) {
  const [saving, setSaving] = useState(false);

  const confirmDelivered = async () => {
    if (!deliveredByName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/uniform-kits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonKey: row.seasonKey, sourceType: row.sourceType, sourceId: row.sourceId, delivered: true, deliveredBy: deliveredByName })
      });
      if (res.ok) onChanged({ delivered: true, deliveredAt: new Date().toISOString(), deliveredBy: deliveredByName });
    } finally {
      setSaving(false);
    }
  };

  const undoDelivered = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/uniform-kits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonKey: row.seasonKey, sourceType: row.sourceType, sourceId: row.sourceId, delivered: false })
      });
      if (res.ok) onChanged({ delivered: false, deliveredAt: null, deliveredBy: null });
    } finally {
      setSaving(false);
    }
  };

  if (row.delivered) {
    return (
      <button onClick={undoDelivered} disabled={saving} style={{ fontSize: "0.68rem", color: "#6d6b71", background: "none", border: "1px solid #302e36", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer" }}>
        Annuler
      </button>
    );
  }

  return (
    <button onClick={confirmDelivered} disabled={saving || !deliveredByName} className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem" }}>
      Remis
    </button>
  );
}

export function AdminUniformesKitInscription({ initialRows, initialSeasonFilter }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [seasonFilter, setSeasonFilter] = useState(initialSeasonFilter ?? "");
  const [ageFilter, setAgeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "remis" | "a-remettre">("all");
  const [role, setRole] = useState<"admin" | "gerante" | null>(null);

  useEffect(() => {
    fetch("/api/admin/session").then((r) => r.json()).then((d: { role: "admin" | "gerante" | null }) => setRole(d.role)).catch(() => setRole(null));
  }, []);
  const deliveredByName = role ? DELIVERED_BY_LABEL[role] : null;

  const seasons = useMemo(() => Array.from(new Map(rows.map((r) => [r.seasonKey, r.seasonLabel] as const))), [rows]);
  const ages = useMemo(() => Array.from(new Set(rows.filter((r) => !seasonFilter || r.seasonKey === seasonFilter).map((r) => r.ageLabel))).sort(), [rows, seasonFilter]);

  const filtered = rows.filter((r) => {
    if (seasonFilter && r.seasonKey !== seasonFilter) return false;
    if (ageFilter && r.ageLabel !== ageFilter) return false;
    if (statusFilter === "remis" && !r.delivered) return false;
    if (statusFilter === "a-remettre" && r.delivered) return false;
    return true;
  });

  const handleChanged = (row: UniformKitRow, patch: Partial<UniformKitRow>) => {
    setRows((prev) => prev.map((r) => (r.sourceType === row.sourceType && r.sourceId === row.sourceId ? { ...r, ...patch } : r)));
  };

  const total = filtered.length;
  const delivered = filtered.filter((r) => r.delivered).length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Kit d&apos;inscription</p>
            <Link href="/admin/uniformes" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Uniformes</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Chandail + short + bas inclus avec chaque inscription payée (+ sac pour les 30 premières payantes en Automne/Hiver et saisons suivantes) —
            {" "}<strong style={{ color: "#fff" }}>{delivered} / {total}</strong> remis sur la sélection actuelle.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <select className="admin-input" value={seasonFilter} onChange={(e) => { setSeasonFilter(e.target.value); setAgeFilter(""); }}>
              <option value="">Toutes les saisons</option>
              {seasons.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select className="admin-input" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
              <option value="">Tous les âges</option>
              {ages.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="admin-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">Tous les statuts</option>
              <option value="a-remettre">À remettre</option>
              <option value="remis">Remis</option>
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Joueuse</th>
                  <th>Année</th>
                  <th>Saison</th>
                  <th>Parent</th>
                  <th>Téléphone</th>
                  <th>Articles</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.sourceType}:${r.sourceId}`}>
                    <td>{r.playerName}</td>
                    <td>{r.ageLabel}</td>
                    <td>{r.seasonLabel}</td>
                    <td>{r.parentName}</td>
                    <td>{r.parentPhone}</td>
                    <td>{r.items.join(", ")}</td>
                    <td style={{ color: r.delivered ? "#7fd88f" : "#ffb464" }}>
                      {r.delivered ? `✓ Remis${r.deliveredBy ? ` (${r.deliveredBy})` : ""}` : "À remettre"}
                    </td>
                    <td><RowActions row={r} deliveredByName={deliveredByName} onChanged={(patch) => handleChanged(r, patch)} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="admin-empty-text">Aucune inscription pour cette sélection.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
