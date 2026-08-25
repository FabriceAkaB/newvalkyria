"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { EntityDocuments } from "@/components/admin-entity-documents";
import { AGE_CATEGORIES, CATEGORY_LABELS, CATEGORY_SUBLABELS } from "@/lib/categories";
import type { ClubGroup } from "@/lib/club-aliases-store";
import type { AdminLead } from "@/lib/repositories";

type FilterType = "all" | "paid" | "confirmed" | "pending" | "essai" | "waitlist" | "new" | "cancelled";
type CategoryFilter = "all" | "2016" | "2015" | "2014-2013";

export interface TransferSeasonOption {
  id: string;
  label: string;
  categories: { id: string; label: string }[];
  programs: { id: string; name: string }[];
}

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parse the `goal` field to extract child name, position, club, and referredBy */
function parseGoal(goal: string): { childName: string; position: string; club: string; referredBy: string } {
  const childMatch = goal.match(/Joueuse:\s*([^·]+)/);
  const posMatch = goal.match(/Poste:\s*([^·]+)/);
  const clubMatch = goal.match(/Club:\s*([^·]+)/);
  const refMatch = goal.match(/Recommandé par:\s*(.+)/);
  return {
    childName: childMatch?.[1]?.trim() ?? "",
    position: posMatch?.[1]?.trim() ?? "",
    club: clubMatch?.[1]?.trim() ?? "",
    referredBy: refMatch?.[1]?.trim() ?? "",
  };
}

function StatusBadge({ lead, isNew }: { lead: AdminLead; isNew: boolean }) {
  return (
    <div className="admin-badge-group">
      {isNew && <span className="admin-badge admin-badge-new">Nouveau</span>}
      {lead.is_waitlist ? (
        <span className="admin-badge admin-badge-waitlist">Liste d&apos;attente</span>
      ) : lead.status === "paid" ? (
        <span className="admin-badge admin-badge-paid">✓ Payée</span>
      ) : lead.status === "confirmed" ? (
        <span className="admin-badge admin-badge-paid" style={{ background: "#1f2b3d", color: "#9ec9ff", borderColor: "#465671" }}>✓ Confirmée</span>
      ) : lead.status === "essai" ? (
        lead.trial_date ? (
          <span className="admin-badge admin-badge-pending" style={{ background: "rgba(150, 100, 255, 0.18)", color: "#c3a6ff", borderColor: "rgba(150, 100, 255, 0.4)" }}>À l&apos;essai</span>
        ) : (
          <span className="admin-badge admin-badge-pending" style={{ background: "rgba(255, 150, 50, 0.2)", color: "#ffb464", borderColor: "rgba(255, 150, 50, 0.5)" }} title="Aucune date d'essai fixée">⚠ À l&apos;essai — sans date</span>
        )
      ) : lead.status === "cancelled" ? (
        <span className="admin-badge admin-badge-pending" style={{ background: "rgba(255, 100, 100, 0.18)", color: "#ff9999" }}>Annulée</span>
      ) : (
        <span className="admin-badge admin-badge-pending">En attente</span>
      )}
    </div>
  );
}

function splitName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return [fullName.trim(), ""];
  return [parts[0], parts.slice(1).join(" ")];
}

/* ── Transfert vers une autre saison ─────────────────────────────
 *  Crée une NOUVELLE inscription dans la saison choisie — le lead Été
 *  2026 d'origine n'est jamais modifié ni supprimé. */

