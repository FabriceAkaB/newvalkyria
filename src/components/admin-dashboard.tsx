"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { CapacityData } from "@/lib/capacity";
import { CATEGORY_LABELS, CATEGORY_SUBLABELS } from "@/lib/categories";
import type { AdminLead } from "@/lib/repositories";

type FilterType = "all" | "paid" | "pending" | "waitlist";

interface Props {
  leads: AdminLead[];
  capacity: CapacityData;
}

function StatusBadge({ lead }: { lead: AdminLead }) {
  if (lead.is_waitlist) {
    return <span className="admin-badge admin-badge-waitlist">⏳ Liste d&apos;attente</span>;
  }
  if (lead.status === "paid") {
    return <span className="admin-badge admin-badge-paid">✓ Payée</span>;
  }
  return <span className="admin-badge admin-badge-pending">En attente</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Toronto"
  });
}

export function AdminDashboard({ leads, capacity }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [capValues, setCapValues] = useState<Record<string, number>>(
    Object.fromEntries(
      Object.entries(capacity.byCategory).map(([cat, cap]) => [cat, cap.max])
    )
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  /* ── Stats ── */
  const totalLeads  = leads.length;
  const paidLeads   = leads.filter(l => l.status === "paid" && !l.is_waitlist).length;
  const pendingLeads = leads.filter(l => l.status === "pending" && !l.is_waitlist).length;
  const waitlistLeads = leads.filter(l => l.is_waitlist).length;

  /* ── Filtered leads ── */
  const filteredLeads = leads.filter(lead => {
    if (filter === "paid")      return lead.status === "paid" && !lead.is_waitlist;
    if (filter === "pending")   return lead.status === "pending" && !lead.is_waitlist;
    if (filter === "waitlist")  return lead.is_waitlist;
    return true;
  });

  /* ── Capacity save ── */
  const handleSave = async (cat: string) => {
    setSaving(prev => ({ ...prev, [cat]: true }));
    try {
      await fetch("/api/admin/capacity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, maxSpots: capValues[cat] })
      });
      setSaved(prev => ({ ...prev, [cat]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [cat]: false })), 2000);
      router.refresh();
    } finally {
      setSaving(prev => ({ ...prev, [cat]: false }));
    }
  };

  /* ── Logout ── */
  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  const categories = Object.keys(capacity.byCategory);

  return (
    <>
      {/* ── Top bar ── */}
      <div className="admin-topbar">
        <div>
          <p className="admin-topbar-brand">New Valkyria</p>
          <p className="admin-topbar-sub">Tableau de bord</p>
        </div>
        <button onClick={handleLogout} className="admin-logout-btn">
          Déconnexion
        </button>
      </div>

      <div className="admin-content">

        {/* ── Stats ── */}
        <div className="admin-section">
          <p className="admin-section-title">Vue d&apos;ensemble</p>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <p className="admin-stat-value">{totalLeads}</p>
              <p className="admin-stat-label">Formulaires reçus</p>
            </div>
            <div className="admin-stat-card admin-stat-card-accent">
              <p className="admin-stat-value">{paidLeads}</p>
              <p className="admin-stat-label">Inscriptions confirmées</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{pendingLeads}</p>
              <p className="admin-stat-label">En attente de paiement</p>
            </div>
            <div className="admin-stat-card admin-stat-card-warn">
              <p className="admin-stat-value">{waitlistLeads}</p>
              <p className="admin-stat-label">Liste d&apos;attente</p>
            </div>
          </div>
        </div>

        {/* ── Capacity ── */}
        <div className="admin-section">
          <p className="admin-section-title">Capacité par groupe — modifiez le nombre max de places</p>
          <div className="admin-cap-grid">
            {categories.map(cat => {
              const cap = capacity.byCategory[cat as keyof typeof capacity.byCategory];
              const localMax = capValues[cat] ?? cap.max;
              const changed = localMax !== cap.max;
              const pct = Math.min(Math.round((cap.taken / (localMax || 1)) * 100), 100);

              return (
                <div key={cat} className="admin-cap-card">
                  <p className="admin-cap-cat">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</p>
                  <p className="admin-cap-sub">{CATEGORY_SUBLABELS[cat as keyof typeof CATEGORY_SUBLABELS] ?? ""}</p>

                  <div className="admin-cap-numbers">
                    <span className="admin-cap-taken">{cap.taken}</span>
                    <span className="admin-cap-sep">/</span>
                    <input
                      type="number"
                      min={cap.taken}
                      max={99}
                      value={localMax}
                      onChange={e => setCapValues(prev => ({ ...prev, [cat]: Math.max(cap.taken, parseInt(e.target.value) || 0) }))}
                      className="admin-cap-max-input"
                      title="Nombre maximum de places"
                    />
                    <span className="admin-cap-unit">places</span>
                  </div>

                  <div className="admin-cap-bar-track">
                    <div
                      className="admin-cap-bar-fill"
                      style={{ width: `${pct}%`, background: cap.isFull ? "rgba(248,113,113,0.7)" : "rgba(196,164,228,0.7)" }}
                    />
                  </div>

                  <div className="admin-cap-footer">
                    {cap.isFull
                      ? <span className="admin-cap-status-full">Groupe complet</span>
                      : <span className="admin-cap-status-ok">{cap.remaining} place{cap.remaining > 1 ? "s" : ""} restante{cap.remaining > 1 ? "s" : ""}</span>
                    }
                    {changed && (
                      <button
                        onClick={() => handleSave(cat)}
                        disabled={saving[cat]}
                        className="admin-cap-save-btn"
                      >
                        {saving[cat] ? "..." : saved[cat] ? "✓" : "Sauvegarder"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Leads table ── */}
        <div className="admin-section">
          <p className="admin-section-title">Inscriptions</p>

          <div className="admin-filters">
            {([
              ["all",       "Toutes",           totalLeads],
              ["paid",      "Confirmées",        paidLeads],
              ["pending",   "En attente",        pendingLeads],
              ["waitlist",  "Liste d'attente",   waitlistLeads]
            ] as [FilterType, string, number][]).map(([f, label, count]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                data-active={String(filter === f)}
                className="admin-filter-btn"
              >
                {label}
                <span className="admin-filter-count">{count}</span>
              </button>
            ))}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom parent</th>
                  <th>Courriel</th>
                  <th>Téléphone</th>
                  <th>Ville</th>
                  <th>Groupe</th>
                  <th>Niveau</th>
                  <th>Disponibilités</th>
                  <th>Objectif</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="admin-empty">Aucune inscription dans cette catégorie</td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr key={lead.id}>
                      <td className="admin-td-date">{formatDate(lead.created_at)}</td>
                      <td className="admin-td-name">{lead.parent_name}</td>
                      <td>
                        <a href={`mailto:${lead.email}`} className="admin-td-email">{lead.email}</a>
                      </td>
                      <td>
                        <a href={`tel:${lead.phone}`} className="admin-td-phone">{lead.phone}</a>
                      </td>
                      <td>{lead.city}</td>
                      <td className="admin-td-cat">{lead.player_age}</td>
                      <td>{lead.player_level}</td>
                      <td className="admin-td-avail">{lead.availability}</td>
                      <td className="admin-td-goal" title={lead.goal}>{lead.goal}</td>
                      <td><StatusBadge lead={lead} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
