"use client";

import Link from "next/link";
import { useState } from "react";

import { EntityDocuments } from "@/components/admin-entity-documents";
import { CoachTopbar } from "@/components/coach-topbar";
import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { MatchPanel } from "@/components/match-panel";
import { computeHours, formatHoursMinutes } from "@/lib/coach-payroll";
import { EVALUATION_CRITERIA, type PlayerAttendance, type PlayerAttendanceStatus, type PlayerEvaluation, type RosterPlayer } from "@/lib/coach-portal-repo";
import type { CoachActivity } from "@/lib/coaches-repo";
import type { Exercise } from "@/lib/exercises-repo";
import { publicSans } from "@/lib/fonts";
import type { MatchConvocation, MatchDetails, MatchLineupSlot, MatchPlayerEvaluation, MatchRosterPlayer, PlaytimeSegment } from "@/lib/match-repo";
import { SESSION_BLOCK_TYPES, type SessionBlock } from "@/lib/session-plan-repo";

interface Props {
  coachName: string;
  coachId: string;
  activity: CoachActivity;
  otherCoaches: { id: string; first_name: string; last_name: string }[];
  roster: RosterPlayer[];
  initialAttendance: PlayerAttendance[];
  initialEvaluations: PlayerEvaluation[];
  sessionBlocks: SessionBlock[];
  initialExercises: Exercise[];
  matchRoster: MatchRosterPlayer[];
  initialMatchDetails: MatchDetails | null;
  initialMatchConvocations: MatchConvocation[];
  initialMatchLineup: MatchLineupSlot[];
  initialMatchPlaytime: PlaytimeSegment[];
  initialMatchEvaluations: MatchPlayerEvaluation[];
}

