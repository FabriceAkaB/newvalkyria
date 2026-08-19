"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { AuditLogEntry } from "@/lib/audit-repo";

const ENTITY_LABELS: Record<string, string> = { registration: "Inscription", lead: "Lead (Été)", coach: "Entraîneur", sport_etudes_registration: "Sport-Études" };
const ACTION_LABELS: Record<string, string> = { delete: "Suppression", status_change: "Changement de statut" };

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k}: ${val}`).join(", ");
  return String(v);
}

export function AdminAudit({ initialEntries }: { initialEntries: AuditLogEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const applyFilter = async (entityType: string) => {
    setFilter(entityType);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit${entityType ? `?entityType=${entityType}` : ""}`);
      const data = await res.json().catch(() => null);
      if (data?.entries) setEntries(data.entries);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Journal d&apos;audit</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Qui a fait quoi, et quand — pour les actions les plus sensibles (suppressions, changements de statut d&apos;inscription).
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {[
              { value: "", label: "Tout" },
              { value: "registration", label: "Inscriptions" },
              { value: "lead", label: "Leads Été" },
              { value: "sport_etudes_registration", label: "Sport-Études" },
              { value: "coach", label: "Entraîneurs" }
            ].map((f) => (
              <button key={f.value} onClick={() => applyFilter(f.value)} className={filter === f.value ? "admin-btn-primary" : "admin-btn-ghost"} style={{ fontSize: "0.75rem" }}>
                {f.label}
              </button>
            ))}
          </div>

          {loading && <p style={{ fontSize: "0.75rem", color: "#6d6b71" }}>Chargement...</p>}
          {!loading && entries.length === 0 && <p className="admin-empty-text">Aucune entrée dans le journal.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {!loading && entries.map((e) => (
              <div key={e.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.65rem 0.9rem" }}>
                <p style={{ fontSize: "0.8rem", color: "#fff", margin: "0 0 0.2rem" }}>
                  <strong>{e.actor_label}</strong> — {ACTION_LABELS[e.action] ?? e.action} · {ENTITY_LABELS[e.entity_type] ?? e.entity_type}
                  {e.entity_label ? ` — ${e.entity_label}` : ""}
                </p>
                {(e.before || e.after) && (
                  <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.2rem" }}>
                    {e.before && `Avant : ${formatValue(e.before)}`}{e.before && e.after ? " → " : ""}{e.after && `Après : ${formatValue(e.after)}`}
                  </p>
                )}
                <p style={{ fontSize: "0.68rem", color: "#48474d", margin: 0 }}>{new Date(e.created_at).toLocaleString("fr-CA")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
