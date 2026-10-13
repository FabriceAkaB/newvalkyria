"use client";

import { useState } from "react";

import type { BoysRegistrationRow, BoysRegistrationStatus } from "@/lib/boys-registrations";

type FilterType = "all" | BoysRegistrationStatus;
type SortBy = "date_desc" | "date_asc" | "parent_asc" | "child_asc";

const STATUS_LABELS: Record<BoysRegistrationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  waitlist: "Liste d'attente",
  trial: "Essai gratuit",
  cancelled: "Annulée"
};

const EDITABLE_STATUSES: BoysRegistrationStatus[] = ["pending", "confirmed", "paid", "waitlist", "cancelled"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function formatTrialDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
}

function StatusBadge({ row }: { row: BoysRegistrationRow }) {
  if (row.status === "trial") {
    return (
      <span className="admin-badge admin-badge-pending" style={{ background: "rgba(255,150,50,0.2)", color: "#ffb464", borderColor: "rgba(255,150,50,0.5)" }}>
        {row.statusDetail ?? "Essai gratuit"}{row.trialDate ? ` · ${formatTrialDate(row.trialDate)}` : ""}
      </span>
    );
  }
  if (row.status === "waitlist") return <span className="admin-badge admin-badge-waitlist">Liste d&apos;attente</span>;
  if (row.status === "paid") return <span className="admin-badge admin-badge-paid">✓ Payée</span>;
  if (row.status === "confirmed") return <span className="admin-badge admin-badge-paid" style={{ background: "#1f2b3d", color: "#9ec9ff", borderColor: "#465671" }}>✓ Confirmée</span>;
  if (row.status === "cancelled") return <span className="admin-badge admin-badge-pending" style={{ background: "rgba(255,100,100,0.18)", color: "#ff9999" }}>{row.statusDetail ?? "Annulée"}</span>;
  return <span className="admin-badge admin-badge-pending">En attente</span>;
}

function endpointFor(row: BoysRegistrationRow): string | null {
  if (row.source === "session") return `/api/admin/session-programs/${row.programSlug}/registrations/${row.id}`;
  if (row.source === "sport-etudes") return `/api/admin/sport-etudes/registrations/${row.id}`;
  return null;
}

