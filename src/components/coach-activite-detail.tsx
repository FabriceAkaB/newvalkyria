"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { EntityDocuments } from "@/components/admin-entity-documents";
import { exerciseGuideFallback } from "@/components/admin-block-guide";
import { CoachExerciseRatings } from "@/components/coach-exercise-ratings";
import { CoachTopbar } from "@/components/coach-topbar";
import { SurpriseMomentEditor } from "@/components/surprise-moment";
import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { MatchPanel } from "@/components/match-panel";
import { computeHours, formatHoursMinutes, timeToMinutes } from "@/lib/coach-payroll";
import { planningLabel } from "@/lib/exercise-bank";
import type { BriefingPlayer, PlayerAttendance, PlayerAttendanceStatus, PlayerEvaluation, RosterPlayer } from "@/lib/coach-portal-repo";
import { MAX_WINNERS, POINTS, WIN_LABEL, type WinKind } from "@/lib/player-points";
import { cleanNote, isQuickEvaluationComplete, NOTE_MIN_CHARS, PARTICIPATED, QUICK_CRITERIA, QUICK_SCALE, REPORT_REQUIRED_TYPES, REPORT_RULE_START } from "@/lib/coach-report";
import type { AssignmentStatus, CoachActivity } from "@/lib/coaches-repo";
import type { Exercise } from "@/lib/exercises-repo";
import type { MatchConvocation, MatchDetails, MatchLineupSlot, MatchPlayerEvaluation, MatchRosterPlayer, PlaytimeSegment } from "@/lib/match-repo";
import { BLOCK_GUIDE_FIELDS, SESSION_BLOCK_TYPES, type SessionBlock } from "@/lib/session-plan-repo";

interface MyPresence {
  status: AssignmentStatus;
  confirmed: boolean;
  arrivalTime: string | null;
  departureTime: string | null;
  locked: boolean;
}

interface Props {
  coachName: string;
  coachId: string;
  activity: CoachActivity;
  otherCoaches: { id: string; first_name: string; last_name: string }[];
  roster: RosterPlayer[];
  initialAttendance: PlayerAttendance[];
  initialEvaluations: PlayerEvaluation[];
  coachNames: Record<string, string>;
  myPresence: MyPresence;
  theme: { theme: string; notes: string | null } | null;
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
    <div className="exercise-create-panel" style={{ marginBottom: "0.6rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
          {exercises.map((ex) => <option key={ex.id} value={ex.id}>{planningLabel(ex)}</option>)}
        </select>
        <input className="admin-input" placeholder="Titre libre (si pas d'exercice)" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} style={{ flex: "1 1 160px" }} />
        <input className="admin-input" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} style={{ width: "5rem" }} />
        <button onClick={addBlock} disabled={saving} className="admin-btn-primary" style={{ fontSize: "0.78rem" }}>+ Ajouter</button>
        <button onClick={() => setShowNewExercise(true)} className="admin-btn-ghost" style={{ fontSize: "0.78rem" }}>+ Nouvel exercice</button>
      </div>
    </div>
  );
}


/* ══ Portail de l'éducateur : Avant (pratique du jour) · Pendant (présences) · Après (rapport) ══ */

type Step = "avant" | "pendant" | "apres";

const ATTENDANCE_OPTIONS: { value: PlayerAttendanceStatus; label: string; tone?: "bad" }[] = [
  { value: "present", label: "Présente" },
  { value: "late", label: "En retard" },
  { value: "left_early", label: "Partie tôt" },
  { value: "absent", label: "Absente", tone: "bad" },
  { value: "injured", label: "Blessée", tone: "bad" }
];

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const fullName = (p: RosterPlayer) => `${p.firstName} ${p.lastName}`.trim();

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: data?.error ?? "Pas enregistré. Vérifie ta connexion et réessaie." };
  } catch {
    return { ok: false, error: "Pas de connexion : réessaie dans un instant." };
  }
}

