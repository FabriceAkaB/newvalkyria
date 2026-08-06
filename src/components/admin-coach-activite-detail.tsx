"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { computeAssignment, computeHours, formatHours } from "@/lib/coach-payroll";
import type { AssignmentStatus, Coach, CoachActivity, CoachAssignment, CoachTypeRate } from "@/lib/coaches-repo";
import { formatCAD } from "@/lib/season-2027";

type AssignmentWithCoach = CoachAssignment & { coach: Coach };

interface Props {
  activity: CoachActivity;
  initialAssignments: AssignmentWithCoach[];
  coaches: Coach[];
  typeRates: CoachTypeRate[];
}

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  present: "Présent",
  absent: "Absent",
  replaced: "Remplacé",
  cancelled: "Annulé"
};

function PaymentPanel({ assignment, onSaved }: { assignment: AssignmentWithCoach; onSaved: (patch: Partial<AssignmentWithCoach>) => void }) {
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(assignment.paid_on ?? new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(assignment.payment_method ?? "");
  const [reference, setReference] = useState(assignment.payment_reference ?? "");
  const [notes, setNotes] = useState(assignment.payment_notes ?? "");
  const [saving, setSaving] = useState(false);

  const togglePaid = async () => {
    const nextPaid = !assignment.paid;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/coach-assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          nextPaid
            ? { paid: true, paidOn, paymentMethod: method || null, paymentReference: reference || null, paymentNotes: notes || null }
            : { paid: false }
        )
      });
      if (res.ok) {
        onSaved(nextPaid ? { paid: true, paid_on: paidOn, payment_method: method || null, payment_reference: reference || null, payment_notes: notes || null } : { paid: false });
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => (assignment.paid ? togglePaid() : setOpen((o) => !o))}
        disabled={saving}
        className={assignment.paid ? "admin-btn-ghost" : "admin-btn-primary"}
        style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}
      >
        {assignment.paid ? "✓ Payé — annuler" : "Marquer payé"}
      </button>
      {open && !assignment.paid && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
          <input type="date" className="admin-input" style={{ fontSize: "0.7rem", padding: "0.25rem 0.4rem" }} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          <input placeholder="Mode de paiement" className="admin-input" style={{ fontSize: "0.7rem", padding: "0.25rem 0.4rem", width: "120px" }} value={method} onChange={(e) => setMethod(e.target.value)} />
          <input placeholder="Référence" className="admin-input" style={{ fontSize: "0.7rem", padding: "0.25rem 0.4rem", width: "100px" }} value={reference} onChange={(e) => setReference(e.target.value)} />
          <input placeholder="Notes" className="admin-input" style={{ fontSize: "0.7rem", padding: "0.25rem 0.4rem", width: "120px" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="admin-btn-primary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }} onClick={togglePaid} disabled={saving}>Confirmer</button>
        </div>
      )}
    </div>
  );
}

function AssignmentRow({
  assignment,
  activity,
  defaultRateCents,
  typeRateCents,
  onUpdate,
  onRemove
}: {
  assignment: AssignmentWithCoach;
  activity: CoachActivity;
  defaultRateCents: number;
  typeRateCents: number | null;
  onUpdate: (id: string, patch: Partial<AssignmentWithCoach>) => void;
  onRemove: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  const patch = async (body: Record<string, unknown>, optimistic: Partial<AssignmentWithCoach>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/coach-assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) onUpdate(assignment.id, optimistic);
    } finally {
      setSaving(false);
    }
  };

  const computed = computeAssignment({
    status: assignment.status,
    arrivalTime: assignment.arrival_time,
    departureTime: assignment.departure_time,
    activityStartTime: activity.start_time,
    activityEndTime: activity.end_time,
    assignmentRateCents: assignment.hourly_rate_cents,
    typeRateCents,
    defaultRateCents
  });

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", opacity: saving ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>{assignment.coach.first_name} {assignment.coach.last_name}</p>
          <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0.1rem 0 0" }}>{assignment.coach.role}</p>
        </div>
        <button onClick={() => onRemove(assignment.id)} className="admin-btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem" }}>Retirer</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginBottom: "0.65rem" }}>
        <label className="admin-field" style={{ gap: "0.25rem" }}>
          <span style={{ fontSize: "0.6rem" }}>Présence</span>
          <select
            className="admin-input"
            value={assignment.status}
            onChange={(e) => patch({ status: e.target.value }, { status: e.target.value as AssignmentStatus })}
          >
            {(Object.keys(STATUS_LABELS) as AssignmentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="admin-field" style={{ gap: "0.25rem" }}>
          <span style={{ fontSize: "0.6rem" }}>Arrivée</span>
          <input type="time" className="admin-input" value={assignment.arrival_time ?? activity.start_time} onChange={(e) => patch({ arrivalTime: e.target.value }, { arrival_time: e.target.value })} />
        </label>
        <label className="admin-field" style={{ gap: "0.25rem" }}>
          <span style={{ fontSize: "0.6rem" }}>Départ</span>
          <input type="time" className="admin-input" value={assignment.departure_time ?? activity.end_time} onChange={(e) => patch({ departureTime: e.target.value }, { departure_time: e.target.value })} />
        </label>
        <label className="admin-field" style={{ gap: "0.25rem" }}>
          <span style={{ fontSize: "0.6rem" }}>Taux horaire $ (surcharge)</span>
          <input
            type="number" min={0} step="0.01" className="admin-input"
            placeholder={(computed.rateCents / 100).toFixed(2)}
            value={assignment.hourly_rate_cents !== null ? (assignment.hourly_rate_cents / 100).toFixed(2) : ""}
            onChange={(e) => {
              const v = e.target.value;
              const cents = v === "" ? null : Math.round(parseFloat(v) * 100);
              patch({ hourlyRateCents: cents }, { hourly_rate_cents: cents });
            }}
          />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
        <p style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: 0 }}>
          {formatHours(computed.hours)} × {formatCAD(computed.rateCents / 100)} = <strong style={{ color: "#fff" }}>{formatCAD(computed.payCents / 100)}</strong>
        </p>
        <PaymentPanel assignment={assignment} onSaved={(p) => onUpdate(assignment.id, p)} />
      </div>
    </div>
  );
}

