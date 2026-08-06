"use client";

import { useState } from "react";

import { CoachTopbar } from "@/components/coach-topbar";
import type { CoachActivity } from "@/lib/coaches-repo";
import type { PlayerAttendance, PlayerEvaluation, PlayerObjective, PlayerProfile } from "@/lib/coach-portal-repo";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Présente",
  absent: "Absente",
  injured: "Blessée",
  late: "En retard",
  left_early: "Partie plus tôt"
};

interface Props {
  coachName: string;
  player: PlayerProfile;
  evaluations: (PlayerEvaluation & { activity: CoachActivity; coach: { first_name: string; last_name: string } })[];
  objectives: PlayerObjective[];
  attendanceHistory: (PlayerAttendance & { activity: CoachActivity })[];
}

function ObjectivesPanel({ registrationId, objectives: initial }: { registrationId: string; objectives: PlayerObjective[] }) {
  const [objectives, setObjectives] = useState(initial);
  const [newObjective, setNewObjective] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!newObjective.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, objective: newObjective.trim() })
      });
      if (res.ok) {
        setObjectives((prev) => [{ id: crypto.randomUUID(), registration_id: registrationId, objective: newObjective.trim(), active: true, created_at: new Date().toISOString() }, ...prev]);
        setNewObjective("");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/coach/objectives/${id}`, { method: "DELETE" });
    if (res.ok) setObjectives((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
      <p className="admin-drawer-section-title">Objectifs individuels</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.6rem" }}>
        {objectives.map((o) => (
          <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "#c3c2c8" }}>
            <span>• {o.objective}</span>
            <button onClick={() => remove(o.id)} style={{ background: "none", border: "none", color: "#6d6b71", cursor: "pointer" }}>×</button>
          </div>
        ))}
        {objectives.length === 0 && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Aucun objectif fixé.</p>}
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input className="admin-input" placeholder="Nouvel objectif..." value={newObjective} onChange={(e) => setNewObjective(e.target.value)} style={{ flex: 1, fontSize: "0.75rem" }} />
        <button className="admin-btn-ghost" onClick={add} disabled={saving} style={{ fontSize: "0.7rem" }}>Ajouter</button>
      </div>
    </div>
  );
}

export function CoachJoueurDetail({ coachName, player, evaluations, objectives, attendanceHistory }: Props) {
  const presentCount = attendanceHistory.filter((a) => a.status === "present").length;

  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ margin: "0 0 0.3rem", fontSize: "1.1rem", textTransform: "none", letterSpacing: 0, color: "#fff" }}>
            {player.firstName} {player.lastName}
          </p>
          <p style={{ fontSize: "0.8rem", color: "#9d9da0", marginBottom: "1.5rem" }}>
            Née {player.birthYear ?? "—"}{player.advancedGroup ? " · Groupe avancé" : ""} · {presentCount}/{attendanceHistory.length} présence(s)
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <ObjectivesPanel registrationId={player.registrationId} objectives={objectives} />
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Historique de présence ({attendanceHistory.length})</p>
          <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Activité</th><th>Présence</th></tr></thead>
              <tbody>
                {attendanceHistory.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.activity.activity_date + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}</td>
                    <td>{a.activity.activity_type}</td>
                    <td>{ATTENDANCE_LABELS[a.status] ?? a.status}</td>
                  </tr>
                ))}
                {attendanceHistory.length === 0 && <tr><td colSpan={3} className="admin-empty-text">Aucune présence enregistrée.</td></tr>}
              </tbody>
            </table>
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Évaluations ({evaluations.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {evaluations.length === 0 && <p className="admin-empty-text">Aucune évaluation enregistrée.</p>}
            {evaluations.map((ev) => (
              <div key={ev.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
                <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.4rem" }}>
                  {new Date(ev.activity.activity_date + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                  {" · "}{ev.activity.activity_type} · {ev.coach.first_name} {ev.coach.last_name}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  {Object.entries(ev.ratings).map(([crit, val]) => (
                    <span key={crit} style={{ fontSize: "0.65rem", color: "#c3a6ff", background: "rgba(150,100,255,0.1)", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                      {crit}: {val}/5
                    </span>
                  ))}
                </div>
                {ev.comment && <p style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: 0, fontStyle: "italic" }}>&quot;{ev.comment}&quot;</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
