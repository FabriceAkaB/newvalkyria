"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { AGE_CATEGORIES, CATEGORY_LABELS, CATEGORY_SUBLABELS } from "@/lib/categories";
import type { AdminLead } from "@/lib/repositories";

interface Props {
  leads: AdminLead[];
}

export function AdminJoueuses({ leads }: Props) {
  const [search, setSearch] = useState("");

  const paidLeads = leads.filter((l) => l.status === "paid" && !l.is_waitlist);

  const filteredLeads = search
    ? paidLeads.filter((l) => {
        const q = search.toLowerCase();
        return (
          l.parent_name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q)
        );
      })
    : paidLeads;

  const handleExportCSV = () => {
    const headers = [
      "Groupe",
      "Nom parent",
      "Courriel",
      "Téléphone",
      "Ville",
      "Niveau",
      "Disponibilités",
    ];
    const rows = paidLeads.map((l) => [
      l.player_age,
      l.parent_name,
      l.email,
      l.phone,
      l.city,
      l.player_level,
      l.availability,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `joueuses-newvalkyria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
              Joueuses inscrites
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.3)",
                margin: "0.3rem 0 0",
              }}
            >
              {paidLeads.length} inscription{paidLeads.length !== 1 ? "s" : ""} confirmée
              {paidLeads.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div className="admin-search-wrap">
              <input
                type="search"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-search-input"
              />
            </div>
            <button onClick={handleExportCSV} className="admin-export-btn">
              ↓ Exporter CSV
            </button>
          </div>
        </div>

        {/* Players by category */}
        {AGE_CATEGORIES.map((cat) => {
          const catLeads = filteredLeads.filter((l) => l.player_age === cat);
          const allCatLeads = paidLeads.filter((l) => l.player_age === cat);
          if (search && catLeads.length === 0) return null;

          return (
            <div key={cat} className="admin-players-section">
              <div className="admin-players-category-header">
                <p className="admin-players-category-name">
                  {CATEGORY_LABELS[cat]} · {CATEGORY_SUBLABELS[cat]}
                </p>
                <span className="admin-players-category-count">
                  {search ? `${catLeads.length} / ` : ""}
                  {allCatLeads.length} joueuse{allCatLeads.length !== 1 ? "s" : ""}
                </span>
              </div>

              {catLeads.length === 0 && !search ? (
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.2)",
                    padding: "0.75rem 0 1.5rem",
                  }}
                >
                  Aucune joueuse confirmée dans ce groupe pour l&apos;instant.
                </p>
              ) : (
                <div className="admin-players-grid">
                  {catLeads.map((lead) => (
                    <div key={lead.id} className="admin-player-card">
                      <p className="admin-player-name">{lead.parent_name}</p>
                      <p className="admin-player-detail">
                        <a href={`mailto:${lead.email}`}>{lead.email}</a>
                      </p>
                      <p className="admin-player-detail">
                        <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                        {lead.city && ` · ${lead.city}`}
                      </p>
                      <p className="admin-player-detail">{lead.player_level}</p>
                      <p
                        className="admin-player-detail"
                        style={{ color: "rgba(255,255,255,0.22)", marginTop: "0.15rem" }}
                      >
                        {lead.availability}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {paidLeads.length === 0 && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.2)" }}>
              Aucune joueuse confirmée pour l&apos;instant.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