export function AdminCoachActiviteDetail({ activity, initialAssignments, coaches, typeRates }: Props) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeRateFor = (coachId: string) => typeRates.find((r) => r.coach_id === coachId && r.activity_type === activity.activity_type)?.hourly_rate_cents ?? null;

  const assignedIds = new Set(assignments.map((a) => a.coach_id));
  const availableCoaches = coaches.filter((c) => c.status === "active" && !assignedIds.has(c.id));

  const assign = async (coachId: string) => {
    const res = await fetch(`/api/admin/coach-activities/${activity.id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId })
    });
    if (!res.ok) return;
    const data = await res.json();
    const coach = coaches.find((c) => c.id === coachId)!;
    setAssignments((prev) => [...prev, { ...data.assignment, coach }]);
  };

  const updateAssignment = (id: string, patch: Partial<AssignmentWithCoach>) => {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAssignment = async (id: string) => {
    const res = await fetch(`/api/admin/coach-assignments/${id}`, { method: "DELETE" });
    if (res.ok) setAssignments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDeleteActivity = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coach-activities/${activity.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      window.location.href = "/admin/entraineurs/activites";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setDeleting(false);
      setConfirming(false);
    }
  };

  const totals = assignments.reduce(
    (acc, a) => {
      const computed = computeAssignment({
        status: a.status,
        arrivalTime: a.arrival_time,
        departureTime: a.departure_time,
        activityStartTime: activity.start_time,
        activityEndTime: activity.end_time,
        assignmentRateCents: a.hourly_rate_cents,
        typeRateCents: typeRateFor(a.coach_id),
        defaultRateCents: a.coach.default_hourly_rate_cents
      });
      acc.hours += computed.hours;
      acc.payCents += computed.payCents;
      return acc;
    },
    { hours: 0, payCents: 0 }
  );

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <Link href="/admin/entraineurs/activites" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Activités
          </Link>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <div>
              <p className="admin-section-title" style={{ margin: 0 }}>
                {activity.title ? `${activity.activity_type} — ${activity.title}` : activity.activity_type}
              </p>
              <p style={{ fontSize: "0.85rem", color: "#c3c2c8", margin: "0.3rem 0 0" }}>
                {new Date(activity.activity_date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {" · "}{activity.start_time.slice(0, 5)}–{activity.end_time.slice(0, 5)}
                {" · "}{formatHours(computeHours(activity.start_time, activity.end_time))}
                {activity.location && ` · ${activity.location}`}
                {activity.category && ` · ${activity.category}`}
              </p>
            </div>
            <button className="admin-btn-danger" onClick={() => setConfirming(true)}>Supprimer l&apos;activité</button>
          </div>

          {error && <p className="admin-error">{error}</p>}

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "1.25rem 0" }}>
            <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.8rem 1.1rem" }}>
              <p style={{ fontSize: "0.65rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Total heures assignées</p>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: 0 }}>{formatHours(totals.hours)}</p>
            </div>
            <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.8rem 1.1rem" }}>
              <p style={{ fontSize: "0.65rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Total à payer</p>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: 0 }}>{formatCAD(totals.payCents / 100)}</p>
            </div>
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Entraîneurs assignés ({assignments.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
            {assignments.length === 0 && <p className="admin-empty-text">Aucun entraîneur assigné à cette activité.</p>}
            {assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                activity={activity}
                defaultRateCents={a.coach.default_hourly_rate_cents}
                typeRateCents={typeRateFor(a.coach_id)}
                onUpdate={updateAssignment}
                onRemove={removeAssignment}
              />
            ))}
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Assigner un entraîneur</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {availableCoaches.map((c) => (
              <button key={c.id} onClick={() => assign(c.id)} className="admin-btn-ghost" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                + {c.first_name} {c.last_name}
              </button>
            ))}
            {availableCoaches.length === 0 && <p className="admin-empty-text">Tous les entraîneurs actifs sont déjà assignés.</p>}
          </div>
        </div>
      </div>

      {confirming && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Supprimer cette activité ?</p>
            <p className="admin-modal-body">
              L&apos;activité et toutes ses assignations d&apos;entraîneurs seront définitivement supprimées. Cette action est irréversible.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>Annuler</button>
              <button className="admin-btn-danger" onClick={handleDeleteActivity} disabled={deleting}>{deleting ? "Suppression..." : "Supprimer définitivement"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
