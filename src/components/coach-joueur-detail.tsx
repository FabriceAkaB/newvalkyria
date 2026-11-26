"use client";

import { X } from "lucide-react";
import { useState } from "react";

import type { PlayerObjective, PlayerRoutine } from "@/lib/coach-portal-repo";
import type { Exercise } from "@/lib/exercises-repo";

/** Objectifs individuels et routines maison d'une joueuse, dans son dossier (Espace Technique). `readOnly` : les
 *  assistants lisent seulement (rien à remplir). */

export function ObjectivesPanel({ registrationId, objectives: initial, readOnly = false }: { registrationId: string; objectives: PlayerObjective[]; readOnly?: boolean }) {
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
    <div className="pd-card">
      <p className="pd-card__label">Objectifs individuels</p>
      <ul className="pd-alerts" style={{ marginBottom: readOnly ? 0 : 12 }}>
        {objectives.map((o) => (
          <li key={o.id} data-tone="info" style={{ justifyContent: "space-between" }}>
            <span style={{ flex: 1 }}>{o.objective}</span>
            {!readOnly ? (
              <button onClick={() => remove(o.id)} aria-label="Retirer l'objectif" style={{ background: "none", border: "none", color: "var(--adm-text-3)", cursor: "pointer", minWidth: 32, minHeight: 32 }}>
                <X size={14} aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
        {objectives.length === 0 && <p className="pd-empty">Aucun objectif fixé.</p>}
      </ul>
      {!readOnly ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input className="pd-search" placeholder="Nouvel objectif…" value={newObjective} onChange={(e) => setNewObjective(e.target.value)} style={{ flex: 1, minHeight: 40, fontSize: "0.88rem" }} />
          <button className="pd-btn" onClick={add} disabled={saving || !newObjective.trim()}>Ajouter</button>
        </div>
      ) : null}
    </div>
  );
}

export function RoutinesPanel({ registrationId, routines: initial, exercises, readOnly = false }: { registrationId: string; routines: PlayerRoutine[]; exercises: Pick<Exercise, "id" | "title">[]; readOnly?: boolean }) {
  const [routines, setRoutines] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [exerciseIds, setExerciseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleExercise = (id: string) => setExerciseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, title: title.trim(), notes: notes.trim() || null, exerciseIds })
      });
      if (res.ok) {
        setRoutines((prev) => [{ id: crypto.randomUUID(), registration_id: registrationId, title: title.trim(), notes: notes.trim() || null, exercise_ids: exerciseIds, active: true, created_at: new Date().toISOString() }, ...prev]);
        setTitle("");
        setNotes("");
        setExerciseIds([]);
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/coach/routines/${id}`, { method: "DELETE" });
    if (res.ok) setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="pd-card">
      <p className="pd-card__label">Routine maison</p>
      <div style={{ display: "grid", gap: 8, marginBottom: readOnly ? 0 : 12 }}>
        {routines.map((r) => (
          <div key={r.id} style={{ background: "var(--adm-bg)", borderRadius: "var(--adm-radius-sm)", padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: "0.88rem", color: "var(--adm-text)" }}>{r.title}</strong>
              {!readOnly ? (
                <button onClick={() => remove(r.id)} aria-label="Retirer la routine" style={{ background: "none", border: "none", color: "var(--adm-text-3)", cursor: "pointer", minWidth: 32, minHeight: 32 }}>
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </div>
            {r.exercise_ids.length > 0 && <p className="pd-coach__small" style={{ marginTop: 4 }}>{r.exercise_ids.map((id) => exercises.find((e) => e.id === id)?.title ?? "Exercice").join(" · ")}</p>}
            {r.notes && <p className="pd-note" style={{ marginTop: 4 }}>{r.notes}</p>}
          </div>
        ))}
        {routines.length === 0 && <p className="pd-empty">Aucune routine assignée.</p>}
      </div>

      {readOnly ? null : showForm ? (
        <div style={{ display: "grid", gap: 8 }}>
          <input className="pd-search" placeholder="Titre (ex. Semaine du 6 octobre)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ minHeight: 40, fontSize: "0.88rem" }} />
          <div className="pd-chips" style={{ maxHeight: 220, overflowY: "auto" }}>
            {exercises.map((ex) => (
              <button key={ex.id} type="button" onClick={() => toggleExercise(ex.id)} data-on={exerciseIds.includes(ex.id) || undefined}>
                {ex.title}
              </button>
            ))}
            {exercises.length === 0 && <p className="pd-empty">Aucun exercice dans la bibliothèque pour l&apos;instant.</p>}
          </div>
          <textarea className="pd-search" placeholder="Notes (facultatif)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ padding: "10px 14px", fontSize: "0.88rem" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pd-btn pd-btn--primary" onClick={add} disabled={saving || !title.trim()}>Assigner</button>
            <button className="pd-btn" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      ) : (
        <button className="pd-btn" onClick={() => setShowForm(true)}>Nouvelle routine</button>
      )}
    </div>
  );
}
