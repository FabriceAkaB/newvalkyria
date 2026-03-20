"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { AGE_CATEGORIES, CATEGORY_LABELS, CATEGORY_SUBLABELS } from "@/lib/categories";
import type { AdminLead } from "@/lib/repositories";

type FilterType = "all" | "paid" | "pending" | "waitlist" | "new";
type CategoryFilter = "all" | "2016-2017" | "2014-2015" | "2012-2013";

const SEEN_KEY = "nv_admin_seen_since";

function getSeenSince(): number {
  try {
    return parseInt(localStorage.getItem(SEEN_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function isNewLead(createdAt: string, seenSince: number): boolean {
  if (!seenSince) return false;
  return new Date(createdAt).getTime() > seenSince;
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

function StatusBadge({ lead, isNew }: { lead: AdminLead; isNew: boolean }) {
  return (
    <div className="admin-badge-group">
      {isNew && <span className="admin-badge admin-badge-new">Nouveau</span>}
      {lead.is_waitlist ? (
        <span className="admin-badge admin-badge-waitlist">Liste d&apos;attente</span>
      ) : lead.status === "paid" ? (
        <span className="admin-badge admin-badge-paid">✓ Payée</span>
      ) : (
        <span className="admin-badge admin-badge-pending">En attente</span>
      )}
    </div>
  );
}

/* ── Lead Drawer ───────────────────────────────────────────────── */

interface DrawerProps {
  lead: AdminLead;
  isNew: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

function LeadDrawer({ lead, isNew, onClose, onDeleted }: DrawerProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur de suppression");
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="admin-overlay" onClick={onClose} />

      {/* Drawer */}
      <div className="admin-drawer">
        <div className="admin-drawer-header">
          <div>
            <p className="admin-drawer-title">{lead.parent_name}</p>
            <p className="admin-drawer-subtitle" suppressHydrationWarning>
              Inscrit le {formatDate(lead.created_at)}
              {isNew && " · Nouveau"}
            </p>
          </div>
          <button
            className="admin-drawer-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="admin-drawer-body">
          {/* Status */}
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Statut</p>
            <StatusBadge lead={lead} isNew={isNew} />
          </div>

          {/* Contact */}
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Contact</p>
            <div className="admin-drawer-row">
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Courriel</p>
                <p className="admin-drawer-value">
                  <a href={`mailto:${lead.email}`}>{lead.email}</a>
                </p>
              </div>
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Téléphone</p>
                <p className="admin-drawer-value">
                  <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                </p>
              </div>
            </div>
          </div>

          {/* Joueuse */}
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Joueuse</p>
            <div className="admin-drawer-row">
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Groupe d&apos;âge</p>
                <p className="admin-drawer-value admin-drawer-value-cat">
                  {CATEGORY_LABELS[lead.player_age as keyof typeof CATEGORY_LABELS] ??
                    lead.player_age}
                  {CATEGORY_SUBLABELS[lead.player_age as keyof typeof CATEGORY_SUBLABELS] && (
                    <span
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        fontSize: "0.75rem",
                        marginLeft: "0.4rem",
                      }}
                    >
                      (
                      {
                        CATEGORY_SUBLABELS[
                          lead.player_age as keyof typeof CATEGORY_SUBLABELS
                        ]
                      }
                      )
                    </span>
                  )}
                </p>
              </div>
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Niveau</p>
                <p className="admin-drawer-value">{lead.player_level}</p>
              </div>
            </div>
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">Ville</p>
              <p className="admin-drawer-value">{lead.city}</p>
            </div>
          </div>

          {/* Disponibilités & Objectif */}
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Préférences</p>
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">Disponibilités</p>
              <p className="admin-drawer-value">{lead.availability}</p>
            </div>
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">Objectif</p>
              <p className="admin-drawer-value admin-drawer-value-long">{lead.goal}</p>
            </div>
          </div>

          {/* Stripe */}
          {(lead.stripe_checkout_session_id || lead.stripe_payment_intent_id) && (
            <div className="admin-drawer-section">
              <p className="admin-drawer-section-title">Paiement Stripe</p>
              {lead.stripe_checkout_session_id && (
                <div className="admin-drawer-field">
                  <p className="admin-drawer-label">Session Checkout</p>
                  <p
                    className="admin-drawer-value"
                    style={{
                      fontSize: "0.72rem",
                      wordBreak: "break-all",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {lead.stripe_checkout_session_id}
                  </p>
                </div>
              )}
              {lead.stripe_payment_intent_id && (
                <div className="admin-drawer-field">
                  <p className="admin-drawer-label">Payment Intent</p>
                  <p
                    className="admin-drawer-value"
                    style={{
                      fontSize: "0.72rem",
                      wordBreak: "break-all",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {lead.stripe_payment_intent_id}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ID */}
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Référence</p>
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">ID inscription</p>
              <p
                className="admin-drawer-value"
                style={{
                  fontSize: "0.68rem",
                  wordBreak: "break-all",
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                {lead.id}
              </p>
            </div>
          </div>

          {error && <p className="admin-error">{error}</p>}
        </div>

        <div className="admin-drawer-footer">
          <button className="admin-btn-danger" onClick={() => setConfirming(true)}>
            Supprimer l&apos;inscription
          </button>
          <button className="admin-btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirming && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Supprimer cette inscription ?</p>
            <p className="admin-modal-body">
              L&apos;inscription de{" "}
              <span className="admin-modal-name">{lead.parent_name}</span> sera
              définitivement supprimée. Cette action est irréversible.
            </p>
            <div className="admin-modal-actions">
              <button
                className="admin-btn-ghost"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                className="admin-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

interface Props {
  leads: AdminLead[];
}

export function AdminInscriptions({ leads: initialLeads }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<AdminLead | null>(null);
  const [seenSince, setSeenSince] = useState(0);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    setSeenSince(getSeenSince());
  }, []);

  const handleReset = () => {
    const now = Date.now();
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* ignore */
    }
    setSeenSince(now);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 2500);
    if (filter === "new") setFilter("all");
  };

  const handleDeleted = () => {
    if (selectedLead) {
      setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
      setSelectedLead(null);
      router.refresh();
    }
  };

  /* ── Counts ── */
  const countNew = leads.filter((l) => isNewLead(l.created_at, seenSince)).length;
  const countPaid = leads.filter((l) => l.status === "paid" && !l.is_waitlist).length;
  const countPending = leads.filter((l) => l.status === "pending" && !l.is_waitlist).length;
  const countWaitlist = leads.filter((l) => l.is_waitlist).length;

  /* ── Filtered ── */
  const filteredLeads = leads.filter((lead) => {
    if (filter === "paid" && (lead.status !== "paid" || lead.is_waitlist)) return false;
    if (filter === "pending" && (lead.status !== "pending" || lead.is_waitlist)) return false;
    if (filter === "waitlist" && !lead.is_waitlist) return false;
    if (filter === "new" && !isNewLead(lead.created_at, seenSince)) return false;
    if (categoryFilter !== "all" && lead.player_age !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !lead.parent_name.toLowerCase().includes(q) &&
        !lead.email.toLowerCase().includes(q) &&
        !lead.city?.toLowerCase().includes(q) &&
        !lead.phone?.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  /* ── Export CSV ── */
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Nom parent",
      "Courriel",
      "Téléphone",
      "Ville",
      "Groupe",
      "Niveau",
      "Disponibilités",
      "Objectif",
      "Statut",
      "Liste attente",
    ];
    const rows = filteredLeads.map((l) => [
      new Date(l.created_at).toLocaleDateString("fr-CA"),
      l.parent_name,
      l.email,
      l.phone,
      l.city,
      l.player_age,
      l.player_level,
      l.availability,
      `"${l.goal.replace(/"/g, '""')}"`,
      l.status,
      l.is_waitlist ? "Oui" : "Non",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscriptions-newvalkyria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <p className="admin-section-title" style={{ margin: 0 }}>
              Inscriptions ({leads.length})
            </p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                onClick={handleExportCSV}
                className="admin-export-btn"
                title="Exporter la sélection en CSV"
              >
                ↓ Exporter CSV
              </button>
              <button
                onClick={handleReset}
                className="admin-reset-btn"
                title="Marquer tout comme vu — les nouvelles inscriptions seront celles reçues après ce point"
              >
                {resetDone ? "✓ Remis à zéro" : "Remettre à zéro"}
              </button>
            </div>
          </div>

          {/* Status filters */}
          <div className="admin-filters-row">
            <div className="admin-filters">
              {(
                [
                  ["all", "Toutes", leads.length],
                  ["new", "Nouvelles", countNew],
                  ["paid", "Confirmées", countPaid],
                  ["pending", "En attente", countPending],
                  ["waitlist", "Liste d'attente", countWaitlist],
                ] as [FilterType, string, number][]
              ).map(([f, label, count]) => (
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
          </div>

          {/* Category + search row */}
          <div
            className="admin-filters-row"
            style={{ marginBottom: "1rem", alignItems: "center" }}
          >
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="admin-group-select"
            >
              <option value="all">Tous les groupes</option>
              {AGE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]} ({CATEGORY_SUBLABELS[cat]})
                </option>
              ))}
            </select>
            <div className="admin-search-wrap">
              <input
                type="search"
                placeholder="Rechercher nom, courriel, ville…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-search-input"
              />
            </div>
            <span
              style={{
                fontSize: "0.62rem",
                color: "rgba(255,255,255,0.2)",
                marginLeft: "auto",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {filteredLeads.length} résultat{filteredLeads.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
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
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-empty">
                      Aucune inscription dans cette catégorie
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const _isNew = isNewLead(lead.created_at, seenSince);
                    return (
                      <tr
                        key={lead.id}
                        className="admin-tr-clickable"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="admin-td-date" suppressHydrationWarning>{formatDate(lead.created_at)}</td>
                        <td className="admin-td-name">{lead.parent_name}</td>
                        <td className="admin-td-email">{lead.email}</td>
                        <td className="admin-td-phone">{lead.phone}</td>
                        <td>{lead.city}</td>
                        <td className="admin-td-cat">
                          {CATEGORY_LABELS[
                            lead.player_age as keyof typeof CATEGORY_LABELS
                          ] ?? lead.player_age}
                        </td>
                        <td>{lead.player_level}</td>
                        <td>
                          <StatusBadge lead={lead} isNew={_isNew} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filter === "new" && seenSince === 0 && (
            <p
              style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.25)",
                marginTop: "0.75rem",
                textAlign: "center",
              }}
            >
              Cliquez &quot;Remettre à zéro&quot; pour commencer à suivre les nouvelles
              inscriptions.
            </p>
          )}
        </div>
      </div>

      {/* Drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          isNew={isNewLead(selectedLead.created_at, seenSince)}
          onClose={() => setSelectedLead(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