function Avatar({ player, large = false }: { player: RosterPlayer; large?: boolean }) {
  const cls = `coach-avatar${large ? " coach-avatar--lg" : ""}`;
  if (player.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={player.photoUrl} alt="" />;
  }
  return <div className={cls} aria-hidden>{`${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase()}</div>;
}

/* ── Avant : la pratique du jour ─────────────────────────────────── */

/** Montage prévu dans la fiche selon le nombre de joueuses attendues (banque Valkyria : 5 à 7, 8 à 10, 11 à 16). */
function setupForGroup(exercise: Record<string, unknown> | undefined, players: number): string | null {
  if (!exercise) return null;
  const key = players <= 7 ? "setup_5_7" : players <= 10 ? "setup_8_10" : "setup_11_16";
  const v = exercise[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function PracticeOfTheDay({ activity, theme, blocks, exercises, players }: { activity: CoachActivity; theme: Props["theme"]; blocks: SessionBlock[]; exercises: Exercise[]; players: number }) {
  const total = blocks.reduce((s, b) => s + b.duration_minutes, 0);
  const startAt = timeToMinutes(String(activity.start_time).slice(0, 5));
  // Heure de début de chaque bloc : début de l'activité + durée des blocs précédents.
  const starts = blocks.map((_, i) => startAt + blocks.slice(0, i).reduce((s, b) => s + b.duration_minutes, 0));

  return (
    <div>
      {theme && (
        <div className="coach-card" style={{ marginBottom: 12 }}>
          <p className="coach-card__label">Thème de la semaine</p>
          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--adm-text)" }}>{theme.theme}</p>
          {theme.notes && <p className="coach-sub" style={{ whiteSpace: "pre-line" }}>{theme.notes}</p>}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="coach-card">
          <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Le plan de cette pratique n&apos;est pas encore prêt.</p>
          <p className="coach-sub">JP le prépare dans l&apos;admin. S&apos;il manque à l&apos;arrivée, écris-lui ou ajoute les blocs avec « Modifier le plan » plus bas.</p>
        </div>
      ) : (
        <>
          <p className="coach-muted" style={{ margin: "0 0 8px" }}>
            {blocks.length} bloc{blocks.length > 1 ? "s" : ""} · {total} min · {players} joueuse{players > 1 ? "s" : ""} attendue{players > 1 ? "s" : ""}
          </p>
          {blocks.map((b, i) => {
            const exercise = exercises.find((e) => e.id === b.exercise_id) as (Exercise & Record<string, unknown>) | undefined;
            const fallback = exerciseGuideFallback(exercise);
            const from = starts[i];
            const groupSetup = setupForGroup(exercise, players);
            const rows: { label: string; value: string | null | undefined }[] = [
              { label: "Objectif", value: exercise?.objective },
              ...BLOCK_GUIDE_FIELDS.map((f) => ({
                label: f.key === "setup" && groupSetup && !b.setup ? `${f.label} (${players} joueuses)` : f.label,
                value: (b[f.key] as string | null | undefined) || (f.key === "setup" ? groupSetup ?? fallback.setup : fallback[f.key])
              })),
              { label: "Consignes", value: exercise?.instructions },
              { label: "Erreurs fréquentes", value: exercise?.common_mistakes },
              { label: "Notes de JP", value: b.notes }
            ];
            return (
              <div key={b.id} className="coach-block">
                <div className="coach-block__head">
                  <div>
                    <p className="coach-block__type">{b.block_type}</p>
                    <p className="coach-block__title">{b.custom_title || exercise?.title || b.block_type}</p>
                  </div>
                  <span className="coach-block__time">{hhmm(from)}–{hhmm(from + b.duration_minutes)} · {b.duration_minutes} min</span>
                </div>
                <dl>
                  {rows.filter((r) => r.value && String(r.value).trim()).map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
                {exercise?.diagram_data && <div style={{ marginTop: 12 }}><ExerciseDiagramView diagram={exercise.diagram_data} /></div>}
                {exercise?.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={exercise.image_url} alt={exercise.title} style={{ maxWidth: "100%", borderRadius: 8, marginTop: 12 }} />
                )}
                {exercise?.video_url && (
                  <a href={exercise.video_url} target="_blank" rel="noreferrer" className="coach-secondary" style={{ marginTop: 12 }}>Voir la vidéo de l&apos;exercice ↗</a>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ── Avant : le briefing de 5 minutes (P1.4.01) ──────────────────── */

function BriefingCard({ activity, players, expected }: { activity: CoachActivity; players: BriefingPlayer[]; expected: number }) {
  return (
    <div className="coach-card" style={{ marginBottom: 12 }}>
      <p className="coach-card__label">Briefing de 5 minutes · {expected} joueuse{expected > 1 ? "s" : ""} attendue{expected > 1 ? "s" : ""}</p>
      {players.length === 0 ? (
        <p className="coach-sub" style={{ marginTop: 0 }}>Rien de particulier à signaler sur les filles aujourd&apos;hui.</p>
      ) : (
        <ul className="coach-brief">
          {players.map((p) => (
            <li key={p.registrationId}>
              <strong>{p.name}</strong>
              {p.isTrial && <span className="coach-pill" data-tone="info">Essai : bien l&apos;accueillir</span>}
              {p.watch.map((w) => <span key={w} className="coach-brief__line" style={{ color: "var(--adm-warn)" }}>{w}</span>)}
              {p.absentLastTime && <span className="coach-brief__line">Absente la dernière fois</span>}
              {p.objectives.map((o) => <span key={o} className="coach-brief__line">Objectif : {o}</span>)}
            </li>
          ))}
        </ul>
      )}
      <p className="coach-card__label" style={{ marginTop: 16 }}>Moment surprise prévu</p>
      <SurpriseMomentEditor apiUrl={`/api/coach/activities/${activity.id}/surprise`} initial={activity.surprise_moment ?? null} inputClass="coach-textarea" buttonClass="coach-secondary" />
    </div>
  );
}

/* ── Pendant : les présences ─────────────────────────────────────── */

function AttendanceStep({
  activityId,
  roster,
  attendance,
  onChange
}: {
  activityId: string;
  roster: RosterPlayer[];
  attendance: Record<string, PlayerAttendanceStatus>;
  onChange: (ids: string[], status: PlayerAttendanceStatus) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unmarked = roster.filter((p) => !attendance[p.registrationId]);
  const here = roster.filter((p) => PARTICIPATED.includes(attendance[p.registrationId] ?? "")).length;

  const mark = async (ids: string[], status: PlayerAttendanceStatus, key: string) => {
    setBusy(key);
    setError(null);
    const r = await postJson("/api/coach/attendance", { activityId, registrationIds: ids, status });
    if (r.ok) onChange(ids, status);
    else setError(r.error ?? null);
    setBusy(null);
  };

  if (roster.length === 0) {
    return (
      <div className="coach-card">
        <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Aucune joueuse attendue pour ce groupe.</p>
        <p className="coach-sub">Si des filles sont là, écris à JP pour qu&apos;il les ajoute.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="coach-card" style={{ marginBottom: 12 }}>
        <p className="coach-card__label">Présences</p>
        <p className="coach-figure">{here}<span> présente{here > 1 ? "s" : ""} sur {roster.length}</span></p>
        {unmarked.length > 0 ? (
          <button className="coach-primary" disabled={busy !== null} onClick={() => mark(unmarked.map((p) => p.registrationId), "present", "all")}>
            {busy === "all" ? "Enregistrement…" : unmarked.length === roster.length ? "Toutes présentes" : `Marquer présentes les ${unmarked.length} autres`}
          </button>
        ) : (
          <p className="coach-ok" style={{ margin: "8px 0 0" }}>✓ Présence de chaque joueuse marquée</p>
        )}
        {error && <p className="coach-error">{error}</p>}
      </div>
      {roster.map((p) => {
        const current = attendance[p.registrationId];
        return (
          <div key={p.registrationId} className="coach-player">
            <div className="coach-player__head">
              <Avatar player={p} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="coach-player__name">{fullName(p)}</p>
                <p className="coach-muted" style={{ margin: 0 }}>{p.isTrial ? "Essai aujourd'hui" : `Née ${p.birthYear ?? "—"}${p.advancedGroup ? " · avancé" : ""}`}</p>
              </div>
              {!current && <span className="coach-pill" data-tone="warn">À marquer</span>}
            </div>
            <div className="coach-seg" style={{ marginTop: 10 }}>
              {ATTENDANCE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  data-active={String(current === o.value)}
                  data-tone={o.tone}
                  disabled={busy !== null}
                  onClick={() => mark([p.registrationId], o.value, p.registrationId)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Après : évaluation rapide, routine de fin, ma présence ──────── */

function QuickEvaluation({
  activityId,
  player,
  mine,
  others,
  open,
  onToggle,
  onSaved
}: {
  activityId: string;
  player: RosterPlayer;
  mine: PlayerEvaluation | undefined;
  others: { coach: string; evaluation: PlayerEvaluation }[];
  open: boolean;
  onToggle: () => void;
  onSaved: (ev: PlayerEvaluation) => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(mine?.ratings ?? {});
  const [note, setNote] = useState(mine?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = isQuickEvaluationComplete(mine);
  const doneByOther = others.find((o) => isQuickEvaluationComplete(o.evaluation));
  const length = cleanNote(note).length;
  const ready = QUICK_CRITERIA.every((c) => ratings[c]) && length >= NOTE_MIN_CHARS;

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await postJson("/api/coach/evaluations", { activityId, registrationId: player.registrationId, ratings, comment: note });
    setSaving(false);
    if (!r.ok) return setError(r.error ?? null);
    onSaved({ id: mine?.id ?? "", activity_id: activityId, registration_id: player.registrationId, coach_id: "", ratings: r.data.ratings, comment: r.data.comment, created_at: new Date().toISOString() });
  };

  return (
    <div className="coach-player">
      <button type="button" onClick={onToggle} className="coach-player__head" style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}>
        <Avatar player={player} large={open} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="coach-player__name">{fullName(player)}</p>
          {done && !open && <p className="coach-muted" style={{ margin: 0 }}>{QUICK_CRITERIA.map((c) => `${c} ${mine?.ratings?.[c]}`).join(" · ")}</p>}
          {!done && doneByOther && <p className="coach-muted" style={{ margin: 0 }}>Évaluée par {doneByOther.coach}</p>}
        </div>
        <span className="coach-pill" data-tone={done || doneByOther ? "good" : "warn"}>{done || doneByOther ? "✓ Évaluée" : "À évaluer"}</span>
      </button>

      {open && (
        <div>
          {QUICK_CRITERIA.map((c) => (
            <div key={c} className="coach-field">
              <p className="coach-field__label">
                {c}
                <span>{QUICK_SCALE.find((s) => s.value === ratings[c])?.label ?? "1 = à travailler · 5 = excellent"}</span>
              </p>
              <div className="coach-seg coach-seg--scale" role="radiogroup" aria-label={c}>
                {QUICK_SCALE.map((s) => (
                  <button key={s.value} type="button" role="radio" aria-checked={ratings[c] === s.value} data-active={String(ratings[c] === s.value)} onClick={() => setRatings((r) => ({ ...r, [c]: s.value }))}>
                    {s.value}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="coach-field">
            <p className="coach-field__label">
              Note sur {player.firstName}
              <span style={{ color: length >= NOTE_MIN_CHARS ? "var(--adm-good)" : undefined }}>{length}/{NOTE_MIN_CHARS} caractères</span>
            </p>
            <textarea
              className="coach-textarea"
              value={note}
              placeholder={`Comment ${player.firstName} s'est sentie, comment elle s'est comportée, ce qu'elle a réussi ou trouvé difficile.`}
              onChange={(e) => {
                setNote(e.target.value);
                setError(null);
              }}
              onPaste={(e) => {
                e.preventDefault();
                setError(`Le copier-coller est désactivé : écris (ou dicte) une note propre à ${player.firstName}.`);
              }}
              onDrop={(e) => e.preventDefault()}
            />
          </div>
          {error && <p className="coach-error" role="alert">{error}</p>}
          <button className="coach-primary" disabled={!ready || saving} onClick={save}>
            {saving ? "Enregistrement…" : done ? "Mettre à jour" : "Enregistrer et passer à la suivante"}
          </button>
        </div>
      )}
    </div>
  );
}