function Drawer({ row, onClose, onStatus, onDeleted }: { row: BoysRegistrationRow; onClose: () => void; onStatus: (s: BoysRegistrationStatus) => void; onDeleted: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const endpoint = endpointFor(row);

  const changeStatus = async (status: BoysRegistrationStatus) => {
    if (!endpoint) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Erreur de sauvegarde");
      onStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!endpoint) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSaving(false);
      setConfirmingDelete(false);
    }
  };

  const line = (label: string, value: React.ReactNode) =>
    value ? (
      <p style={{ fontSize: "0.8rem", color: "#c3c2c8", margin: "0 0 0.35rem" }}>
        <span style={{ color: "#6d6b71" }}>{label} : </span>{value}
      </p>
    ) : null;

  return (
    <>
      <div className="admin-overlay" onClick={onClose} />
      <div className="admin-drawer">
        <div className="admin-drawer-header">
          <div>
            <p className="admin-drawer-title">{row.playerName}</p>
            <p className="admin-drawer-subtitle" suppressHydrationWarning>{row.programLabel} · inscrit le {formatDate(row.createdAt)}</p>
          </div>
          <button className="admin-drawer-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="admin-drawer-body">
          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Statut</p>
            <StatusBadge row={row} />
            {endpoint ? (
              <div style={{ marginTop: "0.6rem" }}>
                <p className="admin-drawer-label">Changer le statut</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                  {EDITABLE_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      disabled={saving || row.status === s}
                      className={row.status === s ? "admin-btn-primary" : "admin-btn-ghost"}
                      style={{ fontSize: "0.7rem", padding: "0.3rem 0.65rem" }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: "0.74rem", color: "#6d6b71", margin: "0.6rem 0 0" }}>
                Essai gratuit : il se gère depuis la page du programme. Une famille qui veut s&apos;inscrire paie ensuite depuis la page du programme et apparaît ici comme inscription.
              </p>
            )}
            {error && <p style={{ fontSize: "0.74rem", color: "#ff9999", margin: "0.5rem 0 0" }}>{error}</p>}
          </div>

          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Joueur</p>
            {line("Programme", row.programLabel)}
            {line("Naissance", row.playerDob ? row.playerDob.slice(0, 10) : row.birthYear ? String(row.birthYear) : null)}
            {line("Date de l'essai", row.trialDate ? formatTrialDate(row.trialDate) : null)}
            {line("Montant", row.priceCents ? `${(row.priceCents / 100).toFixed(2)} $` : null)}
            {line("Commentaires", row.comments)}
          </div>

          <div className="admin-drawer-section">
            <p className="admin-drawer-section-title">Parent</p>
            {line("Nom", row.parentName)}
            {line("Courriel", row.parentEmail)}
            {line("Téléphone", row.parentPhone)}
          </div>

          {endpoint && (
            <div className="admin-drawer-section">
              {confirmingDelete ? (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", color: "#ff9999" }}>Supprimer définitivement ?</span>
                  <button onClick={remove} disabled={saving} className="admin-btn-ghost" style={{ fontSize: "0.7rem", color: "#ff9999" }}>Oui, supprimer</button>
                  <button onClick={() => setConfirmingDelete(false)} className="admin-btn-ghost" style={{ fontSize: "0.7rem" }}>Annuler</button>
                </div>
              ) : (
                <button onClick={() => setConfirmingDelete(true)} className="admin-btn-ghost" style={{ fontSize: "0.7rem", color: "#ff9999" }}>Supprimer l&apos;inscription</button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function BoysRegistrationsTable({ initialRows, initialProgram = "all" }: { initialRows: BoysRegistrationRow[]; initialProgram?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<FilterType>("all");
  const [program, setProgram] = useState<string>(initialProgram);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("date_desc");
  const [selected, setSelected] = useState<BoysRegistrationRow | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const programs = Array.from(new Map(rows.map((r) => [r.programSlug, r.programLabel])).entries());
  const inProgram = (r: BoysRegistrationRow) => program === "all" || r.programSlug === program;

  const counts = {
    all: rows.filter((r) => inProgram(r) && r.status !== "cancelled").length,
    pending: rows.filter((r) => inProgram(r) && r.status === "pending").length,
    confirmed: rows.filter((r) => inProgram(r) && r.status === "confirmed").length,
    paid: rows.filter((r) => inProgram(r) && r.status === "paid").length,
    waitlist: rows.filter((r) => inProgram(r) && r.status === "waitlist").length,
    trial: rows.filter((r) => inProgram(r) && r.status === "trial").length,
    cancelled: rows.filter((r) => inProgram(r) && r.status === "cancelled").length
  };

  const filtered = rows
    .filter((r) => {
      if (!inProgram(r)) return false;
      if (filter === "all" && r.status === "cancelled") return false;
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (![r.parentName, r.parentEmail, r.parentPhone, r.playerName].some((v) => v.toLowerCase().includes(q))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date_asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "parent_asc": return a.parentName.localeCompare(b.parentName, "fr");
        case "child_asc": return a.playerName.localeCompare(b.playerName, "fr");
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const exportCsv = () => {
    const headers = ["Date", "Programme", "Nom parent", "Joueur", "Naissance", "Courriel", "Téléphone", "Statut", "Date d'essai"];
    const data = filtered.map((r) => [
      new Date(r.createdAt).toLocaleDateString("fr-CA"),
      r.programLabel,
      r.parentName,
      r.playerName,
      r.playerDob ? r.playerDob.slice(0, 10) : r.birthYear ?? "",
      r.parentEmail,
      r.parentPhone,
      r.status === "trial" ? (r.statusDetail ?? "Essai gratuit") : STATUS_LABELS[r.status],
      r.trialDate ?? ""
    ]);
    const csv = [headers.join(","), ...data.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscriptions-garcons-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyEmails = async () => {
    const emails = Array.from(new Set(rows.filter((r) => inProgram(r) && r.status !== "cancelled").map((r) => r.parentEmail.toLowerCase()).filter(Boolean))).sort();
    if (emails.length === 0) return setCopyMsg("Aucun courriel trouvé.");
    const joined = emails.join("; ");
    try {
      await navigator.clipboard.writeText(joined);
      setCopyMsg(`${emails.length} courriel(s) copié(s) dans le presse-papier.`);
    } catch {
      window.prompt(`Copie manuelle — ${emails.length} courriel(s) :`, joined);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <p className="admin-section-title" style={{ margin: 0 }}>Inscriptions garçons ({counts.all})</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={copyEmails} className="admin-export-btn" title="Copier tous les courriels des inscriptions actives">📋 Copier tous les courriels</button>
          <button onClick={exportCsv} className="admin-export-btn" title="Exporter la sélection en CSV">↓ Exporter CSV</button>
        </div>
      </div>
      {copyMsg && <p style={{ fontSize: "0.72rem", color: "#8fce9f", margin: "-0.5rem 0 1rem" }}>{copyMsg}</p>}

      <div className="admin-filters-row">
        <div className="admin-filters">
          {(["all", "pending", "confirmed", "paid", "waitlist", "trial", "cancelled"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} data-active={String(filter === f)} className="admin-filter-btn">
              {f === "all" ? "Toutes" : STATUS_LABELS[f]}
              <span className="admin-filter-count">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-filters-row" style={{ marginBottom: "1rem", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <select value={program} onChange={(e) => setProgram(e.target.value)} className="admin-group-select">
          <option value="all">Tous les programmes garçons</option>
          {programs.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
        </select>
        <div className="admin-search-wrap">
          <input type="search" placeholder="Rechercher parent, joueur, courriel…" value={search} onChange={(e) => setSearch(e.target.value)} className="admin-search-input" />
        </div>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="admin-group-select" title="Trier par" style={{ borderColor: "#554766" }}>
          <option value="date_desc">↓ Plus récentes</option>
          <option value="date_asc">↑ Plus anciennes</option>
          <option value="parent_asc">A→Z Nom parent</option>
          <option value="child_asc">A→Z Nom joueur</option>
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
              <th>Joueur</th>
              <th>Courriel</th>
              <th>Téléphone</th>
              <th>Naissance</th>
              <th>Programme</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="admin-empty">Aucune inscription dans cette catégorie</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.key} className="admin-tr-clickable" onClick={() => setSelected(r)}>
                  <td className="admin-td-date" suppressHydrationWarning>{formatDate(r.createdAt)}</td>
                  <td className="admin-td-name">{r.parentName}</td>
                  <td className="admin-td-name">{r.playerName}</td>
                  <td className="admin-td-email">{r.parentEmail}</td>
                  <td className="admin-td-phone">{r.parentPhone}</td>
                  <td className="admin-td-cat">{r.birthYear ?? "—"}</td>
                  <td style={{ fontSize: "0.75rem", color: "#858489" }}>{r.programLabel}</td>
                  <td><StatusBadge row={r} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer
          row={selected}
          onClose={() => setSelected(null)}
          onStatus={(status) => {
            setRows((prev) => prev.map((r) => (r.key === selected.key ? { ...r, status } : r)));
            setSelected((s) => (s ? { ...s, status } : s));
          }}
          onDeleted={() => {
            setRows((prev) => prev.filter((r) => r.key !== selected.key));
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