function TransferModal({
  lead,
  seasons,
  onClose,
  onTransferred
}: {
  lead: AdminLead;
  seasons: TransferSeasonOption[];
  onClose: () => void;
  onTransferred: () => void;
}) {
  const parsed = parseGoal(lead.goal);
  const [initialFirst, initialLast] = splitName(parsed.childName);

  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [programId, setProgramId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"pending" | "confirmed" | "paid" | "waitlist">("pending");
  const [parentName, setParentName] = useState(lead.parent_name);
  const [parentEmail, setParentEmail] = useState(lead.email);
  const [parentPhone, setParentPhone] = useState(lead.phone);
  const [city, setCity] = useState(lead.city ?? "");
  const [playerFirstName, setPlayerFirstName] = useState(initialFirst);
  const [playerLastName, setPlayerLastName] = useState(initialLast);
  const [playerDob, setPlayerDob] = useState("");
  const [advancedGroup, setAdvancedGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSeason = seasons.find((s) => s.id === seasonId);

  const changeSeason = (id: string) => {
    setSeasonId(id);
    setProgramId("");
    setCategoryId("");
  };

  const submit = async () => {
    if (!parentName.trim() || !parentEmail.trim() || !parentPhone.trim() || !seasonId) {
      setError("Saison, nom, courriel et téléphone du parent sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId,
          programId: programId || null,
          categoryId: categoryId || null,
          timeSlotTemplateId: null,
          parentName: parentName.trim(),
          parentEmail: parentEmail.trim(),
          parentPhone: parentPhone.trim(),
          city: city.trim() || null,
          playerFirstName: playerFirstName.trim() || null,
          playerLastName: playerLastName.trim() || null,
          playerDob: playerDob || null,
          advancedGroup,
          status
        })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Erreur de transfert");
      }
      onTransferred();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-box" style={{ maxWidth: "560px", textAlign: "left" }}>
        <p className="admin-modal-title">Transférer vers une autre saison</p>
        <p style={{ fontSize: "0.78rem", color: "#9d9da0", marginBottom: "1rem" }}>
          Crée une nouvelle inscription dans la saison choisie, pour le programme de votre choix. L&apos;inscription Été 2026 d&apos;origine reste inchangée.
        </p>
        {error && <p className="admin-error" style={{ marginBottom: "0.75rem" }}>{error}</p>}

        {seasons.length === 0 ? (
          <p style={{ fontSize: "0.8rem", color: "#ffb464" }}>Aucune autre saison disponible.</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <label className="admin-field">
                <span>Saison</span>
                <select className="admin-input" value={seasonId} onChange={(e) => changeSeason(e.target.value)}>
                  {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span>Programme</span>
                <select className="admin-input" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  <option value="">—</option>
                  {currentSeason?.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span>Catégorie</span>
                <select className="admin-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">—</option>
                  {currentSeason?.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="admin-field">
                <span>Statut initial</span>
                <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  <option value="pending">En attente</option>
                  <option value="confirmed">Confirmée</option>
                  <option value="paid">Payée</option>
                  <option value="waitlist">Liste d&apos;attente</option>
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <label className="admin-field"><span>Prénom joueuse</span><input className="admin-input" value={playerFirstName} onChange={(e) => setPlayerFirstName(e.target.value)} /></label>
              <label className="admin-field"><span>Nom joueuse</span><input className="admin-input" value={playerLastName} onChange={(e) => setPlayerLastName(e.target.value)} /></label>
              <label className="admin-field"><span>Date de naissance</span><input type="date" className="admin-input" value={playerDob} onChange={(e) => setPlayerDob(e.target.value)} /></label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#c3c2c8", marginTop: "1.4rem" }}>
                <input type="checkbox" checked={advancedGroup} onChange={(e) => setAdvancedGroup(e.target.checked)} /> Groupe avancé
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
              <label className="admin-field"><span>Nom du parent</span><input className="admin-input" value={parentName} onChange={(e) => setParentName(e.target.value)} /></label>
              <label className="admin-field"><span>Courriel</span><input className="admin-input" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} /></label>
              <label className="admin-field"><span>Téléphone</span><input className="admin-input" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} /></label>
              <label className="admin-field"><span>Ville</span><input className="admin-input" value={city} onChange={(e) => setCity(e.target.value)} /></label>
            </div>
          </>
        )}

        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="admin-btn-primary" onClick={submit} disabled={saving || seasons.length === 0}>
            {saving ? "Transfert..." : "Transférer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Transfert vers Sport-Études (garçons) ────────────────────────
 *  Crée une NOUVELLE inscription Sport-Études — le lead Été 2026
 *  d'origine n'est jamais modifié ni supprimé. */

function TransferToSportEtudesModal({ lead, onClose, onTransferred }: { lead: AdminLead; onClose: () => void; onTransferred: () => void }) {
  const parsed = parseGoal(lead.goal);
  const [initialFirst, initialLast] = splitName(parsed.childName);
  const [nameFirst, nameLast] = splitName(lead.parent_name);

  const [playerFirstName, setPlayerFirstName] = useState(initialFirst);
  const [playerLastName, setPlayerLastName] = useState(initialLast);
  const [playerDob, setPlayerDob] = useState("");
  const [parentFirstName, setParentFirstName] = useState(nameFirst);
  const [parentLastName, setParentLastName] = useState(nameLast);
  const [parentEmail, setParentEmail] = useState(lead.email);
  const [parentPhone, setParentPhone] = useState(lead.phone);
  const [optionChosen, setOptionChosen] = useState<"diagnostic_only" | "full_program">("diagnostic_only");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!playerFirstName.trim() || !playerLastName.trim() || !parentFirstName.trim() || !parentLastName.trim() || !parentEmail.trim() || !parentPhone.trim()) {
      setError("Prénom/nom du joueur et coordonnées complètes du parent sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/transfer-to-sport-etudes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerFirstName: playerFirstName.trim(),
          playerLastName: playerLastName.trim(),
          playerDob: playerDob || null,
          playerId: lead.player_id ?? null,
          parentFirstName: parentFirstName.trim(),
          parentLastName: parentLastName.trim(),
          parentEmail: parentEmail.trim(),
          parentPhone: parentPhone.trim(),
          optionChosen
        })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Erreur de transfert");
      }
      onTransferred();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-box" style={{ maxWidth: "560px", textAlign: "left" }}>
        <p className="admin-modal-title">Transférer vers Sport-Études (Garçons)</p>
        <p style={{ fontSize: "0.78rem", color: "#9d9da0", marginBottom: "1rem" }}>
          Crée une nouvelle inscription dans le programme Sport-Études. L&apos;inscription Été 2026 d&apos;origine reste inchangée.
        </p>
        {error && <p className="admin-error" style={{ marginBottom: "0.75rem" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <label className="admin-field"><span>Prénom joueur</span><input className="admin-input" value={playerFirstName} onChange={(e) => setPlayerFirstName(e.target.value)} /></label>
          <label className="admin-field"><span>Nom joueur</span><input className="admin-input" value={playerLastName} onChange={(e) => setPlayerLastName(e.target.value)} /></label>
          <label className="admin-field"><span>Date de naissance</span><input type="date" className="admin-input" value={playerDob} onChange={(e) => setPlayerDob(e.target.value)} /></label>
          <label className="admin-field">
            <span>Option</span>
            <select className="admin-input" value={optionChosen} onChange={(e) => setOptionChosen(e.target.value as "diagnostic_only" | "full_program")}>
              <option value="diagnostic_only">Diagnostic gratuit seulement</option>
              <option value="full_program">Programme complet</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
          <label className="admin-field"><span>Prénom parent</span><input className="admin-input" value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} /></label>
          <label className="admin-field"><span>Nom parent</span><input className="admin-input" value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} /></label>
          <label className="admin-field"><span>Courriel</span><input className="admin-input" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} /></label>
          <label className="admin-field"><span>Téléphone</span><input className="admin-input" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} /></label>
        </div>

        <div className="admin-modal-actions">
          <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="admin-btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Transfert..." : "Transférer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Lead Drawer ───────────────────────────────────────────────── */

interface DrawerProps {
  lead: AdminLead;
  isNew: boolean;
  transferSeasons: TransferSeasonOption[];
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: (lead: AdminLead) => void;
}

function LeadDrawer({ lead, isNew, transferSeasons, onClose, onDeleted, onUpdated }: DrawerProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  const [transferringToSportEtudes, setTransferringToSportEtudes] = useState(false);
  const [transferToSportEtudesDone, setTransferToSportEtudesDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseGoal(lead.goal);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(parsed.childName);
  const [savingName, setSavingName] = useState(false);

  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTrialDate, setSavingTrialDate] = useState(false);

  const handleTrialDateChange = async (newTrialDate: string | null) => {
    setSavingTrialDate(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trial_date: newTrialDate }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur de sauvegarde");
      }
      onUpdated({ ...lead, trial_date: newTrialDate });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingTrialDate(false);
    }
  };

  const handleStatusChange = async (newStatus: AdminLead["status"]) => {
    if (newStatus === lead.status) return;
    setSavingStatus(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur de sauvegarde");
      }
      onUpdated({ ...lead, status: newStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    setError(null);

    // Rebuild goal with child name
    const newGoal = `Joueuse: ${nameInput.trim()} · Poste: ${parsed.position || "Non spécifié"} · Club: ${parsed.club || "Aucun"}`;

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: newGoal }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur de sauvegarde");
      }
      // Update the lead in parent state
      const updatedLead = { ...lead, goal: newGoal };
      onUpdated(updatedLead);
      setEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingName(false);
    }
  };

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
            <div style={{ marginTop: "0.6rem" }}>
              <p className="admin-drawer-label">Changer le statut</p>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                {(["pending", "essai", "confirmed", "paid", "cancelled"] as const).map((s) => {
                  const labels: Record<typeof s, string> = {
                    pending: "En attente",
                    essai: "À l'essai",
                    confirmed: "Confirmée",
                    paid: "Payée",
                    cancelled: "Annulée",
                  };
                  const isActive = lead.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={savingStatus || isActive}
                      style={{
                        padding: "0.35rem 0.7rem",
                        fontSize: "0.72rem",
                        borderRadius: "6px",
                        border: isActive ? "1px solid #8d76a5" : "1px solid #302e36",
                        background: isActive ? "#30283c" : "transparent",
                        color: isActive ? "#fff" : "#9d9da0",
                        cursor: isActive ? "default" : "pointer",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {labels[s]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginTop: "0.7rem" }}>
              <label className="admin-field" style={{ gap: "0.3rem", maxWidth: "220px" }}>
                <span className="admin-drawer-label">Date d&apos;essai</span>
                <input
                  type="date"
                  className="admin-input"
                  min={todayISO()}
                  value={lead.trial_date ?? ""}
                  onChange={(e) => handleTrialDateChange(e.target.value || null)}
                  disabled={savingTrialDate}
                />
              </label>
            </div>
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
            <div className="admin-drawer-field">
              <p className="admin-drawer-label">Nom de la joueuse</p>
              {parsed.childName && !editingName ? (
                <p className="admin-drawer-value" style={{ fontWeight: 600 }}>
                  {parsed.childName}
                  <button
                    onClick={() => { setNameInput(parsed.childName); setEditingName(true); }}
                    style={{ marginLeft: "0.5rem", fontSize: "0.68rem", color: "#7a6690", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    modifier
                  </button>
                </p>
              ) : editingName ? (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="admin-essais-input"
                    placeholder="Prénom Nom de la joueuse"
                    style={{ flex: 1, padding: "0.4rem 0.6rem", fontSize: "0.82rem" }}
                    autoFocus
                  />
                  <button onClick={handleSaveName} disabled={savingName} className="admin-btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                    {savingName ? "..." : "✓"}
                  </button>
                  <button onClick={() => setEditingName(false)} className="admin-btn-ghost" style={{ padding: "0.4rem 0.6rem", fontSize: "0.75rem" }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ color: "#48474d", fontStyle: "italic", fontSize: "0.8rem" }}>Non renseigné</span>
                  <button
                    onClick={() => setEditingName(true)}
                    style={{ fontSize: "0.7rem", color: "#8d76a5", background: "none", border: "1px solid #433751", borderRadius: "4px", padding: "0.2rem 0.5rem", cursor: "pointer" }}
                  >
                    + Ajouter
                  </button>
                </div>
              )}
            </div>
            <div className="admin-drawer-row">
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Groupe d&apos;âge</p>
                <p className="admin-drawer-value admin-drawer-value-cat">
                  {CATEGORY_LABELS[lead.player_age as keyof typeof CATEGORY_LABELS] ??
                    lead.player_age}
                  {CATEGORY_SUBLABELS[lead.player_age as keyof typeof CATEGORY_SUBLABELS] && (
                    <span
                      style={{
                        color: "#545359",
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
            <div className="admin-drawer-row">
              {parsed.position && (
                <div className="admin-drawer-field">
                  <p className="admin-drawer-label">Poste</p>
                  <p className="admin-drawer-value">{parsed.position}</p>
                </div>
              )}
              {parsed.club && (
                <div className="admin-drawer-field">
                  <p className="admin-drawer-label">Club actuel</p>
                  <p className="admin-drawer-value">{parsed.club}</p>
                </div>
              )}
            </div>
            {lead.time_slot && (
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Créneau horaire</p>
                <p className="admin-drawer-value" style={{ fontWeight: 600, color: "#9ec9ff" }}>{lead.time_slot}</p>
              </div>
            )}
            {parsed.referredBy && parsed.referredBy !== "Non spécifié" && (
              <div className="admin-drawer-field">
                <p className="admin-drawer-label">Recommandé par</p>
                <p className="admin-drawer-value" style={{ color: "#b090c8" }}>👋 {parsed.referredBy}</p>
              </div>
            )}
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
                      color: "#6d6b71",
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
                      color: "#6d6b71",
                    }}
                  >
                    {lead.stripe_payment_intent_id}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="admin-drawer-section">
            <EntityDocuments entityType="lead" entityId={lead.id} />
          </div>

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
                  color: "#48474d",
                }}
              >
                {lead.id}
              </p>
            </div>
          </div>

          {error && <p className="admin-error">{error}</p>}
        </div>

        <div className="admin-drawer-footer">
          <button className="admin-btn-ghost" onClick={() => setTransferring(true)} disabled={transferSeasons.length === 0}>
            Transférer vers une saison
          </button>
          <button className="admin-btn-ghost" onClick={() => setTransferringToSportEtudes(true)}>
            Transférer vers Sport-Études (Garçons)
          </button>
          <button className="admin-btn-danger" onClick={() => setConfirming(true)}>
            Supprimer l&apos;inscription
          </button>
          <button className="admin-btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>

      {transferring && (
        <TransferModal
          lead={lead}
          seasons={transferSeasons}
          onClose={() => setTransferring(false)}
          onTransferred={() => {
            setTransferring(false);
            setTransferDone(true);
            setTimeout(() => setTransferDone(false), 3000);
          }}
        />
      )}
      {transferringToSportEtudes && (
        <TransferToSportEtudesModal
          lead={lead}
          onClose={() => setTransferringToSportEtudes(false)}
          onTransferred={() => {
            setTransferringToSportEtudes(false);
            setTransferToSportEtudesDone(true);
            setTimeout(() => setTransferToSportEtudesDone(false), 3000);
          }}
        />
      )}
      {transferToSportEtudesDone && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Transfert réussi</p>
            <p className="admin-modal-body">L&apos;inscription a été créée dans le programme Sport-Études.</p>
            <div className="admin-modal-actions">
              <button className="admin-btn-primary" onClick={() => setTransferToSportEtudesDone(false)}>OK</button>
            </div>
          </div>
        </div>
      )}
      {transferDone && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Transfert réussi</p>
            <p className="admin-modal-body">
              Une nouvelle inscription a été créée dans la saison choisie. L&apos;inscription Été 2026 de{" "}
              <span className="admin-modal-name">{lead.parent_name}</span> reste inchangée.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn-primary" onClick={() => setTransferDone(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

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
  transferSeasons: TransferSeasonOption[];
}

export function AdminInscriptions({ leads: initialLeads, transferSeasons }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<AdminLead | null>(null);
  const [seenSince, setSeenSince] = useState(0);
  const [resetDone, setResetDone] = useState(false);

  // Club aliases (loaded from API)
  const [clubGroups, setClubGroups] = useState<ClubGroup[]>([]);

  useEffect(() => {
    fetch("/api/admin/clubs")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { groups: ClubGroup[] } | null) => {
        if (data?.groups) setClubGroups(data.groups);
      })
      .catch(() => { /* silent */ });
  }, []);

  const normalizeClub = (raw: string): string => {
    if (!raw) return raw;
    const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
    for (const g of clubGroups) {
      if (g.canonical.trim().toLowerCase() === key) return g.canonical;
      if (g.aliases.some((a) => a.trim().toLowerCase() === key)) return g.canonical;
    }
    return raw;
  };

  // Advanced filters
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "parent_asc" | "child_asc" | "club_asc">("date_desc");

  // Build unique lists for dropdowns (clubs are normalized via aliases)
  const allClubs = Array.from(new Set(leads.map((l) => normalizeClub(parseGoal(l.goal).club)).filter(Boolean))).sort();
  const allPositions = Array.from(new Set(leads.map((l) => parseGoal(l.goal).position).filter(Boolean))).sort();
  const allLevels = Array.from(new Set(leads.map((l) => l.player_level).filter(Boolean))).sort();

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
  const countConfirmed = leads.filter((l) => l.status === "confirmed" && !l.is_waitlist).length;
  const countPending = leads.filter((l) => l.status === "pending" && !l.is_waitlist).length;
  const countEssai = leads.filter((l) => l.status === "essai" && !l.is_waitlist).length;
  const countWaitlist = leads.filter((l) => l.is_waitlist).length;
  const countCancelled = leads.filter((l) => l.status === "cancelled").length;

  /* ── Filtered + sorted ── */
  const filteredLeads = leads
    .filter((lead) => {
      if (filter === "all" && lead.status === "cancelled") return false;
      if (filter === "paid" && (lead.status !== "paid" || lead.is_waitlist)) return false;
      if (filter === "confirmed" && (lead.status !== "confirmed" || lead.is_waitlist)) return false;
      if (filter === "pending" && (lead.status !== "pending" || lead.is_waitlist)) return false;
      if (filter === "essai" && (lead.status !== "essai" || lead.is_waitlist)) return false;
      if (filter === "waitlist" && !lead.is_waitlist) return false;
      if (filter === "new" && !isNewLead(lead.created_at, seenSince)) return false;
      if (filter === "cancelled" && lead.status !== "cancelled") return false;
      if (categoryFilter !== "all" && lead.player_age !== categoryFilter) return false;

      const goalParsed = parseGoal(lead.goal);
      if (clubFilter !== "all" && normalizeClub(goalParsed.club) !== clubFilter) return false;
      if (positionFilter !== "all" && goalParsed.position !== positionFilter) return false;
      if (levelFilter !== "all" && lead.player_level !== levelFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !lead.parent_name.toLowerCase().includes(q) &&
          !lead.email.toLowerCase().includes(q) &&
          !lead.city?.toLowerCase().includes(q) &&
          !lead.phone?.includes(q) &&
          !goalParsed.childName.toLowerCase().includes(q) &&
          !goalParsed.club.toLowerCase().includes(q) &&
          !normalizeClub(goalParsed.club).toLowerCase().includes(q) &&
          !goalParsed.referredBy.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const aGoal = parseGoal(a.goal);
      const bGoal = parseGoal(b.goal);
      switch (sortBy) {
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "parent_asc":
          return a.parent_name.localeCompare(b.parent_name, "fr");
        case "child_asc":
          return aGoal.childName.localeCompare(bGoal.childName, "fr");
        case "club_asc":
          return aGoal.club.localeCompare(bGoal.club, "fr");
        case "date_desc":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const hasActiveAdvancedFilter = clubFilter !== "all" || positionFilter !== "all" || levelFilter !== "all";

  const resetAdvancedFilters = () => {
    setClubFilter("all");
    setPositionFilter("all");
    setLevelFilter("all");
  };

  /* ── Export CSV ── */
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Nom parent",
      "Nom joueuse",
      "Courriel",
      "Téléphone",
      "Groupe",
      "Créneau",
      "Niveau",
      "Poste",
      "Club",
      "Recommandé par",
      "Statut",
      "Liste attente",
    ];
    const rows = filteredLeads.map((l) => {
      const g = parseGoal(l.goal);
      const refBy = g.referredBy && g.referredBy !== "Non spécifié" ? g.referredBy : "";
      return [
        new Date(l.created_at).toLocaleDateString("fr-CA"),
        l.parent_name,
        g.childName,
        l.email,
        l.phone,
        l.player_age,
        l.time_slot ?? "",
        l.player_level,
        g.position,
        normalizeClub(g.club),
        refBy,
        l.status,
        l.is_waitlist ? "Oui" : "Non",
      ];
    });
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
                  ["all", "Toutes", leads.length - countCancelled],
                  ["new", "Nouvelles", countNew],
                  ["confirmed", "Confirmées", countConfirmed],
                  ["paid", "Payées", countPaid],
                  ["pending", "En attente", countPending],
                  ["essai", "À l'essai", countEssai],
                  ["waitlist", "Liste d'attente", countWaitlist],
                  ["cancelled", "Annulées", countCancelled],
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
                placeholder="Rechercher parent, joueuse, courriel…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-search-input"
              />
            </div>
            <span
              style={{
                fontSize: "0.62rem",
                color: "#3c3a41",
                marginLeft: "auto",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {filteredLeads.length} résultat{filteredLeads.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Advanced filters row */}
          <div
            className="admin-filters-row"
            style={{ marginBottom: "1rem", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}
          >
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="admin-group-select"
              title="Filtrer par club"
            >
              <option value="all">Tous les clubs</option>
              {allClubs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="admin-group-select"
              title="Filtrer par poste"
            >
              <option value="all">Tous les postes</option>
              {allPositions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="admin-group-select"
              title="Filtrer par niveau"
            >
              <option value="all">Tous les niveaux</option>
              {allLevels.map((lv) => (
                <option key={lv} value={lv}>{lv}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="admin-group-select"
              title="Trier par"
              style={{ borderColor: "#554766" }}
            >
              <option value="date_desc">↓ Plus récentes</option>
              <option value="date_asc">↑ Plus anciennes</option>
              <option value="parent_asc">A→Z Nom parent</option>
              <option value="child_asc">A→Z Nom joueuse</option>
              <option value="club_asc">A→Z Club</option>
            </select>

            {hasActiveAdvancedFilter && (
              <button
                onClick={resetAdvancedFilters}
                style={{
                  padding: "0.4rem 0.7rem",
                  fontSize: "0.7rem",
                  background: "transparent",
                  border: "1px solid rgba(255,100,100,0.3)",
                  color: "rgba(255,150,150,0.8)",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                ✕ Réinitialiser filtres
              </button>
            )}
          </div>

          {/* Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom parent</th>
                  <th>Joueuse</th>
                  <th>Courriel</th>
                  <th>Téléphone</th>
                  <th>Groupe</th>
                  <th>Créneau</th>
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
                    const _parsed = parseGoal(lead.goal);
                    return (
                      <tr
                        key={lead.id}
                        className="admin-tr-clickable"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="admin-td-date" suppressHydrationWarning>{formatDate(lead.created_at)}</td>
                        <td className="admin-td-name">{lead.parent_name}</td>
                        <td className="admin-td-name">{_parsed.childName || "—"}</td>
                        <td className="admin-td-email">{lead.email}</td>
                        <td className="admin-td-phone">{lead.phone}</td>
                        <td className="admin-td-cat">
                          {CATEGORY_LABELS[
                            lead.player_age as keyof typeof CATEGORY_LABELS
                          ] ?? lead.player_age}
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "#858489" }}>{lead.time_slot || "—"}</td>
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
                color: "#48474d",
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
          transferSeasons={transferSeasons}
          onClose={() => setSelectedLead(null)}
          onDeleted={handleDeleted}
          onUpdated={(updatedLead) => {
            setLeads((prev) => prev.map((l) => l.id === updatedLead.id ? updatedLead : l));
            setSelectedLead(updatedLead);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
