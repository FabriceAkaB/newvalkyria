"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type {
  AttendanceStatus,
  EnrollmentWithSession,
  NotePhase,
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

function RegistrationRow({ registration }: { registration: RegistrationWithEnrollments }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<TechnicalNotes[] | null>(null);
  const [attendance, setAttendanceLocal] = useState<Record<string, AttendanceStatus>>({});

  const load = async () => {
    const next = !open;
    setOpen(next);
    if (!next || notes) return;
    const res = await fetch(`/api/admin/sport-etudes/technical-notes/${registration.id}`);
    const data = await res.json().catch(() => ({ notes: [] }));
    setNotes(data.notes ?? []);
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
  const [registrations] = useState(initialRegistrations);

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

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Programme Sport-Études</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Programme technique de préparation aux évaluations du Sport-Études — indépendant des programmes féminins réguliers.
          </p>

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
          {registrations.map((r) => <RegistrationRow key={r.id} registration={r} />)}
        </div>
      </div>
    </>
  );
}