function EndRoutine({
  activityId,
  players,
  values,
  onChange
}: {
  activityId: string;
  players: RosterPlayer[];
  values: Record<string, { rating: number | null; fatigue: number | null }>;
  onChange: (id: string, v: { rating: number | null; fatigue: number | null }) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const done = players.filter((p) => values[p.registrationId]?.rating != null && values[p.registrationId]?.fatigue != null).length;

  const set = async (p: RosterPlayer, field: "rating" | "fatigue", raw: string) => {
    const prev = values[p.registrationId] ?? { rating: null, fatigue: null };
    const next = { ...prev, [field]: raw === "" ? null : Number(raw) };
    onChange(p.registrationId, next);
    const r = await postJson("/api/coach/feedback", { activityId, registrationId: p.registrationId, practiceRating: next.rating, fatigue: next.fatigue });
    if (!r.ok) {
      onChange(p.registrationId, prev);
      setError(r.error ?? null);
    } else setError(null);
  };

  return (
    <div className="coach-card">
      <p className="coach-card__label">Routine de fin · {done} sur {players.length}</p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        Avant de partir, chaque joueuse dit sa note de la pratique (0 à 10) et sa fatigue (0 = pleine d&apos;énergie, 10 = épuisée).
      </p>
      <div className="coach-progress" aria-hidden><div style={{ width: `${players.length ? (done / players.length) * 100 : 0}%` }} /></div>
      {error && <p className="coach-error">{error}</p>}
      <div style={{ marginTop: 12 }}>
        {players.map((p) => {
          const v = values[p.registrationId] ?? { rating: null, fatigue: null };
          return (
            <div key={p.registrationId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--adm-line)" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: "0.9rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.firstName} {p.lastName[0] ?? ""}.</span>
              {(["rating", "fatigue"] as const).map((field) => (
                <label key={field} style={{ display: "grid", gap: 2, textAlign: "center" }}>
                  <span className="coach-muted" style={{ fontSize: "0.68rem" }}>{field === "rating" ? "Note" : "Fatigue"}</span>
                  <select className="coach-time" value={v[field] ?? ""} onChange={(e) => set(p, field, e.target.value)} aria-label={`${field === "rating" ? "Note de la pratique" : "Fatigue"} de ${p.firstName}`} style={{ width: 64 }}>
                    <option value="">—</option>
                    {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Gagnantes du jour : l'éducateur touche le nom des gagnantes ; les points se comptent tout seuls. */
function WinnersCard({ activityId, players, initial }: { activityId: string; players: RosterPlayer[]; initial: { registration_id: string; kind: WinKind }[] }) {
  const [wins, setWins] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const has = (id: string, kind: WinKind) => wins.some((w) => w.registration_id === id && w.kind === kind);
  const count = (kind: WinKind) => wins.filter((w) => w.kind === kind).length;

  const toggle = async (id: string, kind: WinKind) => {
    const on = !has(id, kind);
    setError(null);
    const r = await postJson(`/api/coach/activities/${activityId}/winners`, { registrationId: id, kind, on });
    if (!r.ok) return setError(r.error ?? null);
    setWins((prev) => (on ? [...prev, { registration_id: id, kind }] : prev.filter((w) => !(w.registration_id === id && w.kind === kind))));
  };

  return (
    <div className="coach-card">
      <p className="coach-card__label">
        Gagnantes du jour · victoire {count("victoire")}/{MAX_WINNERS} · attitude {count("attitude")}/{MAX_WINNERS}
      </p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        Touche les gagnantes : +{POINTS.victoire} points pour une victoire, +{POINTS.attitude} pour l&apos;attitude (la présence donne déjà {POINTS.presence} points). Prends-les en photo si la famille l&apos;a permis.
      </p>
      {error && <p className="coach-error" role="alert">{error}</p>}
      <div style={{ marginTop: 8 }}>
        {players.map((p) => (
          <div key={p.registrationId} className="coach-win-row">
            <span>{p.firstName} {p.lastName[0] ?? ""}.</span>
            <div className="coach-seg">
              {(["victoire", "attitude"] as WinKind[]).map((k) => (
                <button key={k} type="button" data-active={String(has(p.registrationId, k))} aria-pressed={has(p.registrationId, k)} onClick={() => toggle(p.registrationId, k)} title={WIN_LABEL[k]}>
                  {k === "victoire" ? "🏆 Victoire" : "⭐ Attitude"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MyPresenceCard({ activity, initial, onChange }: { activity: CoachActivity; initial: MyPresence; onChange: (p: MyPresence) => void }) {
  const start = String(activity.start_time).slice(0, 5);
  const end = String(activity.end_time).slice(0, 5);
  const [presence, setPresence] = useState(initial);
  const [editing, setEditing] = useState(!initial.confirmed);
  const [arrival, setArrival] = useState(initial.arrivalTime ?? start);
  const [departure, setDeparture] = useState(initial.departureTime ?? end);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (status: "present" | "absent") => {
    setSaving(true);
    setError(null);
    const r = await postJson("/api/coach/presence", { activityId: activity.id, status, arrivalTime: arrival, departureTime: departure });
    setSaving(false);
    if (!r.ok) return setError(r.error ?? null);
    const next: MyPresence = { ...presence, status, confirmed: true, arrivalTime: status === "present" ? arrival : null, departureTime: status === "present" ? departure : null };
    setPresence(next);
    onChange(next);
    setEditing(false);
  };

  const hours = computeHours(presence.arrivalTime ?? start, presence.departureTime ?? end);
  return (
    <div className="coach-card">
      <p className="coach-card__label">Ma présence</p>
      {presence.confirmed && !editing ? (
        <>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
            {presence.status === "absent" ? "Absence confirmée" : `✓ Présence confirmée · ${presence.arrivalTime ?? start}–${presence.departureTime ?? end} · ${formatHoursMinutes(hours)}`}
          </p>
          {!presence.locked && <button className="coach-secondary" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Modifier mes heures</button>}
        </>
      ) : (
        <>
          <p className="coach-sub" style={{ marginTop: 0 }}>Confirme tes heures réelles : elles servent à calculer ta paie.</p>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <label style={{ display: "grid", gap: 4, flex: 1 }}>
              <span className="coach-muted">Arrivée</span>
              <input className="coach-time" type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4, flex: 1 }}>
              <span className="coach-muted">Départ</span>
              <input className="coach-time" type="time" value={departure} onChange={(e) => setDeparture(e.target.value)} />
            </label>
          </div>
          <p className="coach-muted" style={{ margin: "8px 0 0" }}>{formatHoursMinutes(computeHours(arrival, departure))}</p>
          {error && <p className="coach-error" role="alert">{error}</p>}
          <button className="coach-primary" disabled={saving} onClick={() => send("present")}>{saving ? "Enregistrement…" : "Confirmer ma présence"}</button>
          <button className="coach-secondary" style={{ width: "100%", marginTop: 8 }} disabled={saving} onClick={() => send("absent")}>Je n&apos;étais pas là</button>
        </>
      )}
    </div>
  );
}

export function CoachActiviteDetail({
  coachName,
  coachId,
  activity,
  otherCoaches,
  roster,
  initialAttendance,
  initialEvaluations,
  coachNames,
  myPresence,
  theme,
  sessionBlocks,
  initialExercises,
  defaultStep,
  briefing,
  initialWinners,
  matchRoster,
  initialMatchDetails,
  initialMatchConvocations,
  initialMatchLineup,
  initialMatchPlaytime,
  initialMatchEvaluations
}: Props & { defaultStep: Step; briefing: BriefingPlayer[]; initialWinners: { registration_id: string; kind: WinKind }[] }) {
  const [step, setStep] = useState<Step>(defaultStep);
  const [showEditor, setShowEditor] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, PlayerAttendanceStatus>>(Object.fromEntries(initialAttendance.map((a) => [a.registration_id, a.status])));
  const [feedback, setFeedback] = useState<Record<string, { rating: number | null; fatigue: number | null }>>(
    Object.fromEntries(initialAttendance.map((a) => [a.registration_id, { rating: a.practice_rating ?? null, fatigue: a.fatigue ?? null }]))
  );
  const [mine, setMine] = useState<Record<string, PlayerEvaluation>>(Object.fromEntries(initialEvaluations.filter((e) => e.coach_id === coachId).map((e) => [e.registration_id, e])));
  const [presence, setPresence] = useState(myPresence);
  const [openId, setOpenId] = useState<string | null>(() => {
    const done = (id: string) => initialEvaluations.some((e) => e.registration_id === id && isQuickEvaluationComplete(e));
    return roster.find((p) => PARTICIPATED.includes(attendance[p.registrationId] ?? "") && !done(p.registrationId))?.registrationId ?? null;
  });
  const stepsRef = useRef<HTMLElement>(null);
  const goTo = (next: Step) => {
    setStep(next);
    const top = stepsRef.current ? stepsRef.current.getBoundingClientRect().top + window.scrollY - 8 : 0;
    if (window.scrollY > top) window.scrollTo({ top });
  };

  const others = useMemo(() => {
    const map: Record<string, { coach: string; evaluation: PlayerEvaluation }[]> = {};
    for (const e of initialEvaluations.filter((x) => x.coach_id !== coachId)) (map[e.registration_id] ??= []).push({ coach: coachNames[e.coach_id] ?? "un autre éducateur", evaluation: e });
    return map;
  }, [initialEvaluations, coachId, coachNames]);

  const participants = roster.filter((p) => PARTICIPATED.includes(attendance[p.registrationId] ?? ""));
  const isEvaluated = (id: string) => isQuickEvaluationComplete(mine[id]) || (others[id] ?? []).some((o) => isQuickEvaluationComplete(o.evaluation));
  const marked = roster.filter((p) => attendance[p.registrationId]).length;
  const evaluated = participants.filter((p) => isEvaluated(p.registrationId)).length;
  const routineDone = participants.filter((p) => feedback[p.registrationId]?.rating != null && feedback[p.registrationId]?.fatigue != null).length;
  const reportNeeded = REPORT_REQUIRED_TYPES.includes(activity.activity_type) && !activity.organization && roster.length > 0;
  const ruleApplies = String(activity.activity_date).slice(0, 10) >= REPORT_RULE_START;
  const reportComplete = !reportNeeded || (marked === roster.length && evaluated === participants.length);
  const hoursCount = presence.confirmed && (reportComplete || !ruleApplies);
  const afterDone = [presence.confirmed, !reportNeeded || marked === roster.length, !reportNeeded || evaluated === participants.length].filter(Boolean).length;

  const openNext = (afterId: string) => {
    const order = participants.map((p) => p.registrationId);
    const next = order.slice(order.indexOf(afterId) + 1).concat(order).find((id) => id !== afterId && !isEvaluated(id));
    setOpenId(next ?? null);
  };

  const date = new Date(`${String(activity.activity_date).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const steps: { key: Step; label: string; detail: string }[] = [
    { key: "avant", label: "Avant", detail: "La pratique" },
    { key: "pendant", label: "Pendant", detail: roster.length ? `Présences ${marked}/${roster.length}` : "Présences" },
    { key: "apres", label: "Après", detail: `Rapport ${afterDone}/${reportNeeded ? 3 : 1}` }
  ];

  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="coach-page">
          <Link href="/entraineur/dashboard" className="coach-muted" style={{ textDecoration: "none", display: "inline-block", marginBottom: 12 }}>← Mes pratiques</Link>
          <h1 className="coach-title">{activity.title ? activity.title : activity.activity_type}</h1>
          <p className="coach-sub">
            <span style={{ textTransform: "capitalize" }}>{date}</span> · {String(activity.start_time).slice(0, 5)}–{String(activity.end_time).slice(0, 5)}
            {activity.location && ` · ${activity.location}`}
          </p>
          {otherCoaches.length > 0 && <p className="coach-muted" style={{ margin: "4px 0 0" }}>Avec {otherCoaches.map((c) => c.first_name).join(", ")}</p>}

          <nav ref={stepsRef} className="coach-steps" aria-label="Étapes de la pratique">
            {steps.map((s) => (
              <button key={s.key} type="button" data-active={String(step === s.key)} onClick={() => goTo(s.key)}>
                {s.label}
                <small>{s.detail}</small>
              </button>
            ))}
          </nav>

          {step === "avant" && (
            <>
              {activity.activity_type === "Match" && (
                <div style={{ marginBottom: 16 }}>
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
                </div>
              )}
              {activity.activity_type !== "Match" && <BriefingCard activity={activity} players={briefing} expected={roster.length} />}
              <PracticeOfTheDay activity={activity} theme={theme} blocks={sessionBlocks} exercises={initialExercises} players={roster.length} />

              {(activity.notes || activity.video_url) && (
                <div className="coach-card" style={{ marginTop: 12 }}>
                  <p className="coach-card__label">Ressources</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activity.notes && /^https?:\/\//.test(activity.notes) && <a href={activity.notes} target="_blank" rel="noreferrer" className="coach-secondary">Ouvrir le document ↗</a>}
                    {activity.video_url && <a href={activity.video_url} target="_blank" rel="noreferrer" className="coach-secondary">Ouvrir la vidéo ↗</a>}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <EntityDocuments entityType="coach_activity" entityId={activity.id} apiBase="/api/coach/documents" readOnly />
              </div>

              <div style={{ marginTop: 24 }}>
                <button type="button" className="coach-secondary" onClick={() => setShowEditor(!showEditor)}>{showEditor ? "Fermer" : "Modifier le plan"}</button>
                {showEditor && (
                  <div style={{ marginTop: 16 }}>
                    <SessionPlanEditor activityId={activity.id} initialBlocks={sessionBlocks} initialExercises={initialExercises} />
                  </div>
                )}
              </div>
              <button type="button" className="coach-primary" onClick={() => goTo("pendant")}>Commencer : les présences</button>
            </>
          )}

          {step === "pendant" && (
            <>
              <AttendanceStep
                activityId={activity.id}
                roster={roster}
                attendance={attendance}
                onChange={(ids, status) => setAttendance((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, status])) }))}
              />
              <button type="button" className="coach-primary" onClick={() => goTo("apres")}>Fin de la pratique : le rapport</button>
            </>
          )}

          {step === "apres" && (
            <>
              <div className="coach-card" style={{ marginBottom: 16 }}>
                <p className="coach-card__label">Ton rapport</p>
                <ul className="coach-checklist">
                  {reportNeeded && <li data-done={String(marked === roster.length)}>Présences des joueuses · {marked}/{roster.length}</li>}
                  {reportNeeded && <li data-done={String(participants.length > 0 && evaluated === participants.length)}>Évaluation de chaque joueuse présente · {evaluated}/{participants.length}</li>}
                  {reportNeeded && <li data-done={String(participants.length > 0 && routineDone === participants.length)}>Routine de fin · {routineDone}/{participants.length}</li>}
                  <li data-done={String(presence.confirmed)}>Ma présence confirmée</li>
                </ul>
                <p className="coach-sub" style={{ marginTop: 12, color: hoursCount ? "var(--adm-good)" : undefined }}>
                  {hoursCount
                    ? "Rapport complet : tes heures comptent pour la paie."
                    : ruleApplies
                      ? "Tes heures comptent pour la paie quand ta présence est confirmée et que les présences et les évaluations sont faites."
                      : "Confirme ta présence pour que tes heures comptent."}
                </p>
              </div>

              {reportNeeded && marked < roster.length && (
                <div className="coach-card" style={{ marginBottom: 16 }}>
                  <p style={{ margin: 0, color: "var(--adm-text)" }}>Il reste {roster.length - marked} présence{roster.length - marked > 1 ? "s" : ""} à marquer.</p>
                  <button className="coach-secondary" style={{ marginTop: 12 }} onClick={() => goTo("pendant")}>Marquer les présences</button>
                </div>
              )}

              {reportNeeded && participants.length > 0 && (
                <section style={{ marginBottom: 16 }}>
                  <h2 className="coach-h2">Évaluation rapide · {evaluated}/{participants.length}</h2>
                  <p className="coach-muted" style={{ margin: "-6px 0 12px" }}>Moins de 2 minutes par fille : 3 notes de 1 à 5 et une phrase sur ce que tu as vu.</p>
                  {participants.map((p) => (
                    <QuickEvaluation
                      key={p.registrationId}
                      activityId={activity.id}
                      player={p}
                      mine={mine[p.registrationId]}
                      others={others[p.registrationId] ?? []}
                      open={openId === p.registrationId}
                      onToggle={() => setOpenId(openId === p.registrationId ? null : p.registrationId)}
                      onSaved={(ev) => {
                        setMine((prev) => ({ ...prev, [p.registrationId]: ev }));
                        openNext(p.registrationId);
                      }}
                    />
                  ))}
                </section>
              )}

              {reportNeeded && participants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <EndRoutine activityId={activity.id} players={participants} values={feedback} onChange={(id, v) => setFeedback((prev) => ({ ...prev, [id]: v }))} />
                </div>
              )}

              {participants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <WinnersCard activityId={activity.id} players={participants} initial={initialWinners} />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <CoachExerciseRatings activityId={activity.id} />
              </div>

              <MyPresenceCard activity={activity} initial={presence} onChange={setPresence} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
