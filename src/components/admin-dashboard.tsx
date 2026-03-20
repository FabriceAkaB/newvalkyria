"use client";

import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import type { CapacityData } from "@/lib/capacity";
import { CATEGORY_LABELS } from "@/lib/categories";
import type { AdminLead } from "@/lib/repositories";

interface Props {
  leads: AdminLead[];
  capacity: CapacityData;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
}

function StatusBadge({ lead }: { lead: AdminLead }) {
  if (lead.is_waitlist) {
    return <span className="admin-badge admin-badge-waitlist">Liste d&apos;attente</span>;
  }
  if (lead.status === "paid") {
    return <span className="admin-badge admin-badge-paid">✓ Payée</span>;
  }
  return <span className="admin-badge admin-badge-pending">En attente</span>;
}

export function AdminDashboard({ leads, capacity }: Props) {
  const totalLeads = leads.length;
  const paidLeads = leads.filter((l) => l.status === "paid" && !l.is_waitlist).length;
  const pendingLeads = leads.filter((l) => l.status === "pending" && !l.is_waitlist).length;
  const waitlistLeads = leads.filter((l) => l.is_waitlist).length;

  const recentLeads = leads.slice(0, 5);
  const categories = Object.keys(capacity.byCategory);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">

        {/* Stats */}
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

        {/* Capacity summary */}
        <div className="admin-section">
          <p className="admin-section-title">Capacité par groupe</p>
          <div className="admin-cap-summary-grid">
            {categories.map((cat) => {
              const cap = capacity.byCategory[cat as keyof typeof capacity.byCategory];
              const pct = Math.min(Math.round((cap.taken / cap.max) * 100), 100);
              return (
                <div key={cat} className="admin-cap-summary-card">
                  <div className="admin-cap-summary-top">
                    <span className="admin-cap-summary-label">
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                    </span>
                    <span className="admin-cap-summary-count">
                      {cap.taken}/{cap.max}
                    </span>
                  </div>
                  <div className="admin-cap-bar-track">
                    <div
                      className="admin-cap-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: cap.isFull
                          ? "rgba(248,113,113,0.7)"
                          : "rgba(196,164,228,0.7)",
                      }}
                    />
                  </div>
                  {cap.isFull ? (
                    <span className="admin-cap-status-full">Groupe complet</span>
                  ) : (
                    <span className="admin-cap-status-ok">
                      {cap.remaining} place{cap.remaining > 1 ? "s" : ""} restante
                      {cap.remaining > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Link href="/admin/capacite" className="admin-quick-link">
            Gérer la capacité →
          </Link>
        </div>

        {/* Recent inscriptions */}
        <div className="admin-section">
          <p className="admin-section-title">Inscriptions récentes</p>
          <div className="admin-recent-list">
            {recentLeads.length === 0 ? (
              <p className="admin-empty-text">Aucune inscription pour l&apos;instant</p>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="admin-recent-item">
                  <div className="admin-recent-info">
                    <span className="admin-recent-name">{lead.parent_name}</span>
                    <span className="admin-recent-meta" suppressHydrationWarning>
                      {lead.player_age} · {lead.city} · {formatDate(lead.created_at)}
                    </span>
                  </div>
                  <StatusBadge lead={lead} />
                </div>
              ))
            )}
          </div>
          <Link href="/admin/inscriptions" className="admin-quick-link">
            Voir toutes les inscriptions →
          </Link>
        </div>

        {/* Quick links */}
        <div className="admin-section">
          <p className="admin-section-title">Accès rapide</p>
          <div className="admin-quick-cards">
            <Link href="/admin/inscriptions" className="admin-quick-card">
              <p className="admin-quick-card-title">Inscriptions</p>
              <p className="admin-quick-card-desc">
                Voir, filtrer, supprimer et gérer toutes les inscriptions
              </p>
            </Link>
            <Link href="/admin/joueuses" className="admin-quick-card">
              <p className="admin-quick-card-title">Joueuses</p>
              <p className="admin-quick-card-desc">
                Liste des joueuses confirmées par groupe d&apos;âge
              </p>
            </Link>
            <Link href="/admin/capacite" className="admin-quick-card">
              <p className="admin-quick-card-title">Capacité</p>
              <p className="admin-quick-card-desc">
                Modifier le nombre de places disponibles par groupe
              </p>
            </Link>
          </div>
        </div>

      </div>
    </>
  );
}
