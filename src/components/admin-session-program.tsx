"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { RegistrationStatus, SessionProgram, SessionProgramDate, SessionProgramRegistration } from "@/lib/session-programs-repo";

const REGISTRATION_STATUSES: { value: RegistrationStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "paid", label: "Payée" },
  { value: "waitlist", label: "Liste d'attente" },
  { value: "cancelled", label: "Annulée" }
];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "short", month: "short", day: "numeric" });
}

function RegistrationRow({
  registration,
  slug,
  onStatusChanged,
  onDeleted
}: {
  registration: SessionProgramRegistration;
  slug: string;
  onStatusChanged: (status: RegistrationStatus) => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changeStatus = async (status: RegistrationStatus) => {
    setChangingStatus(true);
    try {
      await fetch(`/api/admin/session-programs/${slug}/registrations/${registration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      onStatusChanged(status);
    } finally {
      setChangingStatus(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer définitivement l'inscription de ${registration.player_first_name} ${registration.player_last_name} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/session-programs/${slug}/registrations/${registration.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.7rem 0.9rem", marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: 0 }}>
            {registration.player_first_name} {registration.player_last_name}
          </p>
          <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.15rem 0 0" }}>
            {registration.parent_name} · {registration.parent_email} · {registration.parent_phone}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="admin-badge">{REGISTRATION_STATUSES.find((s) => s.value === registration.status)?.label ?? registration.status}</span>
          <button onClick={() => setOpen((v) => !v)} className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>{open ? "▾" : "▸"} Détails</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "0.6rem" }}>
          <p style={{ fontSize: "0.68rem", color: "#9f85ba", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Changer le statut</p>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            {REGISTRATION_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => changeStatus(s.value)}
                disabled={changingStatus || registration.status === s.value}
                className={registration.status === s.value ? "admin-btn-primary" : "admin-btn-ghost"}
                style={{ fontSize: "0.68rem", padding: "0.3rem 0.6rem" }}
              >
                {s.label}
              </button>
            ))}
          </div>
          {registration.player_dob && <p style={{ fontSize: "0.72rem", color: "#c3c2c8", margin: "0 0 0.3rem" }}>Date de naissance : {registration.player_dob}</p>}
          {registration.city && <p style={{ fontSize: "0.72rem", color: "#c3c2c8", margin: "0 0 0.3rem" }}>Ville : {registration.city}</p>}
          {registration.comments && <p style={{ fontSize: "0.72rem", color: "#c3c2c8", margin: "0 0 0.3rem" }}>Commentaires : {registration.comments}</p>}
          {registration.price_cents != null && <p style={{ fontSize: "0.72rem", color: "#c3c2c8", margin: "0 0 0.3rem" }}>Prix : {(registration.price_cents / 100).toFixed(2)} $</p>}

          <button
            onClick={remove}
            disabled={deleting}
            style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.35rem 0.7rem", cursor: "pointer" }}
          >
            {deleting ? "..." : "Supprimer définitivement"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminSessionProgram({
  slug,
  program,
  initialDates,
  initialRegistrations
}: {
  slug: string;
  program: SessionProgram;
  initialDates: SessionProgramDate[];
  initialRegistrations: SessionProgramRegistration[];
}) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [copyingEmails, setCopyingEmails] = useState(false);
  const [copyEmailsMessage, setCopyEmailsMessage] = useState<string | null>(null);

  const active = registrations.filter((r) => r.status !== "cancelled");
  const waitlisted = active.filter((r) => r.status === "waitlist");
  const nonWaitlisted = registrations.filter((r) => r.status !== "waitlist");
  const confirmedCount = active.filter((r) => r.status === "confirmed" || r.status === "paid").length;
  const paidCount = active.filter((r) => r.status === "paid").length;
  const pendingCount = active.filter((r) => r.status === "pending").length;

  const copyEmails = async () => {
    setCopyingEmails(true);
    setCopyEmailsMessage(null);
    try {
      const emails = Array.from(new Set(active.map((r) => r.parent_email.trim().toLowerCase()))).sort();
      if (emails.length === 0) {
        setCopyEmailsMessage("Aucun courriel trouvé.");
        return;
      }
      const joined = emails.join("; ");
      try {
        await navigator.clipboard.writeText(joined);
        setCopyEmailsMessage(`${emails.length} courriel(s) copié(s) dans le presse-papier.`);
      } catch {
        window.prompt(`Copie manuelle (Ctrl+C / Cmd+C) — ${emails.length} courriel(s) :`, joined);
      }
    } finally {
      setCopyingEmails(false);
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>{program.name}</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            {program.description} — {program.birth_years} ({program.gender === "filles" ? "filles" : "garçons"}) · {(program.price_cents / 100).toFixed(2)} $
          </p>

          <div className="admin-stats" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-stat-card"><p className="admin-stat-value">{active.length}</p><p className="admin-stat-label">Total inscrits</p></div>
            <div className="admin-stat-card admin-stat-card-accent"><p className="admin-stat-value">{paidCount}</p><p className="admin-stat-label">Payées</p></div>
            <div className="admin-stat-card admin-stat-card-warn"><p className="admin-stat-value">{pendingCount}</p><p className="admin-stat-label">En attente</p></div>
            <div className="admin-stat-card admin-stat-card-warn"><p className="admin-stat-value">{waitlisted.length}</p><p className="admin-stat-label">Liste d&apos;attente</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{Math.max(0, program.max_capacity - confirmedCount)}</p><p className="admin-stat-label">Places restantes</p></div>
          </div>

          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem" }}>Séances ({initialDates.length})</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {initialDates.map((d) => (
              <span key={d.id} style={{ fontSize: "0.68rem", color: "#9d9da0", background: "#17151e", border: "1px solid #251f30", borderRadius: "6px", padding: "0.3rem 0.55rem" }}>
                {formatDate(d.session_date)} · {d.start_time}–{d.end_time}
              </span>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "1.5rem 0 0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", margin: 0 }}>Inscrits ({registrations.length})</p>
            <button className="admin-btn-ghost" onClick={copyEmails} disabled={copyingEmails} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>
              {copyingEmails ? "..." : "📋 Copier tous les courriels"}
            </button>
          </div>
          {copyEmailsMessage && <p style={{ fontSize: "0.7rem", color: "#8fce9f", margin: "-0.3rem 0 0.6rem" }}>{copyEmailsMessage}</p>}

          {waitlisted.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f0c878", marginBottom: "0.6rem" }}>Liste d&apos;attente ({waitlisted.length})</p>
              {waitlisted.map((r) => (
                <RegistrationRow
                  key={r.id}
                  registration={r}
                  slug={slug}
                  onStatusChanged={(status) => setRegistrations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))}
                  onDeleted={() => setRegistrations((prev) => prev.filter((x) => x.id !== r.id))}
                />
              ))}
            </div>
          )}

          {registrations.length === 0 && <p className="admin-empty-text">Aucune inscription pour l&apos;instant.</p>}
          {nonWaitlisted.map((r) => (
            <RegistrationRow
              key={r.id}
              registration={r}
              slug={slug}
              onStatusChanged={(status) => setRegistrations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))}
              onDeleted={() => setRegistrations((prev) => prev.filter((x) => x.id !== r.id))}
            />
          ))}
        </div>
      </div>
    </>
  );
}
