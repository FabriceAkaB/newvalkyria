"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatHours } from "@/lib/coach-payroll";
import type { CoachNotification } from "@/lib/coach-payroll-data";
import { COACH_ROLES, type Coach } from "@/lib/coaches-repo";
import { formatCAD } from "@/lib/season-2027";

export interface CoachSummary {
  coach: Coach;
  hoursWeek: number;
  hoursMonth: number;
  hoursTotal: number;
  payOwedCents: number;
  payPaidCents: number;
  balanceCents: number;
}

const NOTIFICATION_ICON: Record<CoachNotification["type"], string> = {
  unpaid: "💰",
  overdue: "⏰",
  unconfirmed: "❓",
  unassigned: "⚠️"
};

function NotificationsPanel({ notifications }: { notifications: CoachNotification[] }) {
  if (notifications.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
      {notifications.map((n) => (
        <Link
          key={n.type}
          href={n.href}
          style={{
            display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none",
            background: "rgba(255,180,100,0.08)", border: "1px solid rgba(255,180,100,0.3)",
            borderRadius: "8px", padding: "0.6rem 0.9rem", fontSize: "0.78rem", color: "#ffb464"
          }}
        >
          <span>{NOTIFICATION_ICON[n.type]}</span>
          <span>{n.message}</span>
        </Link>
      ))}
    </div>
  );
}

interface Props {
  summaries: CoachSummary[];
  notifications: CoachNotification[];
}

function NewCoachForm({ onCreated }: { onCreated: (coach: Coach) => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(COACH_ROLES[0]);
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError("Prénom et nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          role,
          defaultHourlyRateCents: Math.round((parseFloat(rate.replace(",", ".")) || 0) * 100)
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erreur"); }
      const data = await res.json();
      onCreated({
        id: data.id, first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null,
        email: email.trim() || null, status: "active", role, default_hourly_rate_cents: Math.round((parseFloat(rate.replace(",", ".")) || 0) * 100),
        hired_on: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      setFirstName(""); setLastName(""); setPhone(""); setEmail(""); setRate(""); setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return <button className="admin-btn-primary" onClick={() => setOpen(true)}>+ Nouvel entraîneur</button>;

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <input className="admin-input" placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input className="admin-input" placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input className="admin-input" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input className="admin-input" placeholder="Courriel" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: "1 1 180px" }} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <select className="admin-input" value={role} onChange={(e) => setRole(e.target.value)}>
          {COACH_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="admin-input" type="number" min={0} step="0.01" placeholder="Taux horaire $" value={rate} onChange={(e) => setRate(e.target.value)} style={{ width: "140px" }} />
        <button className="admin-btn-primary" onClick={create} disabled={saving}>{saving ? "..." : "Créer"}</button>
        <button className="admin-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}

export function AdminEntraineurs({ summaries: initial, notifications }: Props) {
  const [summaries, setSummaries] = useState(initial);

  const totalWeekHours = summaries.reduce((s, c) => s + c.hoursWeek, 0);
  const totalMonthHours = summaries.reduce((s, c) => s + c.hoursMonth, 0);
  const totalOwed = summaries.reduce((s, c) => s + c.balanceCents, 0);
  const totalPaid = summaries.reduce((s, c) => s + c.payPaidCents, 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Entraîneurs</p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <Link href="/admin/entraineurs/statistiques" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Statistiques</Link>
              <Link href="/admin/entraineurs/paie" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Paie</Link>
              <Link href="/admin/entraineurs/activites" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Activités →</Link>
            </div>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Présences, heures travaillées et salaires calculés automatiquement pour chaque entraîneur.
          </p>

          <NotificationsPanel notifications={notifications} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", flex: "1 1 160px" }}>
              <p style={{ fontSize: "0.65rem", color: "#6d6b71", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.3rem" }}>Heures — semaine</p>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", margin: 0 }}>{formatHours(totalWeekHours)}</p>
            </div>
            <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", flex: "1 1 160px" }}>
              <p style={{ fontSize: "0.65rem", color: "#6d6b71", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.3rem" }}>Heures — mois</p>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", margin: 0 }}>{formatHours(totalMonthHours)}</p>
            </div>
            <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", flex: "1 1 160px" }}>
              <p style={{ fontSize: "0.65rem", color: "#6d6b71", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.3rem" }}>Masse salariale payée</p>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#7fd88f", margin: 0 }}>{formatCAD(totalPaid / 100)}</p>
            </div>
            <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", flex: "1 1 160px" }}>
              <p style={{ fontSize: "0.65rem", color: "#6d6b71", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.3rem" }}>Reste à payer</p>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: totalOwed > 0 ? "#ffb464" : "#fff", margin: 0 }}>{formatCAD(totalOwed / 100)}</p>
            </div>
          </div>

          <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0 0 1.25rem" }}>
            Les salaires marqués payés sont automatiquement inclus comme charge dans{" "}
            <Link href="/admin/revenus" style={{ color: "#8d76a5", textDecoration: "underline" }}>Revenus</Link>.
          </p>

          <NewCoachForm onCreated={(coach) => setSummaries((prev) => [...prev, { coach, hoursWeek: 0, hoursMonth: 0, hoursTotal: 0, payOwedCents: 0, payPaidCents: 0, balanceCents: 0 }])} />

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Entraîneur</th>
                  <th>Statut</th>
                  <th>Heures semaine</th>
                  <th>Heures mois</th>
                  <th>Heures total</th>
                  <th>Payé</th>
                  <th>Reste à payer</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.coach.id} className="admin-tr-clickable" onClick={() => { window.location.href = `/admin/entraineurs/${s.coach.id}`; }}>
                    <td>{s.coach.first_name} {s.coach.last_name}<br /><span style={{ fontSize: "0.68rem", color: "#6d6b71" }}>{s.coach.role}</span></td>
                    <td>{s.coach.status === "active" ? "Actif" : "Inactif"}</td>
                    <td>{formatHours(s.hoursWeek)}</td>
                    <td>{formatHours(s.hoursMonth)}</td>
                    <td>{formatHours(s.hoursTotal)}</td>
                    <td>{formatCAD(s.payPaidCents / 100)}</td>
                    <td style={{ color: s.balanceCents > 0 ? "#ffb464" : "#7fd88f", fontWeight: 600 }}>{formatCAD(s.balanceCents / 100)}</td>
                  </tr>
                ))}
                {summaries.length === 0 && (
                  <tr><td colSpan={7} className="admin-empty-text">Aucun entraîneur pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