function NewExerciseForm({ onCreated, onCancel }: { onCreated: (exercise: Exercise) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), objective: objective.trim() || null, instructions: instructions.trim() || null })
      });
      if (!res.ok) return;
      const data = await res.json();
      onCreated({
        id: data.id, title: title.trim(), objective: objective.trim() || null, category: null, level: null, duration_minutes: null,
        material: null, min_players: null, max_players: null, dimensions: null, instructions: instructions.trim() || null,
        variants: null, coaching_points: null, common_mistakes: null, image_url: null, video_url: null, diagram_data: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`exercise-create-panel ${publicSans.className}`} style={{ marginBottom: "0.6rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <p className="exercise-create-panel__title">Créer un exercice</p>
      <input className="admin-input" placeholder="Titre de l'exercice *" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="admin-input" placeholder="Objectif (optionnel)" value={objective} onChange={(e) => setObjective(e.target.value)} />
      <textarea className="admin-input" placeholder="Consignes (optionnel)" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="admin-btn-primary" onClick={create} disabled={saving || !title.trim()} style={{ fontSize: "0.75rem" }}>
          {saving ? "..." : "Ajouter à la bibliothèque"}
        </button>
        <button className="admin-btn-ghost" onClick={onCancel} style={{ fontSize: "0.75rem" }}>Annuler</button>
      </div>
    </div>
  );
}

function SessionPlanEditor({ activityId, initialBlocks, initialExercises }: { activityId: string; initialBlocks: SessionBlock[]; initialExercises: Exercise[] }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [exercises, setExercises] = useState(initialExercises);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [blockType, setBlockType] = useState<string>(SESSION_BLOCK_TYPES[0]);
  const [exerciseId, setExerciseId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [duration, setDuration] = useState("10");
  const [saving, setSaving] = useState(false);

  const totalMinutes = blocks.reduce((sum, b) => sum + b.duration_minutes, 0);

  const addBlock = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/coach/activities/${activityId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockType,
          exerciseId: exerciseId || null,
          customTitle: customTitle.trim() || null,
          durationMinutes: parseInt(duration, 10) || 10
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      setBlocks((prev) => [
        ...prev,
        { id: data.id, activity_id: activityId, block_order: prev.length, block_type: blockType, exercise_id: exerciseId || null, custom_title: customTitle.trim() || null, duration_minutes: parseInt(duration, 10) || 10, notes: null }
      ]);
      setCustomTitle("");
      setDuration("10");
      setExerciseId("");
    } finally {
      setSaving(false);
    }
  };

  const move = async (id: string, direction: "up" | "down") => {
    const index = blocks.findIndex((b) => b.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setBlocks(next);
    await fetch(`/api/coach/activities/${activityId}/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: direction })
    });
  };

  const remove = async (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/coach/activities/${activityId}/blocks/${id}`, { method: "DELETE" });
  };

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        Plan de séance {blocks.length > 0 && <span style={{ color: "#6d6b71", fontWeight: 400 }}>· {totalMinutes} min au total</span>}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {blocks.length === 0 && <p className="admin-empty-text">Aucun bloc de séance planifié.</p>}
        {blocks.map((b, i) => {
          const expanded = expandedId === b.id;
          const exercise = exercises.find((e) => e.id === b.exercise_id) ?? null;
          const title = b.custom_title || exercise?.title || b.block_type;
          return (
            <div key={b.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.5rem 0.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => setExpandedId(expanded ? null : b.id)}
                  style={{ background: "none", border: "none", color: "#c3c2c8", cursor: exercise ? "pointer" : "default", padding: 0, flex: 1, textAlign: "left", fontSize: "0.78rem" }}
                >
                  {i + 1}. <span style={{ color: "#9f85ba" }}>{b.block_type}</span> — {title} <span style={{ color: "#6d6b71" }}>({b.duration_minutes} min)</span>
                </button>
                <button onClick={() => move(b.id, "up")} disabled={i === 0} className="admin-btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>↑</button>
                <button onClick={() => move(b.id, "down")} disabled={i === blocks.length - 1} className="admin-btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>↓</button>
                <button onClick={() => remove(b.id)} style={{ fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.2rem 0.5rem", cursor: "pointer" }}>×</button>
              </div>
              {expanded && exercise && (
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #1a1820", fontSize: "0.75rem", color: "#9d9da0", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {exercise.objective && <span><strong style={{ color: "#c3c2c8" }}>Objectif :</strong> {exercise.objective}</span>}
                  {exercise.material && <span><strong style={{ color: "#c3c2c8" }}>Matériel :</strong> {exercise.material}</span>}
                  {exercise.instructions && <span><strong style={{ color: "#c3c2c8" }}>Consignes :</strong> {exercise.instructions}</span>}
                  {exercise.coaching_points && <span><strong style={{ color: "#c3c2c8" }}>Points de coaching :</strong> {exercise.coaching_points}</span>}
                  {exercise.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={exercise.image_url} alt={exercise.title} style={{ maxWidth: "100%", borderRadius: "6px", marginTop: "0.3rem" }} />
                  )}
                  {exercise.diagram_data && <ExerciseDiagramView diagram={exercise.diagram_data} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNewExercise && (
        <NewExerciseForm
          onCreated={(ex) => { setExercises((prev) => [...prev, ex]); setExerciseId(ex.id); setShowNewExercise(false); }}
          onCancel={() => setShowNewExercise(false)}
        />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <select className="admin-input" value={blockType} onChange={(e) => setBlockType(e.target.value)} style={{ width: "auto" }}>
          {SESSION_BLOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="admin-input" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} style={{ flex: "1 1 160px" }}>
          <option value="">Exercice de la bibliothèque (optionnel)</option>
          {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
        </select>
        <input className="admin-input" placeholder="Titre libre (si pas d'exercice)" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} style={{ flex: "1 1 160px" }} />
        <input className="admin-input" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} style={{ width: "5rem" }} />
        <button onClick={addBlock} disabled={saving} className="admin-btn-primary" style={{ fontSize: "0.78rem" }}>+ Ajouter</button>
        <button onClick={() => setShowNewExercise(true)} className="admin-btn-ghost" style={{ fontSize: "0.78rem" }}>+ Nouvel exercice</button>
      </div>
    </div>
  );
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

export function CoachActiviteDetail({ coachName, coachId, activity, otherCoaches, roster, initialAttendance, initialEvaluations, sessionBlocks, initialExercises, matchRoster, initialMatchDetails, initialMatchConvocations, initialMatchLineup, initialMatchPlaytime, initialMatchEvaluations }: Props) {
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

          <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1rem", marginBottom: "1.5rem" }}>
            <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>Ressources</p>
            {activity.notes && (
              <a href={activity.notes} target="_blank" rel="noreferrer" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "0.8rem" }}>
                📎 Ouvrir le lien Google Sheet / Drive ↗
              </a>
            )}
            <EntityDocuments entityType="coach_activity" entityId={activity.id} apiBase="/api/coach/documents" readOnly />
          </div>

          {activity.activity_type === "Match" && (
            <MatchPanel
              activityId={activity.id}
              roster={matchRoster}
              initialDetails={initialMatchDetails}
              initialConvocations={initialMatchConvocations}
              initialLineup={initialMatchLineup}
              initialPlaytime={initialMatchPlaytime}
              initialEvaluations={initialMatchEvaluations}
              role="coach"
              coachId={coachId}
            />
          )}

          <SessionPlanEditor activityId={activity.id} initialBlocks={sessionBlocks} initialExercises={initialExercises} />

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
