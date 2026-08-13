"use client";

import { useRef, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { EXERCISE_CATEGORIES, EXERCISE_LEVELS, type Exercise } from "@/lib/exercises-repo";

interface ExerciseFormState {
  title: string;
  objective: string;
  category: string;
  level: string;
  durationMinutes: string;
  material: string;
  minPlayers: string;
  maxPlayers: string;
  dimensions: string;
  instructions: string;
  variants: string;
  coachingPoints: string;
  commonMistakes: string;
  videoUrl: string;
}

const EMPTY_FORM: ExerciseFormState = {
  title: "", objective: "", category: "", level: "", durationMinutes: "", material: "",
  minPlayers: "", maxPlayers: "", dimensions: "", instructions: "", variants: "", coachingPoints: "", commonMistakes: "", videoUrl: ""
};

function toBody(f: ExerciseFormState) {
  return {
    title: f.title.trim(),
    objective: f.objective.trim() || null,
    category: f.category || null,
    level: f.level || null,
    durationMinutes: f.durationMinutes ? parseInt(f.durationMinutes, 10) : null,
    material: f.material.trim() || null,
    minPlayers: f.minPlayers ? parseInt(f.minPlayers, 10) : null,
    maxPlayers: f.maxPlayers ? parseInt(f.maxPlayers, 10) : null,
    dimensions: f.dimensions.trim() || null,
    instructions: f.instructions.trim() || null,
    variants: f.variants.trim() || null,
    coachingPoints: f.coachingPoints.trim() || null,
    commonMistakes: f.commonMistakes.trim() || null,
    videoUrl: f.videoUrl.trim() || null
  };
}

function toExercisePatch(f: ExerciseFormState): Omit<Exercise, "id" | "image_url" | "created_at" | "updated_at"> {
  const body = toBody(f);
  return {
    title: body.title,
    objective: body.objective,
    category: body.category,
    level: body.level,
    duration_minutes: body.durationMinutes,
    material: body.material,
    min_players: body.minPlayers,
    max_players: body.maxPlayers,
    dimensions: body.dimensions,
    instructions: body.instructions,
    variants: body.variants,
    coaching_points: body.coachingPoints,
    common_mistakes: body.commonMistakes,
    video_url: body.videoUrl
  };
}

function ExerciseForm({ initial, onSubmit, onCancel, saving }: { initial: ExerciseFormState; onSubmit: (f: ExerciseFormState) => void; onCancel: () => void; saving: boolean }) {
  const [f, setF] = useState(initial);
  const set = (k: keyof ExerciseFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <input className="admin-input" placeholder="Titre *" value={f.title} onChange={set("title")} style={{ flex: "1 1 200px" }} />
        <select className="admin-input" value={f.category} onChange={set("category")} style={{ width: "auto" }}>
          <option value="">Catégorie</option>
          {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="admin-input" value={f.level} onChange={set("level")} style={{ width: "auto" }}>
          <option value="">Niveau</option>
          {EXERCISE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <input className="admin-input" type="number" placeholder="Durée (min)" value={f.durationMinutes} onChange={set("durationMinutes")} style={{ width: "8rem" }} />
      </div>
      <input className="admin-input" placeholder="Objectif" value={f.objective} onChange={set("objective")} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <input className="admin-input" placeholder="Matériel" value={f.material} onChange={set("material")} style={{ flex: "1 1 160px" }} />
        <input className="admin-input" placeholder="Dimensions du terrain" value={f.dimensions} onChange={set("dimensions")} style={{ flex: "1 1 160px" }} />
        <input className="admin-input" type="number" placeholder="Min joueuses" value={f.minPlayers} onChange={set("minPlayers")} style={{ width: "8rem" }} />
        <input className="admin-input" type="number" placeholder="Max joueuses" value={f.maxPlayers} onChange={set("maxPlayers")} style={{ width: "8rem" }} />
      </div>
      <textarea className="admin-input" placeholder="Consignes" value={f.instructions} onChange={set("instructions")} rows={2} />
      <textarea className="admin-input" placeholder="Variantes" value={f.variants} onChange={set("variants")} rows={2} />
      <textarea className="admin-input" placeholder="Points de coaching" value={f.coachingPoints} onChange={set("coachingPoints")} rows={2} />
      <textarea className="admin-input" placeholder="Erreurs fréquentes" value={f.commonMistakes} onChange={set("commonMistakes")} rows={2} />
      <input className="admin-input" placeholder="Lien vidéo (YouTube, etc.)" value={f.videoUrl} onChange={set("videoUrl")} />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="admin-btn-primary" onClick={() => onSubmit(f)} disabled={saving || !f.title.trim()}>{saving ? "..." : "Enregistrer"}</button>
        <button className="admin-btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, canEdit, onUpdated, onDeleted }: { exercise: Exercise; canEdit: boolean; onUpdated: (e: Exercise) => void; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const save = async (f: ExerciseFormState) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/exercises/${exercise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(f))
      });
      if (!res.ok) return;
      onUpdated({ ...exercise, ...toExercisePatch(f) });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer "${exercise.title}" ?`)) return;
    const res = await fetch(`/api/admin/exercises/${exercise.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/admin/exercises/${exercise.id}/image`, { method: "POST", body: formData });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.imageUrl) onUpdated({ ...exercise, image_url: data.imageUrl });
  };

  if (editing) {
    return (
      <ExerciseForm
        initial={{
          title: exercise.title, objective: exercise.objective ?? "", category: exercise.category ?? "", level: exercise.level ?? "",
          durationMinutes: exercise.duration_minutes?.toString() ?? "", material: exercise.material ?? "",
          minPlayers: exercise.min_players?.toString() ?? "", maxPlayers: exercise.max_players?.toString() ?? "",
          dimensions: exercise.dimensions ?? "", instructions: exercise.instructions ?? "", variants: exercise.variants ?? "",
          coachingPoints: exercise.coaching_points ?? "", commonMistakes: exercise.common_mistakes ?? "", videoUrl: exercise.video_url ?? ""
        }}
        onSubmit={save}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    );
  }

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
      <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>
          {expanded ? "▾" : "▸"} {exercise.title}
          {exercise.category && <span style={{ color: "#9f85ba", fontWeight: 400 }}> · {exercise.category}</span>}
          {exercise.level && <span style={{ color: "#6d6b71", fontWeight: 400 }}> · {exercise.level}</span>}
        </span>
        {exercise.duration_minutes && <span style={{ fontSize: "0.75rem", color: "#6d6b71" }}>{exercise.duration_minutes} min</span>}
      </button>
      {expanded && (
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #1a1820", display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.78rem", color: "#c3c2c8" }}>
          {exercise.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={exercise.image_url} alt={exercise.title} style={{ maxWidth: "280px", borderRadius: "8px" }} />
          )}
          {exercise.objective && <p style={{ margin: 0 }}><strong>Objectif :</strong> {exercise.objective}</p>}
          {exercise.material && <p style={{ margin: 0 }}><strong>Matériel :</strong> {exercise.material}</p>}
          {exercise.dimensions && <p style={{ margin: 0 }}><strong>Dimensions :</strong> {exercise.dimensions}</p>}
          {(exercise.min_players || exercise.max_players) && <p style={{ margin: 0 }}><strong>Joueuses :</strong> {exercise.min_players ?? "?"}–{exercise.max_players ?? "?"}</p>}
          {exercise.instructions && <p style={{ margin: 0 }}><strong>Consignes :</strong> {exercise.instructions}</p>}
          {exercise.variants && <p style={{ margin: 0 }}><strong>Variantes :</strong> {exercise.variants}</p>}
          {exercise.coaching_points && <p style={{ margin: 0 }}><strong>Points de coaching :</strong> {exercise.coaching_points}</p>}
          {exercise.common_mistakes && <p style={{ margin: 0 }}><strong>Erreurs fréquentes :</strong> {exercise.common_mistakes}</p>}
          {exercise.video_url && <p style={{ margin: 0 }}><a href={exercise.video_url} target="_blank" rel="noreferrer" style={{ color: "#88c0d0" }}>Voir la vidéo →</a></p>}

          {canEdit && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
              <button className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }} onClick={() => setEditing(true)}>Modifier</button>
              <button className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }} onClick={() => fileInput.current?.click()}>Photo/schéma</button>
              <button onClick={remove} style={{ fontSize: "0.72rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer" }}>Supprimer</button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => uploadImage(e.target.files?.[0])} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminExercices({ initialExercises, canEdit }: { initialExercises: Exercise[]; canEdit: boolean }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = categoryFilter ? exercises.filter((e) => e.category === categoryFilter) : exercises;

  const create = async (f: ExerciseFormState) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(f))
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return;
      const newExercise: Exercise = { id: data.id, ...toExercisePatch(f), image_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setExercises((prev) => [...prev, newExercise].sort((a, b) => a.title.localeCompare(b.title)));
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Bibliothèque d&apos;exercices</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Cataloguez vos exercices pour les réutiliser directement dans la planification de séance de chaque activité.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "center" }}>
            <select className="admin-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: "auto" }}>
              <option value="">Toutes les catégories</option>
              {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {canEdit && !showAdd && (
              <button className="admin-btn-primary" onClick={() => setShowAdd(true)} style={{ marginLeft: "auto" }}>+ Nouvel exercice</button>
            )}
          </div>

          {showAdd && <ExerciseForm initial={EMPTY_FORM} onSubmit={create} onCancel={() => setShowAdd(false)} saving={saving} />}

          {filtered.length === 0 && <p className="admin-empty-text">Aucun exercice dans cette sélection.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filtered.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                canEdit={canEdit}
                onUpdated={(updated) => setExercises((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))}
                onDeleted={() => setExercises((prev) => prev.filter((e) => e.id !== ex.id))}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
