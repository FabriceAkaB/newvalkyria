"use client";

import Link from "next/link";
import { useState } from "react";

import { CoachTopbar } from "@/components/coach-topbar";
import { computeHours, formatHoursMinutes } from "@/lib/coach-payroll";
import { EVALUATION_CRITERIA, type PlayerAttendance, type PlayerAttendanceStatus, type PlayerEvaluation, type RosterPlayer } from "@/lib/coach-portal-repo";
import type { CoachActivity } from "@/lib/coaches-repo";

interface Props {
  coachName: string;
  activity: CoachActivity;
  otherCoaches: { id: string; first_name: string; last_name: string }[];
  roster: RosterPlayer[];
  initialAttendance: PlayerAttendance[];
  initialEvaluations: PlayerEvaluation[];
}

const ATTENDANCE_LABELS: Record<PlayerAttendanceStatus, string> = {
  present: "Présente",
  absent: "Absente",
  injured: "Blessée",
  late: "En retard",
  left_early: "Partie plus tôt"
};

function EvaluationForm({
  registrationId,
  activityId,
  existing,
  onSaved
}: {
  registrationId: string;
  activityId: string;
  existing: PlayerEvaluation | undefined;
  onSaved: (evaluation: PlayerEvaluation) => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(existing?.ratings ?? {});
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/coach/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, registrationId, ratings, comment: comment || null })
      });
      if (res.ok) {
        onSaved({ id: existing?.id ?? "", activity_id: activityId, registration_id: registrationId, coach_id: "", ratings, comment: comment || null, created_at: new Date().toISOString() });
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: "0.75rem", padding: "0.9rem", background: "#0d0b13", borderRadius: "8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {EVALUATION_CRITERIA.map((crit) => (
          <div key={crit}>
            <p style={{ fontSize: "0.68rem", color: "#9d9da0", margin: "0 0 0.25rem" }}>{crit}</p>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRatings((prev) => ({ ...prev, [crit]: n }))}
                  style={{
                    width: "26px", height: "26px", borderRadius: "5px", fontSize: "0.7rem", cursor: "pointer",
                    border: ratings[crit] === n ? "1px solid #8d76a5" : "1px solid #302e36",
                    background: ratings[crit] === n ? "#30283c" : "transparent",
                    color: ratings[crit] === n ? "#fff" : "#6d6b71"
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <textarea
        className="admin-input"
        rows={3}
        placeholder="Commentaire personnalisé..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ width: "100%", marginBottom: "0.6rem" }}
      />
      <button className="admin-btn-primary" onClick={save} disabled={saving} style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
        {saving ? "Enregistrement..." : saved ? "✓ Enregistré" : "Enregistrer l'évaluation"}
      </button>
    </div>
  );
}

function PlayerRow({
  player,
  activityId,
  attendance,
  evaluation,
  onAttendanceChange,
  onEvaluationSaved
}: {
  player: RosterPlayer;
  activityId: string;
  attendance: PlayerAttendanceStatus;
  evaluation: PlayerEvaluation | undefined;
  onAttendanceChange: (registrationId: string, status: PlayerAttendanceStatus) => void;
  onEvaluationSaved: (registrationId: string, evaluation: PlayerEvaluation) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const setAttendance = async (status: PlayerAttendanceStatus) => {
    setSaving(true);
    try {
      const res = await fetch("/api/coach/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, registrationId: player.registrationId, status })
      });
      if (res.ok) onAttendanceChange(player.registrationId, status);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            {player.firstName} {player.lastName}
            {player.isTrial && <span style={{ fontSize: "0.6rem", color: "#c3a6ff", marginLeft: "0.5rem" }}>ESSAI</span>}
          </p>
          <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0.1rem 0 0" }}>
            Née {player.birthYear ?? "—"}{player.advancedGroup ? " · Avancé" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            className="admin-input"
            value={attendance}
            disabled={saving}
            onChange={(e) => setAttendance(e.target.value as PlayerAttendanceStatus)}
            style={{ fontSize: "0.75rem" }}
          >
            {(Object.keys(ATTENDANCE_LABELS) as PlayerAttendanceStatus[]).map((s) => <option key={s} value={s}>{ATTENDANCE_LABELS[s]}</option>)}
          </select>
          <button className="admin-btn-ghost" onClick={() => setExpanded((e) => !e)} style={{ padding: "0.35rem 0.7rem", fontSize: "0.72rem" }}>
            {evaluation ? "✓ Évaluation" : "Évaluer"}
          </button>
        </div>
      </div>

      {expanded && (
        <EvaluationForm
          registrationId={player.registrationId}
          activityId={activityId}
          existing={evaluation}
          onSaved={(ev) => onEvaluationSaved(player.registrationId, ev)}
        />
      )}
    </div>
  );
}

export function CoachActiviteDetail({ coachName, activity, otherCoaches, roster, initialAttendance, initialEvaluations }: Props) {
  const [attendanceMap, setAttendanceMap] = useState<Record<string, PlayerAttendanceStatus>>(
    Object.fromEntries(initialAttendance.map((a) => [a.registration_id, a.status]))
  );
  const [evaluationMap, setEvaluationMap] = useState<Record<string, PlayerEvaluation>>(
    Object.fromEntries(initialEvaluations.map((e) => [e.registration_id, e]))
  );

  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="admin-section">
          <Link href="/entraineur/dashboard" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Tableau de bord
          </Link>

          <p className="admin-section-title" style={{ margin: "0 0 0.3rem" }}>
            {activity.title ? `${activity.activity_type} — ${activity.title}` : activity.activity_type}
          </p>
          <p style={{ fontSize: "0.85rem", color: "#c3c2c8", margin: "0 0 1.5rem" }}>
            {new Date(activity.activity_date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}{activity.start_time.slice(0, 5)}–{activity.end_time.slice(0, 5)}
            {" · "}{formatHoursMinutes(computeHours(activity.start_time, activity.end_time))}
            {activity.location && ` · ${activity.location}`}
            {otherCoaches.length > 0 && ` · avec ${otherCoaches.map((c) => `${c.first_name} ${c.last_name}`).join(", ")}`}
          </p>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Joueuses attendues ({roster.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {roster.length === 0 && <p className="admin-empty-text">Aucune joueuse trouvée pour cette catégorie.</p>}
            {roster.map((p) => (
              <PlayerRow
                key={p.registrationId}
                player={p}
                activityId={activity.id}
                attendance={attendanceMap[p.registrationId] ?? "present"}
                evaluation={evaluationMap[p.registrationId]}
                onAttendanceChange={(id, status) => setAttendanceMap((prev) => ({ ...prev, [id]: status }))}
                onEvaluationSaved={(id, ev) => setEvaluationMap((prev) => ({ ...prev, [id]: ev }))}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
