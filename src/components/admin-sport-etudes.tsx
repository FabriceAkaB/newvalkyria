"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type {
  AttendanceStatus,
  EnrollmentWithSession,
  NotePhase,
  RegistrationStatus,
  SportEtudesRegistration,
  SportEtudesSession,
  SportEtudesSettings,
  TechnicalNotes
} from "@/lib/sport-etudes-repo";

const RATING_FIELDS: { key: string; label: string }[] = [
  { key: "technique", label: "Technique" },
  { key: "ball_control", label: "Conduite de balle" },
  { key: "passing", label: "Passe" },
  { key: "first_touch", label: "Contrôle" },
  { key: "one_v_one", label: "1 contre 1" },
  { key: "speed", label: "Vitesse" },
  { key: "decision_making", label: "Prise de décision" },
  { key: "game_understanding", label: "Compréhension du jeu" },
  { key: "finishing", label: "Finition" }
];

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  justified_absent: "Absent justifié",
  to_confirm: "À confirmer"
};

type RegistrationWithEnrollments = SportEtudesRegistration & { enrollments: EnrollmentWithSession[] };

function SessionRow({ session, onSaved }: { session: SportEtudesSession; onSaved: () => void }) {
  const [sessionDate, setSessionDate] = useState(session.session_date);
  const [startTime, setStartTime] = useState(session.start_time ?? "");
  const [endTime, setEndTime] = useState(session.end_time ?? "");
  const [location, setLocation] = useState(session.location);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/sport-etudes/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate,
          startTime: startTime || null,
          endTime: endTime || null,
          location,
          isTimeTbd: !startTime
        })
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const confirmWarning = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/sport-etudes/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminWarning: null })
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.7rem 0.9rem", marginBottom: "0.5rem" }}>
      {session.admin_warning && (
        <div style={{ background: "rgba(240,200,120,0.1)", border: "1px solid rgba(240,200,120,0.3)", borderRadius: "6px", padding: "0.5rem 0.7rem", marginBottom: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "0.72rem", color: "#f0c878" }}>⚠ {session.admin_warning}</span>
          <button onClick={confirmWarning} disabled={saving} className="admin-btn-ghost" style={{ fontSize: "0.68rem", padding: "0.25rem 0.6rem", flexShrink: 0 }}>Confirmé</button>
        </div>
      )}
      <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff", margin: "0 0 0.5rem" }}>{session.label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input type="date" className="admin-input" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} style={{ width: "auto" }} />
        <input type="time" className="admin-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ width: "auto" }} placeholder="Heure à confirmer" />
        <input type="time" className="admin-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ width: "auto" }} />
        <input className="admin-input" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: "1 1 200px" }} />
        <button onClick={save} disabled={saving} className="admin-btn-primary" style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>
          {saving ? "..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function TechnicalNotesEditor({ registrationId, existing }: { registrationId: string; existing: TechnicalNotes[] }) {
  const [phase, setPhase] = useState<NotePhase>("initial");
  const current = existing.find((n) => n.phase === phase);
  const [ratings, setRatings] = useState<Record<string, number | null>>(
    Object.fromEntries(RATING_FIELDS.map((f) => [f.key, (current?.[f.key as keyof TechnicalNotes] as number | null) ?? null]))
  );
  const [strengths, setStrengths] = useState(current?.strengths ?? "");
  const [areasToImprove, setAreasToImprove] = useState(current?.areas_to_improve ?? "");
  const [coachNotes, setCoachNotes] = useState(current?.coach_notes ?? "");
  const [saving, setSaving] = useState(false);

  const switchPhase = (p: NotePhase) => {
    setPhase(p);
    const n = existing.find((x) => x.phase === p);
    setRatings(Object.fromEntries(RATING_FIELDS.map((f) => [f.key, (n?.[f.key as keyof TechnicalNotes] as number | null) ?? null])));
    setStrengths(n?.strengths ?? "");
    setAreasToImprove(n?.areas_to_improve ?? "");
    setCoachNotes(n?.coach_notes ?? "");
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/sport-etudes/technical-notes/${registrationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, ratings, strengths, areasToImprove, coachNotes })
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: "0.75rem", background: "#17151e", border: "1px solid #251f30", borderRadius: "8px", padding: "0.75rem" }}>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
        <button onClick={() => switchPhase("initial")} className={phase === "initial" ? "admin-btn-primary" : "admin-btn-ghost"} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>Diagnostic initial</button>
        <button onClick={() => switchPhase("final")} className={phase === "final" ? "admin-btn-primary" : "admin-btn-ghost"} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>Diagnostic final</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))", gap: "0.4rem", marginBottom: "0.6rem" }}>
        {RATING_FIELDS.map((f) => (
          <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <span style={{ fontSize: "0.65rem", color: "#9d9da0" }}>{f.label}</span>
            <select
              className="admin-input"
              value={ratings[f.key] ?? ""}
              onChange={(e) => setRatings((prev) => ({ ...prev, [f.key]: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#9d9da0" }}>Points forts</span>
        <input className="admin-input" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#9d9da0" }}>Points à améliorer</span>
        <input className="admin-input" value={areasToImprove} onChange={(e) => setAreasToImprove(e.target.value)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.6rem" }}>
        <span style={{ fontSize: "0.65rem", color: "#9d9da0" }}>Notes de l&apos;entraîneur</span>
        <input className="admin-input" value={coachNotes} onChange={(e) => setCoachNotes(e.target.value)} />
      </label>
      <button onClick={save} disabled={saving} className="admin-btn-primary" style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>
        {saving ? "..." : "Enregistrer les notes"}
      </button>
    </div>
  );
}

const REGISTRATION_STATUSES: { value: RegistrationStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmée" },
  { value: "paid", label: "Payée" },
  { value: "cancelled", label: "Annulée" }
];

function FormField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: "0.35rem" }}>
      <span style={{ fontSize: "0.65rem", color: "#9d9da0" }}>{label} : </span>
      <span style={{ fontSize: "0.75rem", color: "#c3c2c8" }}>{value}</span>
    </div>
  );
}

function RegistrationRow({
  registration,
  onStatusChanged,
  onDeleted
}: {
  registration: RegistrationWithEnrollments;
  onStatusChanged: (status: RegistrationStatus) => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<TechnicalNotes[] | null>(null);
  const [attendance, setAttendanceLocal] = useState<Record<string, AttendanceStatus>>({});
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const next = !open;
    setOpen(next);
    if (!next || notes) return;
    const res = await fetch(`/api/admin/sport-etudes/technical-notes/${registration.id}`);
    const data = await res.json().catch(() => ({ notes: [] }));
    setNotes(data.notes ?? []);
  };

  const changeStatus = async (status: RegistrationStatus) => {
    setChangingStatus(true);
    try {
      await fetch(`/api/admin/sport-etudes/registrations/${registration.id}`, {
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
      await fetch(`/api/admin/sport-etudes/registrations/${registration.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const setAttendance = async (enrollmentId: string, status: AttendanceStatus) => {
    setAttendanceLocal((prev) => ({ ...prev, [enrollmentId]: status }));
    await fetch(`/api/admin/sport-etudes/attendance/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.7rem 0.9rem", marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: 0 }}>
            {registration.player_first_name} {registration.player_last_name}
            <span style={{ fontSize: "0.7rem", color: "#6d6b71", marginLeft: "0.5rem" }}>
              {registration.option_chosen === "full_program" ? "Programme complet" : "Diagnostic seulement"}
            </span>
          </p>
          <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.15rem 0 0" }}>
            {registration.parent_first_name} {registration.parent_last_name} · {registration.parent_email}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="admin-badge">{registration.status}</span>
          <button onClick={load} className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>{open ? "▾" : "▸"} Détails</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "0.6rem" }}>
          <div style={{ marginBottom: "0.6rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#9f85ba", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Changer le statut</p>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
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
          </div>

          <div style={{ marginBottom: "0.6rem", background: "#17151e", border: "1px solid #251f30", borderRadius: "8px", padding: "0.7rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#9f85ba", textTransform: "uppercase", margin: "0 0 0.5rem" }}>Formulaire</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))", gap: "0 1rem" }}>
              <FormField label="Date de naissance" value={registration.player_dob} />
              <FormField label="Niveau de jeu" value={registration.player_level} />
              <FormField label="Position principale" value={registration.primary_position} />
              <FormField label="Position secondaire" value={registration.secondary_position} />
              <FormField label="Équipe actuelle" value={registration.current_team} />
              <FormField label="Club actuel" value={registration.current_club} />
              <FormField label="Relation avec le joueur" value={registration.parent_relationship} />
              <FormField label="Téléphone parent" value={registration.parent_phone} />
              <FormField label="Prix" value={registration.price_cents != null ? `${(registration.price_cents / 100).toFixed(2)} $` : null} />
            </div>
            <FormField label="Expérience en soccer" value={registration.soccer_experience} />
            <FormField label="Objectifs du joueur" value={registration.player_goals} />
            <FormField label="Forces selon le parent" value={registration.parent_assessed_strengths} />
            <FormField label="Éléments à améliorer selon le parent" value={registration.parent_assessed_areas_to_improve} />
            <FormField label="Expérience en Sport-Études" value={registration.sport_etudes_experience} />
            <FormField label="Évaluations déjà effectuées" value={registration.prior_evaluations_done} />
            <FormField label="Programme Sport-Études visé" value={registration.target_sport_etudes_program} />
            <FormField label="Commentaires" value={registration.comments} />
            <FormField label="Informations importantes pour l'entraîneur" value={registration.important_coach_info} />
          </div>

          {registration.enrollments.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              <p style={{ fontSize: "0.68rem", color: "#9f85ba", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Présence</p>
              {registration.enrollments
                .sort((a, b) => a.session.display_order - b.session.display_order)
                .map((e) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#c3c2c8" }}>{e.session.label} — {e.session.session_date}</span>
                    <select
                      className="admin-input"
                      value={attendance[e.id] ?? "to_confirm"}
                      onChange={(ev) => setAttendance(e.id, ev.target.value as AttendanceStatus)}
                      style={{ width: "auto", fontSize: "0.72rem" }}
                    >
                      {(Object.entries(ATTENDANCE_LABELS) as [AttendanceStatus, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
            </div>
          )}
          {notes && <TechnicalNotesEditor registrationId={registration.id} existing={notes} />}

          <button
            onClick={remove}
            disabled={deleting}
            style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.35rem 0.7rem", cursor: "pointer" }}
          >
            {deleting ? "..." : "Supprimer définitivement"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminSportEtudes({
  initialSessions,
  initialSettings,
  initialRegistrations
}: {
  initialSessions: SportEtudesSession[];
  initialSettings: SportEtudesSettings;
  initialRegistrations: RegistrationWithEnrollments[];
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [maxCapacity, setMaxCapacity] = useState(initialSettings.max_capacity);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [registrations, setRegistrations] = useState(initialRegistrations);

  const refreshSessions = async () => {
    const res = await fetch("/api/admin/sport-etudes/sessions");
    const data = await res.json().catch(() => ({ sessions: [] }));
    setSessions(data.sessions ?? []);
  };

  const saveCapacity = async () => {
    setSavingCapacity(true);
    try {
      await fetch("/api/admin/sport-etudes/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxCapacity })
      });
    } finally {
      setSavingCapacity(false);
    }
  };

  const fullCount = registrations.filter((r) => r.option_chosen === "full_program" && (r.status === "confirmed" || r.status === "paid")).length;
  const activeRegistrations = registrations.filter((r) => r.status !== "cancelled");
  const diagnosticOnlyCount = activeRegistrations.filter((r) => r.option_chosen === "diagnostic_only").length;
  const fullProgramCount = activeRegistrations.filter((r) => r.option_chosen === "full_program").length;
  const paidCount = activeRegistrations.filter((r) => r.status === "paid").length;
  const pendingCount = activeRegistrations.filter((r) => r.status === "pending" || r.status === "confirmed").length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Programme Sport-Études</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Programme technique de préparation aux évaluations du Sport-Études — indépendant des programmes féminins réguliers.
          </p>

          <div className="admin-stats" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{activeRegistrations.length}</p>
              <p className="admin-stat-label">Total inscrits</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{diagnosticOnlyCount}</p>
              <p className="admin-stat-label">Diagnostic gratuit seulement</p>
            </div>
            <div className="admin-stat-card admin-stat-card-accent">
              <p className="admin-stat-value">{fullProgramCount}</p>
              <p className="admin-stat-label">Programme complet</p>
            </div>
            <div className="admin-stat-card admin-stat-card-accent">
              <p className="admin-stat-value">{paidCount}</p>
              <p className="admin-stat-label">Payées</p>
            </div>
            <div className="admin-stat-card admin-stat-card-warn">
              <p className="admin-stat-value">{pendingCount}</p>
              <p className="admin-stat-label">En attente</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-value">{Math.max(0, maxCapacity - fullCount)}</p>
              <p className="admin-stat-label">Places restantes</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "0.78rem", color: "#9d9da0" }}>Capacité maximale (programme complet) :</span>
            <input type="number" min={1} className="admin-input" value={maxCapacity} onChange={(e) => setMaxCapacity(Number(e.target.value))} style={{ width: "5rem" }} />
            <button onClick={saveCapacity} disabled={savingCapacity} className="admin-btn-primary" style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>
              {savingCapacity ? "..." : "Enregistrer"}
            </button>
            <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>{fullCount} / {maxCapacity} places prises</span>
          </div>

          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", marginBottom: "0.6rem" }}>Séances</p>
          {sessions.map((s) => <SessionRow key={s.id} session={s} onSaved={refreshSessions} />)}

          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", margin: "1.5rem 0 0.6rem" }}>Inscrits ({registrations.length})</p>
          {registrations.length === 0 && <p className="admin-empty-text">Aucune inscription pour l&apos;instant.</p>}
          {registrations.map((r) => (
            <RegistrationRow
              key={r.id}
              registration={r}
              onStatusChanged={(status) => setRegistrations((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))}
              onDeleted={() => setRegistrations((prev) => prev.filter((x) => x.id !== r.id))}
            />
          ))}
        </div>
      </div>
    </>
  );
}
