"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BirthCategory, Program, Registration, RegistrationStatus, Season, TimeSlotTemplate } from "@/lib/season-admin-repo";

interface Props {
  season: Season;
  categories: BirthCategory[];
  programs: Program[];
  slots: TimeSlotTemplate[];
  initialRegistrations: Registration[];
}

type FilterType = "all" | RegistrationStatus;
type SortBy = "date_desc" | "date_asc" | "parent_asc" | "child_asc";

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  waitlist: "Liste d'attente",
  cancelled: "Annulée"
};

function playerName(r: Registration): string {
  const name = [r.player_first_name, r.player_last_name].filter(Boolean).join(" ");
  return name || "Sans nom";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });
}

function isHalfSeasonExpiringSoon(r: Registration): boolean {
  if (!r.is_half_season || !r.half_season_ends_on) return false;
  const diffDays = (new Date(r.half_season_ends_on).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diffDays <= 2;
}

function StatusBadge({ status }: { status: RegistrationStatus }) {
  if (status === "waitlist") return <span className="admin-badge admin-badge-waitlist">Liste d&apos;attente</span>;
  if (status === "paid") return <span className="admin-badge admin-badge-paid">✓ Payée</span>;
  if (status === "confirmed") return <span className="admin-badge admin-badge-paid" style={{ background: "#1f2b3d", color: "#9ec9ff", borderColor: "#465671" }}>✓ Confirmée</span>;
  if (status === "cancelled") return <span className="admin-badge admin-badge-pending" style={{ background: "rgba(255,100,100,0.18)", color: "#ff9999" }}>Annulée</span>;
  return <span className="admin-badge admin-badge-pending">En attente</span>;
}

/* ── Drawer ────────────────────────────────────────────────────── */

interface DrawerProps {
  registration: Registration;
  categories: BirthCategory[];
  programs: Program[];
  slots: TimeSlotTemplate[];
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: (patch: Partial<Registration>) => void;
  seasonId: string;
}

function RegistrationDrawer({ registration: r, categories, programs, slots, onClose, onDeleted, onUpdated, seasonId }: DrawerProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expiringSoon = isHalfSeasonExpiringSoon(r);

  const slotsForCategory = r.category_id ? slots.filter((s) => s.category_ids.includes(r.category_id!)) : slots;

  const patch = async (body: Record<string, unknown>, optimistic: Partial<Registration>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${seasonId}/registrations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      onUpdated(optimistic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${seasonId}/registrations/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="admin-overlay" onClick={onClose} />
      <div className="admin-drawer">
        <div className="admin-drawer-header">
          <div>
            <p className="admin-drawer-title">{r.parent_name}</p>
            <p className="admin-drawer-subtitle" suppressHydrationWarning>
              Inscrit le {formatDate(r.created_at)}
              {expiringSoon && " · ⚠ Demi-saison bientôt terminée"}
            </p>
          </div>
          <button className="admin-drawer-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <div className="admin-drawer-body">
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Statut</p>
            <StatusBadge status={r.status} />
            <div style={{ marginTop: "0.6rem" }}>
              <p className="admin-drawer-label">Changer le statut</p>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                {(Object.keys(STATUS_LABELS) as RegistrationStatus[]).map((s) => {
                  const isActive = r.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => patch({ status: s }, { status: s })}
                      disabled={saving || isActive}
                      style={{
                        padding: "0.35rem 0.7rem",
                        fontSize: "0.72rem",
                        borderRadius: "6px",
                        border: isActive ? "1px solid #8d76a5" : "1px solid #302e36",
                        background: isActive ? "#30283c" : "transparent",
                        color: isActive ? "#fff" : "#9d9da0",
                        cursor: isActive ? "default" : "pointer",
                        fontWeight: isActive ? 600 : 400
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Contact</p>
            <div className="admin-drawer-row">
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Courriel</p>
                <p className="admin-drawer-value"><a href={`mailto:${r.parent_email}`}>{r.parent_email}</a></p>
              </div>
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Téléphone</p>
                <p className="admin-drawer-value"><a href={`tel:${r.parent_phone}`}>{r.parent_phone}</a></p>
              </div>
            </div>
            {r.city && (
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Ville</p>
                <p className="admin-drawer-value">{r.city}</p>
              </div>
            )}
          </div>

          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Joueuse</p>
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">Nom</p>
              <p className="admin-drawer-value" style={{ fontWeight: 600 }}>{playerName(r)}</p>
            </div>
            {r.player_dob && (
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Date de naissance</p>
                <p className="admin-drawer-value">{r.player_dob}</p>
              </div>
            )}
          </div>

          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Programme &amp; horaire</p>
            <div className="admin-drawer-row">
              <label className="admin-field" style={{ gap: "0.3rem" }}>
                <span className="admin-drawer-label">Programme</span>
                <select className="admin-input" value={r.program_id ?? ""} onChange={(e) => patch({ programId: e.target.value || null }, { program_id: e.target.value || null })}>
                  <option value="">—</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
                </select>
              </label>
              <label className="admin-field" style={{ gap: "0.3rem" }}>
                <span className="admin-drawer-label">Catégorie</span>
                <select className="admin-input" value={r.category_id ?? ""} onChange={(e) => patch({ categoryId: e.target.value || null, timeSlotTemplateId: null }, { category_id: e.target.value || null, time_slot_template_id: null })}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
            </div>
            <label className="admin-field" style={{ gap: "0.3rem", marginTop: "0.6rem" }}>
              <span className="admin-drawer-label">Plage horaire</span>
              <select className="admin-input" value={r.time_slot_template_id ?? ""} onChange={(e) => patch({ timeSlotTemplateId: e.target.value || null }, { time_slot_template_id: e.target.value || null })}>
                <option value="">Non assignée</option>
                {slotsForCategory.map((s) => <option key={s.id} value={s.id}>{s.day} {s.start_time}–{s.end_time} · {s.location}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", cursor: "pointer" }}>
                <input type="checkbox" checked={r.advanced_group} onChange={(e) => patch({ advancedGroup: e.target.checked }, { advanced_group: e.target.checked })} />
                Groupe avancé
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", cursor: "pointer" }}>
                <input type="checkbox" checked={r.is_trial} onChange={(e) => patch({ isTrial: e.target.checked }, { is_trial: e.target.checked })} />
                À l&apos;essai
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={r.is_half_season}
                  onChange={(e) => patch(
                    { isHalfSeason: e.target.checked, halfSeasonEndsOn: e.target.checked ? r.half_season_ends_on : null },
                    { is_half_season: e.target.checked, half_season_ends_on: e.target.checked ? r.half_season_ends_on : null }
                  )}
                />
                Demi-saison
              </label>
              {r.is_half_season && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8" }}>
                  Fin le
                  <input
                    type="date"
                    value={r.half_season_ends_on ?? ""}
                    onChange={(e) => patch({ halfSeasonEndsOn: e.target.value || null }, { half_season_ends_on: e.target.value || null })}
                    style={{ padding: "0.2rem 0.4rem", fontSize: "0.72rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff" }}
                  />
                </label>
              )}
            </div>
          </div>

          {(r.stripe_checkout_session_id || r.stripe_payment_intent_id) && (
            <div className="admin-drawer-section">
              <p className="admin-drawer-section-title">Paiement Stripe</p>
              {r.stripe_checkout_session_id && (
                <div className="admin-drawer-field">
                  <p className="admin-drawer-label">Session Checkout</p>
                  <p className="admin-drawer-value" style={{ fontSize: "0.72rem", wordBreak: "break-all", color: "#6d6b71" }}>{r.stripe_checkout_session_id}</p>
                </div>
              )}
              {r.stripe_payment_intent_id && (
                <div className="admin-drawer-field">
                  <p className="admin-drawer-label">Payment Intent</p>
                  <p className="admin-drawer-value" style={{ fontSize: "0.72rem", wordBreak: "break-all", color: "#6d6b71" }}>{r.stripe_payment_intent_id}</p>
                </div>
              )}
            </div>
          )}

          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Référence</p>
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">ID inscription</p>
              <p className="admin-drawer-value" style={{ fontSize: "0.68rem", wordBreak: "break-all", color: "#48474d" }}>{r.id}</p>
            </div>
          </div>

          {error && <p className="admin-error">{error}</p>}
        </div>

        <div className="admin-drawer-footer">
          <button
            className="admin-btn-danger"
            onClick={() => (r.status === "cancelled" ? setConfirming(true) : patch({ status: "cancelled" }, { status: "cancelled" }))}
            disabled={saving}
          >
            {r.status === "cancelled" ? "Supprimer définitivement" : "Supprimer l’inscription"}
          </button>
          <button className="admin-btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>

      {confirming && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Supprimer cette inscription ?</p>
            <p className="admin-modal-body">
              L&apos;inscription de <span className="admin-modal-name">{r.parent_name}</span> sera définitivement supprimée. Cette action est irréversible.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Annuler</button>
              <button className="admin-btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Suppression..." : "Supprimer définitivement"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Main component ───────────────────────────────────────────── */

export function AdminSaisonInscriptions({ season, categories, programs, slots, initialRegistrations }: Props) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");
  const [selected, setSelected] = useState<Registration | null>(null);

  const categoryLabel = (id: string | null) => categories.find((c) => c.id === id)?.label ?? "—";
  const programName = (id: string | null) => (id ? (programs.find((p) => p.id === id)?.name ?? id) : "—");
  const slotLabel = (id: string | null) => {
    if (!id) return "—";
    const s = slots.find((sl) => sl.id === id);
    return s ? `${s.day} ${s.start_time}` : "—";
  };

  const counts = {
    all: registrations.length,
    pending: registrations.filter((r) => r.status === "pending").length,
    confirmed: registrations.filter((r) => r.status === "confirmed").length,
    paid: registrations.filter((r) => r.status === "paid").length,
    waitlist: registrations.filter((r) => r.status === "waitlist").length,
    cancelled: registrations.filter((r) => r.status === "cancelled").length
  };

  const filtered = registrations
    .filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (categoryFilter !== "all" && r.category_id !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.parent_name.toLowerCase().includes(q) &&
          !r.parent_email.toLowerCase().includes(q) &&
          !(r.parent_phone ?? "").includes(q) &&
          !playerName(r).toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "parent_asc": return a.parent_name.localeCompare(b.parent_name, "fr");
        case "child_asc": return playerName(a).localeCompare(playerName(b), "fr");
        case "date_desc":
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const handleUpdated = (patch: Partial<Registration>) => {
    if (!selected) return;
    const updated = { ...selected, ...patch };
    setSelected(updated);
    setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const handleDeleted = () => {
    if (!selected) return;
    setRegistrations((prev) => prev.filter((r) => r.id !== selected.id));
    setSelected(null);
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Nom parent", "Nom joueuse", "Courriel", "Téléphone", "Catégorie", "Programme", "Créneau", "Statut"];
    const rows = filtered.map((r) => [
      new Date(r.created_at).toLocaleDateString("fr-CA"),
      r.parent_name,
      playerName(r),
      r.parent_email,
      r.parent_phone,
      categoryLabel(r.category_id),
      programName(r.program_id),
      slotLabel(r.time_slot_template_id),
      STATUS_LABELS[r.status]
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscriptions-${season.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Inscriptions ({registrations.length})</p>
            <button onClick={handleExportCSV} className="admin-export-btn" title="Exporter la sélection en CSV">↓ Exporter CSV</button>
          </div>

          <div className="admin-filters-row">
            <div className="admin-filters">
              {(["all", "pending", "confirmed", "paid", "waitlist", "cancelled"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} data-active={String(filter === f)} className="admin-filter-btn">
                  {f === "all" ? "Toutes" : STATUS_LABELS[f]}
                  <span className="admin-filter-count">{counts[f]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="admin-filters-row" style={{ marginBottom: "1rem", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="admin-group-select">
              <option value="all">Tous les groupes</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="admin-search-wrap">
              <input type="search" placeholder="Rechercher parent, joueuse, courriel…" value={search} onChange={(e) => setSearch(e.target.value)} className="admin-search-input" />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="admin-group-select" title="Trier par" style={{ borderColor: "#554766" }}>
              <option value="date_desc">↓ Plus récentes</option>
              <option value="date_asc">↑ Plus anciennes</option>
              <option value="parent_asc">A→Z Nom parent</option>
              <option value="child_asc">A→Z Nom joueuse</option>
            </select>
            <span style={{ fontSize: "0.62rem", color: "#3c3a41", marginLeft: "auto", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom parent</th>
                  <th>Joueuse</th>
                  <th>Courriel</th>
                  <th>Téléphone</th>
                  <th>Catégorie</th>
                  <th>Programme</th>
                  <th>Créneau</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="admin-empty">Aucune inscription dans cette catégorie</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="admin-tr-clickable" onClick={() => setSelected(r)}>
                      <td className="admin-td-date" suppressHydrationWarning>{formatDate(r.created_at)}</td>
                      <td className="admin-td-name">{r.parent_name}</td>
                      <td className="admin-td-name">{playerName(r)}</td>
                      <td className="admin-td-email">{r.parent_email}</td>
                      <td className="admin-td-phone">{r.parent_phone}</td>
                      <td className="admin-td-cat">{categoryLabel(r.category_id)}</td>
                      <td style={{ fontSize: "0.75rem", color: "#858489" }}>{programName(r.program_id)}</td>
                      <td style={{ fontSize: "0.75rem", color: "#858489" }}>{slotLabel(r.time_slot_template_id)}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <RegistrationDrawer
          registration={selected}
          categories={categories}
          programs={programs}
          slots={slots}
          seasonId={season.id}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}
    </>
  );
}
