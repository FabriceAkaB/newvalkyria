"use client";

import Link from "next/link";
import { FolderOpen, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EntityDocuments } from "@/components/admin-entity-documents";
import { CoachPracticeDeck } from "@/components/coach-practice-deck";
import { CoachChampionsCard } from "@/components/coach-champions-card";
import { CoachTeamsCard } from "@/components/coach-teams-card";
import { CoachDebriefCard, PreviousDebriefCard } from "@/components/coach-debrief";
import { CoachIncidentCard } from "@/components/coach-incident-card";
import { CoachPracticeJournal } from "@/components/coach-practice-journal";
import { CoachGuideCard, PracticeTimer } from "@/components/coach-guide";
import { exerciseGuideFallback, setupForGroup } from "@/lib/practice-plan-view";
import { CoachExerciseRatings } from "@/components/coach-exercise-ratings";
import { PlannedExercisesCard } from "@/components/planned-exercises-card";
import { ballMasteryState, isBallMasteryBlock } from "@/lib/ball-mastery-skip";
import { blockAnswer, blockTitle, plannedRequired, plannedSummary } from "@/lib/planned-exercises";
import type { PlannedView } from "@/lib/planned-exercises-repo";
import { observerOf } from "@/lib/gesture-scores";
import { CoachTopbar } from "@/components/coach-topbar";
import { MatchPlayer } from "@/components/match-player";
import { SurpriseMomentEditor } from "@/components/surprise-moment";
import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { MatchPanel } from "@/components/match-panel";
import { PracticeSurvey } from "@/components/practice-survey";
import { computeHours, formatHoursMinutes, timeToMinutes } from "@/lib/coach-payroll";
import { planningLabel } from "@/lib/exercise-bank";
import type { BriefingPlayer, PlayerAttendance, PlayerAttendanceStatus, PlayerEvaluation, RosterPlayer } from "@/lib/coach-portal-repo";
import type { PointsRules } from "@/lib/player-points";
import type { ChampionPost } from "@/lib/player-points-repo";
import { blockKey, practiceReadStatus, type ReadItem } from "@/lib/practice-read";
import { themeForGroup } from "@/lib/practice-teams-core";
import { isAnswered, type SurveyAnswer } from "@/lib/practice-survey";
import { countWords, hasReportHour, isBoysActivity, isDebriefComplete, isQuickEvaluationComplete, NOTE_MIN_WORDS, PARTICIPATED, QUICK_CRITERIA, QUICK_SCALE, REPORT_REQUIRED_TYPES, REPORT_RULE_START, REPORT_RULE_V2_START } from "@/lib/coach-report";
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
  /** Statut : « Entraîneur principal » (coach, heure de rapport) ou « Assistant ». */
  coachRole?: string | null;
  coachId: string;
  activity: CoachActivity;
  otherCoaches: { id: string; first_name: string; last_name: string }[];
  roster: RosterPlayer[];
  initialAttendance: PlayerAttendance[];
  initialEvaluations: PlayerEvaluation[];
  coachNames: Record<string, string>;
  /** null : accès d'équipe (pratique de l'Académie sans y être assignée) ; pas de présence ni de paie. */
  myPresence: MyPresence | null;
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
            <div key={b.id} style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-line)", borderRadius: "8px", padding: "0.5rem 0.8rem" }}>
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
    if (res.status === 401) return { ok: false, error: "Ta connexion a expiré : rien n'a été enregistré. Reconnecte-toi avec le bandeau en bas de l'écran, puis touche Enregistrer de nouveau (ton texte reste ici)." };
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

/** Lien discret vers le dossier complet de la joueuse (nouvel onglet : l'évaluation en cours reste ouverte). */
function DossierLink({ player }: { player: RosterPlayer }) {
  return (
    <a
      href={`/entraineur/joueuses/${player.registrationId}`}
      target="_blank"
      rel="noopener"
      aria-label={`Dossier de ${fullName(player)} (nouvel onglet)`}
      title="Ouvrir son dossier dans un nouvel onglet"
      onClick={(e) => e.stopPropagation()}
      style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, padding: "0 8px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, color: "var(--adm-text-2)", textDecoration: "none", border: "1px solid var(--adm-border)", background: "var(--adm-surface)" }}
    >
      <FolderOpen size={14} aria-hidden /> Dossier
    </a>
  );
}

/* ── Avant : la pratique du jour ─────────────────────────────────── */

function PracticeOfTheDay({ activity, theme, blocks, exercises, players, seen, onSeen }: { activity: CoachActivity; theme: Props["theme"]; blocks: SessionBlock[]; exercises: Exercise[]; players: number; seen: string[]; onSeen: (key: string) => void }) {
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
                {exercise?.content_updated_at && b.created_at && Date.parse(exercise.content_updated_at) > Date.parse(b.created_at) + 60_000 ? (
                  <p className="coach-sub" style={{ margin: "0 0 8px", color: "var(--adm-warn)" }}>
                    ✏️ Exercice modifié le{" "}
                    {new Date(exercise.content_updated_at).toLocaleDateString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long" })}, après la préparation de cette pratique : suis ce qui est écrit ici (la diapo peut montrer l&apos;ancienne version).
                  </p>
                ) : null}
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
                {seen.includes(blockKey(b.id)) ? (
                  <p className="coach-ok" style={{ margin: "12px 0 0" }}>✓ Exercice lu</p>
                ) : (
                  <button type="button" className="coach-secondary" style={{ marginTop: 12, width: "100%" }} onClick={() => onSeen(blockKey(b.id))}>
                    J&apos;ai lu cet exercice
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ── Avant : la prise de connaissance de la pratique ─────────────── */

function PracticeReadCard({ items, seen, readAt, onConfirm }: { items: ReadItem[]; seen: string[]; readAt: string | null; onConfirm: () => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = practiceReadStatus(items, seen, readAt);
  if (!status.hasContent) return null;
  const when = readAt
    ? new Date(readAt).toLocaleString("fr-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;
  const confirm = async () => {
    setBusy(true);
    setError(await onConfirm());
    setBusy(false);
  };
  return (
    <div className="coach-card" style={{ marginTop: 12, borderColor: status.confirmed ? "var(--adm-good)" : undefined }}>
      <p className="coach-card__label">J&apos;ai pris connaissance de la pratique</p>
      {status.confirmed ? (
        <p className="coach-ok" style={{ margin: 0 }}>✓ Confirmé {when ? `le ${when}` : ""}. JP le voit dans l&apos;admin.</p>
      ) : (
        <>
          <p className="coach-sub" style={{ marginTop: 0 }}>Ouvre les diapos et lis chaque exercice avant d&apos;arriver au terrain, puis confirme. JP voit qui l&apos;a fait.</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
            {items.map((i) => (
              <li key={i.key} style={{ display: "flex", gap: 8, color: seen.includes(i.key) ? "var(--adm-good)" : "var(--adm-text-2)" }}>
                <span aria-hidden>{seen.includes(i.key) ? "✓" : "○"}</span>
                <span>{i.label}</span>
              </li>
            ))}
          </ul>
          <button className="coach-primary" style={{ marginTop: 12 }} disabled={!status.canConfirm || busy} onClick={confirm}>
            {busy ? "Enregistrement…" : status.canConfirm ? "Je confirme avoir pris connaissance de la pratique" : `Encore ${status.missing.length} à voir`}
          </button>
          {error && <p className="coach-error" role="alert">{error}</p>}
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
              {p.gestures?.length ? <span className="coach-brief__line">Geste à retravailler : {p.gestures.join(", ")}</span> : null}
              {p.health ? <span className="coach-brief__line" style={{ color: "var(--adm-bad)", fontWeight: 600 }}>Santé (dit par le parent) : {p.health}</span> : null}
              {p.sheet ? <span className="coach-brief__line">Fiche joueuse : {p.sheet}</span> : null}
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
      {/* Ordinateur : les joueuses sur deux colonnes ; téléphone : une seule. */}
      <div className="coach-roster-grid">
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
              <DossierLink player={p} />
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
    </div>
  );
}

/* ── Après : évaluation rapide, routine de fin, ma présence ──────── */

/** Les gestes du ball mastery du jour (« 1. Right Foot Weave : … » dans le déroulement de l'exercice). */
function ballMasteryMoves(blocks: SessionBlock[], exercises: Exercise[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const ex = exercises.find((e) => e.id === b.exercise_id) as (Exercise & { exercise_type?: string | null; instructions?: string | null }) | undefined;
    if (!ex || (ex.exercise_type !== "ball-mastery" && b.block_type !== "Ball mastery")) continue;
    for (const line of String(ex.instructions ?? "").split("\n")) {
      const m = line.match(/^\s*\d+[.)]\s*([^:]{3,60}?)\s*:/);
      if (m) out.push(m[1].trim());
    }
  }
  return [...new Set(out)];
}

function QuickEvaluation({
  activityId,
  activityDate,
  player,
  mine,
  others,
  open,
  onToggle,
  onSaved,
  gestureChoices = [],
  bmSkipped = false,
  skippedGestures = []
}: {
  gestureChoices?: string[];
  /** « Le ball mastery n'a pas été fait » : pas de gestes à noter, ceux déjà notés ne sont ni montrés ni envoyés. */
  bmSkipped?: boolean;
  skippedGestures?: string[];
  activityId: string;
  activityDate: string;
  player: RosterPlayer;
  mine: PlayerEvaluation | undefined;
  others: { coach: string; evaluation: PlayerEvaluation }[];
  open: boolean;
  onToggle: () => void;
  onSaved: (ev: PlayerEvaluation) => void;
}) {
  const [ratings, setRatings] = useState<Record<string, number>>(mine?.ratings ?? {});
  const [note, setNote] = useState(mine?.comment ?? "");
  const [gestures, setGestures] = useState<string[]>(mine?.gestures ?? []);
  const shownGestures = bmSkipped ? gestures.filter((g) => !skippedGestures.includes(g) && !Object.keys(mine?.gesture_scores ?? {}).includes(g)) : gestures;
  // Note de chaque geste du ball mastery du jour : 1 = incapable, 10 = parfait (JP, 18 nov. 2026).
  const [scores, setScores] = useState<Record<string, number>>(mine?.gesture_scores ?? {});
  const [otherGesture, setOtherGesture] = useState("");
  const toggleGesture = (g: string) => setGestures((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = isQuickEvaluationComplete(mine, activityDate);
  const doneByOther = others.find((o) => isQuickEvaluationComplete(o.evaluation, activityDate));
  const length = countWords(note);
  const ready = QUICK_CRITERIA.every((c) => ratings[c]) && length >= NOTE_MIN_WORDS && gestureChoices.every((g) => scores[g]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await postJson("/api/coach/evaluations", { activityId, registrationId: player.registrationId, ratings, comment: note, gestures: shownGestures, gestureScores: bmSkipped ? {} : scores });
    setSaving(false);
    if (!r.ok) return setError(r.error ?? null);
    onSaved({ id: mine?.id ?? "", activity_id: activityId, registration_id: player.registrationId, coach_id: "", ratings: r.data.ratings, comment: r.data.comment, gestures: r.data.gestures ?? [], gesture_scores: bmSkipped ? (mine?.gesture_scores ?? {}) : (r.data.gestureScores ?? scores), created_at: new Date().toISOString() });
  };

  return (
    <div className="coach-player">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button type="button" onClick={onToggle} className="coach-player__head" style={{ flex: 1, minWidth: 0, width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}>
        <Avatar player={player} large={open} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="coach-player__name">{fullName(player)}</p>
          {done && !open && <p className="coach-muted" style={{ margin: 0 }}>{QUICK_CRITERIA.map((c) => `${c} ${mine?.ratings?.[c]}`).join(" · ")}</p>}
          {!open && !bmSkipped && mine?.gesture_scores && Object.keys(mine.gesture_scores).length ? <p className="coach-muted" style={{ margin: 0 }}>{Object.entries(mine.gesture_scores).map(([g, v]) => `${g} ${v}/10`).join(" · ")}</p> : null}
          {!open && (bmSkipped ? shownGestures : mine?.gestures ?? []).length ? <p className="coach-muted" style={{ margin: 0, color: "var(--adm-warn)" }}>À retravailler : {(bmSkipped ? shownGestures : mine?.gestures ?? []).join(", ")}</p> : null}
          {!done && doneByOther && <p className="coach-muted" style={{ margin: 0 }}>Évaluée par {doneByOther.coach}</p>}
        </div>
        <span className="coach-pill" data-tone={done || doneByOther ? "good" : "warn"}>{done || doneByOther ? "✓ Évaluée" : "À évaluer"}</span>
      </button>
      <DossierLink player={player} />
      </div>

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
          {gestureChoices.length ? (
            <div className="coach-field">
              <p className="coach-field__label">
                Gestes du ball mastery
                <span>1 = incapable · 10 = parfait · 4 ou moins = à retravailler</span>
              </p>
              {gestureChoices.map((g) => (
                <div key={g} style={{ margin: "8px 0" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "0.85rem", fontWeight: 600, color: scores[g] && scores[g] <= 4 ? "var(--adm-warn)" : "var(--adm-text)" }}>
                    {g}
                    {scores[g] ? ` · ${scores[g]}/10` : ""}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 4 }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-label={`${g} : ${v} sur 10`}
                        aria-pressed={scores[g] === v}
                        onClick={() => setScores((s) => ({ ...s, [g]: v }))}
                        style={{ minHeight: 36, borderRadius: 8, border: scores[g] === v ? "2px solid var(--adm-accent)" : "1px solid var(--adm-line)", background: scores[g] === v ? `hsl(${Math.round(((v - 1) / 9) * 120)}, 65%, 45%)` : "var(--adm-surface)", color: scores[g] === v ? "#fff" : "var(--adm-text)", fontWeight: 700, cursor: "pointer", padding: 0 }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="coach-field">
            <p className="coach-field__label">
              Autres gestes difficiles pour {player.firstName}
              <span>facultatif · touche ceux qu&apos;elle a du mal à faire</span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...new Set(shownGestures.filter((g) => !gestureChoices.includes(g)))].map((g) => (
                <button key={g} type="button" className="coach-pill" data-tone={gestures.includes(g) ? "warn" : undefined} aria-pressed={gestures.includes(g)} onClick={() => toggleGesture(g)} style={{ cursor: "pointer", border: gestures.includes(g) ? undefined : "1px solid var(--adm-line)" }}>
                  {gestures.includes(g) ? "✗ " : ""}
                  {g}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input className="coach-time" style={{ flex: 1 }} value={otherGesture} placeholder="Autre geste (ex. contrôle orienté pied gauche)" onChange={(e) => setOtherGesture(e.target.value)} />
              <button
                type="button"
                className="coach-secondary"
                disabled={!otherGesture.trim()}
                onClick={() => {
                  const g = otherGesture.trim().slice(0, 60);
                  if (g && !gestures.includes(g)) setGestures((list) => [...list, g]);
                  setOtherGesture("");
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
          <div className="coach-field">
            <p className="coach-field__label">
              Note sur {player.firstName}
              <span style={{ color: length >= NOTE_MIN_WORDS ? "var(--adm-good)" : undefined }}>{length}/{NOTE_MIN_WORDS} mots</span>
            </p>
            <textarea
              className="coach-textarea"
              value={note}
              placeholder={`Observation de ${player.firstName} (${NOTE_MIN_WORDS} mots minimum) : 1. comment elle était aujourd'hui ; 2. comment elle progresse ; 3. un exemple vu à la pratique. Ex. : « Concentrée et souriante. Son contrôle orienté progresse, elle lève la tête plus tôt. Au 2c2, elle a cadré la porteuse et récupéré le ballon deux fois. »`}
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
          {!presence.locked && <button className="coach-secondary" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Modifier ma présence</button>}
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
          <button className="coach-secondary" style={{ width: "100%", marginTop: 8 }} disabled={saving} onClick={() => send("absent")}>Je n&apos;étais pas là pour ce groupe</button>
          <p className="coach-muted" style={{ margin: "8px 0 0" }}>Là pour une partie seulement (ex. absent au 2e bloc) ? Touche ce bouton dans le groupe où tu n&apos;étais pas : tu n&apos;auras rien à remplir pour lui.</p>
        </>
      )}
    </div>
  );
}

export function CoachActiviteDetail({
  coachName,
  coachRole = null,
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
  initialChampions,
  pointsRules,
  matchRoster,
  initialMatchDetails,
  initialMatchConvocations,
  initialMatchLineup,
  initialMatchPlaytime,
  initialMatchEvaluations,
  musts = [],
  videos = [],
  readItems = [],
  initialReadSeen = [],
  initialReadAt = null,
  helped = [],
  pickupCard = null,
  view = "etapes"
}: Props & {
  /** Colis de la boutique à remettre à cette séance (coach-pickup-card.tsx, JP 25 nov. 2026). */
  pickupCard?: React.ReactNode;
  /** « tout-en-un » : la pratique, l'évaluation des filles et le rapport sur un seul écran (JP, 25 nov. 2026). */
  view?: "etapes" | "tout-en-un";
  helped?: { registrationId: string; name: string }[];
  defaultStep: Step;
  briefing: BriefingPlayer[];
  initialChampions: ChampionPost[];
  pointsRules: PointsRules;
  musts?: { title: string; text: string }[];
  videos?: { id: string; title: string }[];
  readItems?: ReadItem[];
  initialReadSeen?: string[];
  initialReadAt?: string | null;
}) {
  const [step, setStep] = useState<Step>(defaultStep);
  const [readSeen, setReadSeen] = useState<string[]>(initialReadSeen);
  const [readAt, setReadAt] = useState<string | null>(initialReadAt);
  const markSeen = async (key: string) => {
    if (readSeen.includes(key)) return;
    setReadSeen((s) => (s.includes(key) ? s : [...s, key]));
    const r = await postJson(`/api/coach/activities/${activity.id}/lecture`, { item: key });
    if (r.ok && Array.isArray(r.data?.seen)) setReadSeen(r.data.seen);
  };
  const confirmRead = async () => {
    const r = await postJson(`/api/coach/activities/${activity.id}/lecture`, { confirm: true });
    if (!r.ok) return r.error ?? "Pas enregistré.";
    setReadAt(r.data?.readAt ?? new Date().toISOString());
    return null;
  };
  const read = practiceReadStatus(readItems, readSeen, readAt);
  const bmAllMoves = useMemo(() => ballMasteryMoves(sessionBlocks, initialExercises), [sessionBlocks, initialExercises]);
  // « Exercices prévus : faits ? » (JP, 26 nov. 2026) : Oui / Non pour chaque bloc du plan, une réponse partagée par
  // tous les éducateurs (planned-exercises.ts). La ligne du ball mastery remplace « Ball mastery fait aujourd'hui ? » :
  // tous ses blocs à « Non » = pas de gestes à noter pour aucune fille ; sans réponse, les gestes sont demandés comme avant.
  const plannedInitial = useMemo<PlannedView>(() => {
    const typeOf = (id: string) => (initialExercises.find((e) => e.id === id) as (Exercise & { exercise_type?: string | null }) | undefined)?.exercise_type;
    const titleOf = (id: string) => initialExercises.find((e) => e.id === id)?.title;
    const blocks = sessionBlocks as (SessionBlock & { not_done?: boolean | null; not_done_at?: string | null })[];
    const rows = blocks.map((b) => ({ id: b.id, order: b.block_order, title: blockTitle(b, titleOf), blockType: b.block_type, minutes: b.duration_minutes ?? null, ballMastery: isBallMasteryBlock(b, typeOf), answer: blockAnswer(b), byName: null, at: b.not_done_at ?? null }));
    return { blocks: rows, summary: plannedSummary(blocks), ballMasterySkipped: ballMasteryState(blocks, typeOf).skipped };
  }, [sessionBlocks, initialExercises]);
  const [planned, setPlanned] = useState<PlannedView>(plannedInitial);
  const bmSkipped = planned.ballMasterySkipped;
  const bmMoves = bmSkipped ? [] : bmAllMoves;
  // Guide de l'éducateur et minuteur : les blocs du plan dans l'ordre, avec leur durée.
  const guideBlocks = useMemo(
    () => sessionBlocks.map((b) => ({ title: b.custom_title || initialExercises.find((e) => e.id === b.exercise_id)?.title || b.block_type, minutes: b.duration_minutes })),
    [sessionBlocks, initialExercises]
  );
  const isPractice = activity.activity_type === "Pratique" || activity.activity_type === "Camp";
  // Les blocs du plan, pour « Exercices réalisés » du rapport journalier.
  const journalBlocks = sessionBlocks.map((b) => ({ id: b.id, title: b.custom_title || initialExercises.find((e) => e.id === b.exercise_id)?.title || b.block_type }));
  const [showEditor, setShowEditor] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, PlayerAttendanceStatus>>(Object.fromEntries(initialAttendance.map((a) => [a.registration_id, a.status])));
  const [feedback, setFeedback] = useState<Record<string, SurveyAnswer>>(
    Object.fromEntries(
      initialAttendance.map((a) => [a.registration_id, { practiceRating: a.practice_rating ?? null, fatigue: a.fatigue ?? null, wantsMore: a.wants_more ?? [], wantsMoreNote: a.wants_more_note ?? null }])
    )
  );
  const [mine, setMine] = useState<Record<string, PlayerEvaluation>>(Object.fromEntries(initialEvaluations.filter((e) => e.coach_id === coachId).map((e) => [e.registration_id, e])));
  const guest = myPresence === null;
  const [presence, setPresence] = useState<MyPresence>(myPresence ?? { status: "present" as AssignmentStatus, confirmed: false, arrivalTime: null, departureTime: null, locked: true });
  // Retour 2 + 2 de cet éducateur : lu par la carte « Retour sur la pratique » de l'étape « Après ».
  const [debriefDone, setDebriefDone] = useState(false);
  // Note des exercices (dans l'heure après la pratique) : faite / à faire, pour le suivi étape par étape.
  const [exerciseRating, setExerciseRating] = useState<{ rated: number; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/coach/activities/${activity.id}/exercise-ratings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.exercises) return;
        const list = d.exercises as { myRating?: unknown; notDone?: boolean }[];
        setExerciseRating({ rated: list.filter((e) => e.myRating || e.notDone).length, total: list.length });
      })
      .catch(() => null);
    fetch(`/api/coach/activities/${activity.id}/retour`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const mine = (d.debriefs ?? []).find((x: { coachId: string }) => x.coachId === d.coachId);
        if (mine) setDebriefDone(isDebriefComplete(mine));
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [activity.id]);
  const [openId, setOpenId] = useState<string | null>(() => {
    const done = (id: string) => initialEvaluations.some((e) => e.registration_id === id && isQuickEvaluationComplete(e, String(activity.activity_date).slice(0, 10)));
    return roster.find((p) => PARTICIPATED.includes(attendance[p.registrationId] ?? "") && !done(p.registrationId))?.registrationId ?? null;
  });
  const stepsRef = useRef<HTMLElement>(null);
  const allInOne = view === "tout-en-un" && activity.activity_type !== "Match";
  const goTo = (next: Step) => {
    // Vue « tout-en-un » : tout est déjà à l'écran, on descend jusqu'à la bonne section.
    if (allInOne) {
      document.getElementById(`te-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
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
  // Les filles à observer de cet éducateur : partagées entre les éducateurs de la pratique (une sur n à chacun).
  const observed = new Set([...observerOf([...participants].sort((x, y) => fullName(x).localeCompare(fullName(y), "fr")).map((p) => p.registrationId), [coachId, ...otherCoaches.map((c) => c.id)])].filter(([, c]) => c === coachId).map(([p]) => p));
  const activityDay = String(activity.activity_date).slice(0, 10);
  const isEvaluated = (id: string) => isQuickEvaluationComplete(mine[id], activityDay) || (others[id] ?? []).some((o) => isQuickEvaluationComplete(o.evaluation, activityDay));
  const marked = roster.filter((p) => attendance[p.registrationId]).length;
  const evaluated = participants.filter((p) => isEvaluated(p.registrationId)).length;
  const routineDone = participants.filter((p) => isAnswered(feedback[p.registrationId])).length;
  const isCoach = hasReportHour(coachRole);
  // Absent pour ce groupe (ex. 2e bloc, « Je n'étais pas là ») : rien à remplir ici (JP, 20 nov. 2026).
  const absentHere = !guest && presence.confirmed && presence.status === "absent";
  // Le rapport est pour les coachs : l'assistant (ex. William) n'en écrit aucun, la section ne lui est pas montrée.
  const reportNeeded = REPORT_REQUIRED_TYPES.includes(activity.activity_type) && !activity.organization && !isBoysActivity(activity) && roster.length > 0 && isCoach && !absentHere;
  const ruleApplies = activityDay >= REPORT_RULE_START;
  // Règle du 19 nov. 2026 : sondage du jour de chaque fille et retour de l'éducateur (2 bons coups, 2 à améliorer) aussi.
  const strict = activityDay >= REPORT_RULE_V2_START;
  const surveyDone = participants.length > 0 && routineDone === participants.length;
  // Depuis le 26 nov. 2026 : chaque exercice prévu a sa réponse Oui / Non (pas exigé pour les pratiques d'avant).
  const plannedNeeded = reportNeeded && isPractice && plannedRequired(activityDay, planned.blocks.length);
  const reportChecks = reportNeeded
    ? [marked === roster.length, participants.length > 0 && evaluated === participants.length, ...(strict ? [surveyDone, ...(hasReportHour(coachRole) ? [debriefDone] : [])] : []), ...(plannedNeeded ? [planned.summary.complete] : [])]
    : [];
  const reportComplete = !reportNeeded || reportChecks.every(Boolean);
  // Depuis le 19 nov. 2026 : terrain payé dès la présence ; le coach gagne 1 h de rapport quand tout est fait.
  const hoursCount = presence.confirmed && (reportComplete || !ruleApplies || (strict && !isCoach));
  const afterDone = [presence.confirmed, ...reportChecks].filter(Boolean).length;
  const afterTotal = 1 + reportChecks.length;

  const openNext = (afterId: string) => {
    const order = participants.map((p) => p.registrationId);
    const next = order.slice(order.indexOf(afterId) + 1).concat(order).find((id) => id !== afterId && !isEvaluated(id));
    setOpenId(next ?? null);
  };

  const date = new Date(`${String(activity.activity_date).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const steps: { key: Step; label: string; detail: string }[] = [
    { key: "avant", label: "Avant", detail: activity.activity_type === "Match" || !read.hasContent || guest ? "La pratique" : read.confirmed ? "Pratique lue ✓" : `À lire ${read.seen}/${read.total}` },
    { key: "pendant", label: "Pendant", detail: roster.length ? `Présences ${marked}/${roster.length}` : "Présences" },
    { key: "apres", label: "Après", detail: `${isCoach ? "Rapport" : "Présence"} ${afterDone}/${afterTotal}` }
  ];

  /* ── Morceaux réutilisés par la vue par étapes et par la vue « tout-en-un » (même comportement) ── */

  // Le suivi de l'éducateur (JP, 19 nov. 2026) : chaque étape se coche dès qu'elle est faite.
  const suiviCard = isPractice && !guest ? (() => {
    const items: { label: string; done: boolean; step: Step }[] = [
      ...(read.hasContent ? [{ label: "Pratique lue et confirmée", done: read.confirmed, step: "avant" as Step }] : []),
      ...(reportNeeded ? [{ label: `Présences des joueuses · ${marked}/${roster.length}`, done: marked === roster.length, step: "pendant" as Step }] : []),
      ...(plannedNeeded ? [{ label: `Exercices prévus : faits ? · ${planned.summary.answered}/${planned.summary.total}`, done: planned.summary.complete, step: "apres" as Step }] : []),
      ...(reportNeeded ? [{ label: `Évaluation de chaque fille · ${evaluated}/${participants.length}`, done: participants.length > 0 && evaluated === participants.length, step: "apres" as Step }] : []),
      ...(reportNeeded ? [{ label: `Sondage du jour · ${routineDone}/${participants.length}`, done: surveyDone, step: "apres" as Step }] : []),
      ...(exerciseRating && exerciseRating.total > 0 ? [{ label: `Note des exercices (dans l'heure) · ${exerciseRating.rated}/${exerciseRating.total}`, done: exerciseRating.rated === exerciseRating.total, step: "apres" as Step }] : []),
      ...(reportNeeded && isCoach ? [{ label: "Mon retour : 2 bons coups, 2 à améliorer", done: debriefDone, step: "apres" as Step }] : []),
      { label: "Ma présence dans MonClubSportif", done: presence.confirmed, step: "apres" as Step }
    ];
    const done = items.filter((i) => i.done).length;
    return (
      <div className="coach-card" style={{ margin: "12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <p className="coach-card__label" style={{ margin: 0 }}>Mon suivi de la pratique</p>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: done === items.length ? "var(--adm-good)" : "var(--adm-text-2)" }}>{done}/{items.length} étapes</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} style={{ height: 8, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden", margin: "10px 0" }}>
          <div style={{ width: `${Math.max(3, (done / items.length) * 100)}%`, height: "100%", background: done === items.length ? "var(--adm-good)" : "var(--adm-accent-strong)" }} />
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {items.map((i) => (
            <li key={i.label}>
              <button type="button" onClick={() => goTo(i.step)} style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", background: "none", border: 0, padding: "4px 0", cursor: "pointer", textAlign: "left", font: "inherit", color: i.done ? "var(--adm-text-2)" : "var(--adm-text)" }}>
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: 999, display: "grid", placeItems: "center", flex: "0 0 auto", fontSize: "0.75rem", fontWeight: 700, background: i.done ? "var(--adm-good)" : "transparent", color: i.done ? "#fff" : "var(--adm-text-3)", border: i.done ? "none" : "1.5px solid var(--adm-border)" }}>{i.done ? "✓" : ""}</span>
                <span style={{ textDecoration: i.done ? "line-through" : "none" }}>{i.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  })() : null;

  const attendanceStep = (
    <AttendanceStep
      activityId={activity.id}
      roster={roster}
      attendance={attendance}
      onChange={(ids, status) => setAttendance((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, status])) }))}
    />
  );

  const deckCard = <CoachPracticeDeck decks={readItems.filter((i) => i.kind === "deck")} seen={readSeen} onOpened={markSeen} />;
  const practicePlan = <PracticeOfTheDay activity={activity} theme={theme} blocks={sessionBlocks} exercises={initialExercises} players={roster.length} seen={readSeen} onSeen={markSeen} />;
  const practiceTimer = isPractice ? <PracticeTimer activityId={activity.id} blocks={guideBlocks} /> : null;

  const presenceBlock = (
    <>
      {!guest && (
        <div style={{ marginBottom: 16 }}>
          <MyPresenceCard activity={activity} initial={presence} onChange={setPresence} />
        </div>
      )}
      {absentHere && (
        <div className="coach-card" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Tu n&apos;étais pas là pour ce groupe : rien à remplir ici.</p>
          <p className="coach-muted" style={{ margin: "6px 0 0" }}>Ton heure de rapport du jour dépend seulement des groupes où tu étais. Erreur ? Touche « Modifier ma présence ».</p>
        </div>
      )}
    </>
  );

  const helpedBlock = helped.length > 0 && (
    <div className="coach-card" style={{ marginBottom: 16 }}>
      <p className="coach-card__label">Les joueuses que j&apos;ai aidées et encouragées aujourd&apos;hui</p>
      <p style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 700, color: "var(--adm-text)", fontVariantNumeric: "tabular-nums" }}>
        {helped.length} fille{helped.length > 1 ? "s" : ""}
      </p>
      <p className="coach-muted" style={{ margin: "0 0 8px" }}>Elles l&apos;ont dit elles-mêmes sur la borne, à « Ta coach t&apos;a-t-elle aidée ou encouragée ? ».</p>
      <p style={{ margin: 0, color: "var(--adm-text)" }}>{helped.map((h) => h.name).join(" · ")}</p>
    </div>
  );

  const videosBlock = (label: string) =>
    videos.length > 0 && (
      <div className="coach-card" style={{ marginBottom: 16, display: "grid", gap: 10 }}>
        <p className="coach-card__label">{label}</p>
        {videos.map((v) => (
          <div key={v.id} style={{ display: "grid", gap: 6 }}>
            {videos.length > 1 ? <p className="coach-muted" style={{ margin: 0 }}>{v.title}</p> : null}
            <MatchPlayer id={v.id} endpoint={`/api/coach/videos/${v.id}`} label="Revoir la vidéo" />
          </div>
        ))}
      </div>
    );

  // Pas de vidéo Veo pour cette activité : on le dit clairement à l'éducateur qui veut évaluer (JP, 25 nov. 2026).
  const noVideoCard = (
    <div className="coach-card" style={{ marginBottom: 16 }}>
      <p className="coach-card__label">Vidéo non disponible</p>
      <p className="coach-sub" style={{ margin: 0 }}>
        La vidéo Veo de cette pratique n&apos;est pas encore importée. Évalue avec ce que tu as vu sur le terrain ; dès qu&apos;elle arrive (le site vérifie toutes les heures), elle s&apos;affiche ici.
      </p>
    </div>
  );

  const checklistBlock = (
    <div className="coach-card" style={{ marginBottom: 16 }}>
      <p className="coach-card__label">{strict && isCoach && reportNeeded ? "Ton rapport · 1 heure payée en plus par jour quand il est fini" : isCoach || guest || !strict ? "Ton rapport" : "Tes heures"}</p>
      <ul className="coach-checklist">
        {!guest && <li data-done={String(presence.confirmed)}>Ma présence (mets-toi « présent » dans MonClubSportif)</li>}
        {reportNeeded && <li data-done={String(marked === roster.length)}>Présences des joueuses · {marked}/{roster.length}</li>}
        {plannedNeeded && <li data-done={String(planned.summary.complete)}>Exercices prévus répondus (Oui ou Non) · {planned.summary.answered}/{planned.summary.total}</li>}
        {reportNeeded && (
          <li data-done={String(participants.length > 0 && evaluated === participants.length)}>
            Évaluation de chaque fille présente{strict ? ` : 3 notes${bmSkipped ? "" : ", chaque geste du ball mastery"}, observation de ${NOTE_MIN_WORDS} mots ou plus` : ""} · {evaluated}/{participants.length}
          </li>
        )}
        {reportNeeded && <li data-done={String(surveyDone)}>Sondage du jour de chaque fille · {routineDone}/{participants.length}</li>}
        {reportNeeded && strict && isCoach && <li data-done={String(debriefDone)}>Mon retour : 2 choses qui ont bien marché, 2 à améliorer</li>}
      </ul>
      <p className="coach-sub" style={{ marginTop: 12, color: hoursCount ? "var(--adm-good)" : undefined }}>
        {guest
          ? "Accès d'équipe : tu n'es pas assignée à cette pratique dans le site. Ta présence et tes heures arrivent de MonClubSportif."
          : !isCoach && strict
            ? "Tes heures de terrain sont payées dès ta présence dans MonClubSportif. Pas de rapport à remplir pour toi : il est fait par les coachs."
          : strict && reportNeeded
            ? isCoach
              ? presence.confirmed && reportComplete
                ? "Rapport fini. Ton heure de rapport du jour (1 h, une seule même avec deux pratiques) s'ajoute à ta paie quand les rapports de toutes tes pratiques du jour sont finis."
                : "Tes heures de terrain sont payées dès ta présence dans MonClubSportif. Ton heure de rapport du jour (1 h de plus, une seule même avec deux pratiques) s'ajoute toute seule quand chaque case est cochée pour chacune de tes pratiques du jour ; sinon, tu es payé pour tes heures de terrain seulement."
              : "Tes heures de terrain sont payées dès ta présence dans MonClubSportif. Pas de rapport à remplir pour toi : il est fait par les coachs."
          : hoursCount
          ? "Rapport complet : tes heures comptent pour la paie."
          : ruleApplies
            ? "Tes heures comptent pour la paie quand ta présence est confirmée et que les présences et les évaluations sont faites."
            : "Confirme ta présence pour que tes heures comptent."}
      </p>
    </div>
  );

  // « Exercices prévus : faits ? » au début du rapport (vue par étapes et tout-en-un).
  const plannedCard = reportNeeded && isPractice && planned.blocks.length > 0 ? (
    <PlannedExercisesCard
      activityId={activity.id}
      initial={planned}
      statusUrl={`/api/coach/activities/${activity.id}/exercices-prevus`}
      saveUrl={`/api/coach/activities/${activity.id}/exercices-prevus`}
      canAnswer={activityDay <= new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}
      required={plannedNeeded}
      onChange={setPlanned}
    />
  ) : null;

  const evaluationBlock = reportNeeded && participants.length > 0 && (
    <section style={{ marginBottom: 16 }}>
      <h2 className="coach-h2">Évaluation rapide · {evaluated}/{participants.length}</h2>
      <p className="coach-muted" style={{ margin: "-6px 0 12px" }}>
        Moins de 2 minutes par fille : 3 notes de 1 à 5{bmMoves.length ? ", chaque geste du ball mastery de 1 à 10" : ""}, et une phrase sur ce que tu as vu (écrite pendant la pratique ou en regardant la vidéo).
        {observed.size ? ` Tes ${observed.size} joueuses à observer sont en premier.` : ""}
      </p>
      {bmSkipped ? (
        <p className="coach-muted" style={{ margin: "0 0 12px" }}>Ball mastery pas fait ce jour-là (« Exercices prévus : faits ? ») : pas de gestes à noter.</p>
      ) : null}
      {[...participants].sort((a, b) => Number(!observed.has(a.registrationId)) - Number(!observed.has(b.registrationId))).map((p) => (
        <QuickEvaluation
          key={p.registrationId}
          activityId={activity.id}
          activityDate={String(activity.activity_date).slice(0, 10)}
          player={p}
          mine={mine[p.registrationId]}
          others={others[p.registrationId] ?? []}
          open={openId === p.registrationId}
          onToggle={() => setOpenId(openId === p.registrationId ? null : p.registrationId)}
          gestureChoices={bmMoves}
          bmSkipped={bmSkipped}
          skippedGestures={bmSkipped ? bmAllMoves : []}
          onSaved={(ev) => {
            setMine((prev) => ({ ...prev, [p.registrationId]: ev }));
            openNext(p.registrationId);
          }}
        />
      ))}
    </section>
  );

  const surveyBlock = reportNeeded && participants.length > 0 && (
    <div style={{ marginBottom: 16 }}>
      <h2 className="coach-h2">Sondage de fin · {routineDone}/{participants.length}</h2>
      <p className="coach-muted" style={{ margin: "-6px 0 12px" }}>Avant de partir, chaque fille dit si elle a aimé, sa fatigue et ce qu&apos;elle aimerait avoir plus. 3 touches par fille.</p>
      <PracticeSurvey
        activityId={activity.id}
        players={participants}
        initialPresence={attendance}
        initialAnswers={feedback}
        feedbackUrl="/api/coach/feedback"
        onAnswersChange={setFeedback}
      />
    </div>
  );

  const teamsAfterBlock = isPractice && participants.length > 1 && (
    <div style={{ marginBottom: 16 }}>
      <CoachTeamsCard
        title="Équipes du jour : couleurs et qui était avec qui"
        activityId={activity.id}
        players={participants}
        theme={themeForGroup(theme?.theme, activity.category ?? activity.title)}
      />
    </div>
  );

  const championsBlock = participants.length > 0 && (
    <div style={{ marginBottom: 16 }}>
      <CoachChampionsCard activityId={activity.id} players={participants} initial={initialChampions} rules={pointsRules} />
    </div>
  );

  const exerciseRatingsBlock = (
    <div style={{ marginBottom: 16 }}>
      <CoachExerciseRatings activityId={activity.id} onProgress={(rated, total) => setExerciseRating({ rated, total })} />
    </div>
  );

  const debriefCard = reportNeeded || (guest && isCoach) ? <CoachDebriefCard activityId={activity.id} onStatus={setDebriefDone} required={isCoach && strict} /> : null;

  const header = (
    <>
      <Link href="/entraineur/dashboard" className="coach-muted" style={{ textDecoration: "none", display: "inline-block", marginBottom: 12 }}>← Mes pratiques</Link>
      <p className="coach-eyebrow">
        {date} · {String(activity.start_time).slice(0, 5).replace(":", " h ")} à {String(activity.end_time).slice(0, 5).replace(":", " h ")}
      </p>
      <h1 className="coach-title coach-title--xl">{activity.title ? activity.title : activity.activity_type}</h1>
      {activity.location && <p className="coach-sub">{activity.location.split(/\s[–-]\s/)[0]}</p>}
      {otherCoaches.length > 0 && <p className="coach-muted" style={{ margin: "4px 0 0" }}>Avec {otherCoaches.map((c) => c.first_name).join(", ")}</p>}
    </>
  );

  // Vue « tout-en-un » (JP, 25 nov. 2026) : la pratique d'un côté, les filles à évaluer et le rapport de l'autre,
  // sur un seul écran. Mêmes composants, mêmes routes et mêmes règles que les trois étapes.
  if (allInOne) {
    const toMark = roster.length - marked;
    return (
      <>
        <CoachTopbar coachName={coachName} />
        <div className="admin-content">
          <div className="coach-page coach-page--full">
            <div className="coach-split__head">
              <div style={{ minWidth: 0 }}>{header}</div>
              <Link href={`/entraineur/activites/${activity.id}`} className="coach-secondary" style={{ textDecoration: "none" }}>Vue par étapes</Link>
            </div>

            {/* Téléphone et tablette : une colonne ; ces boutons sautent à la pratique, aux filles ou au rapport. */}
            <nav className="coach-steps coach-split__jump" aria-label="Aller à">
              {[
                { key: "avant" as Step, label: "La pratique", detail: `${sessionBlocks.length} bloc${sessionBlocks.length > 1 ? "s" : ""}` },
                { key: "pendant" as Step, label: "Les filles", detail: reportNeeded ? `Évaluées ${evaluated}/${participants.length}` : `Présences ${marked}/${roster.length}` },
                { key: "apres" as Step, label: isCoach ? "Mon rapport" : "Ma présence", detail: `${afterDone}/${afterTotal}` }
              ].map((s) => (
                <button key={s.key} type="button" data-active="false" onClick={() => goTo(s.key)}>
                  {s.label}
                  <small>{s.detail}</small>
                </button>
              ))}
            </nav>

            {/* Téléphone : la vidéo reste collée en haut de l'écran pendant qu'on évalue les filles en dessous. */}
            {videos.length > 0 ? <div className="coach-split__video-phone">{videosBlock("La pratique en vidéo")}</div> : null}

            <div className="coach-split">
              <section id="te-avant" className="coach-split__left coach-split__anchor" aria-label="La pratique">
                <h2 className="coach-h2">La pratique</h2>
                {/* La vidéo Veo d'abord (JP, 25 nov. 2026) : regarder la pratique en évaluant ; sinon, où elle apparaîtra. */}
                {videos.length > 0 ? (
                  <div className="coach-split__video-wide">{videosBlock("La pratique en vidéo")}</div>
                ) : null}
                {videos.length > 0 ? null : noVideoCard}
                {deckCard}
                {practicePlan}
                {practiceTimer}
              </section>

              <section className="coach-split__right" aria-label="Évaluer et faire mon rapport">
                {suiviCard}
                {plannedCard}

                <div id="te-pendant" className="coach-split__anchor">
                  <h2 className="coach-h2">Les filles du jour · {marked}/{roster.length} présences</h2>
                  <details className="coach-fold" open={toMark > 0} style={{ marginBottom: 16 }}>
                    <summary>
                      <span>
                        <strong>Présences</strong>
                        <small>{toMark > 0 ? `${toMark} à marquer avant d'évaluer` : "Chaque présence est marquée"}</small>
                      </span>
                      <span className="coach-pill" data-tone={toMark > 0 ? "warn" : "good"}>{toMark > 0 ? "À marquer" : "✓ Faites"}</span>
                    </summary>
                    <div style={{ marginTop: 12 }}>{attendanceStep}</div>
                  </details>
                  {evaluationBlock}
                  {reportNeeded && participants.length === 0 && roster.length > 0 ? (
                    <div className="coach-card" style={{ marginBottom: 16 }}>
                      <p style={{ margin: 0, color: "var(--adm-text)" }}>Marque les présences : les filles présentes apparaissent ici pour l&apos;évaluation.</p>
                    </div>
                  ) : null}
                </div>

                <div id="te-apres" className="coach-split__anchor">
                  <h2 className="coach-h2">{isCoach ? "Mon rapport" : "Ma présence et mes heures"}</h2>
                  {presenceBlock}
                  {checklistBlock}
                  {helpedBlock}
                  {surveyBlock}
                  {teamsAfterBlock}
                  {championsBlock}
                  {exerciseRatingsBlock}
                  {isPractice ? (
                    <div style={{ marginBottom: 16 }}>
                      {!guest && isCoach ? <CoachPracticeJournal activityId={activity.id} blocks={journalBlocks} /> : null}
                      {debriefCard}
                    </div>
                  ) : null}
                  <CoachIncidentCard activityId={activity.id} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide">
          {header}
          {isPractice ? (
            <p style={{ margin: "8px 0 0" }}>
              <Link href={`/entraineur/activites/${activity.id}?vue=tout-en-un`} className="coach-muted" style={{ color: "var(--adm-accent)", textDecoration: "none", fontWeight: 600 }}>
                Tout sur un écran : la pratique, l&apos;évaluation et le rapport →
              </Link>
            </p>
          ) : null}

          {suiviCard}
          {pickupCard}

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
              <div className="coach-avant">
                <div className="coach-avant__main">
                  {deckCard}
                  {activity.activity_type !== "Match" && sessionBlocks.length > 0 && (
                    <div className="coach-card" style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <p className="coach-card__label">La pratique sur papier</p>
                        <p className="coach-sub" style={{ margin: 0 }}>Imprime-la et garde-la sur toi : montage du terrain, variantes et progressions de chaque exercice.</p>
                      </div>
                      <Link href={`/entraineur/activites/${activity.id}/imprimer`} className="coach-primary" style={{ textDecoration: "none", width: "auto", padding: "0 20px", marginTop: 0, gap: 8 }}><Printer size={17} strokeWidth={1.75} aria-hidden /> Imprimer la pratique</Link>
                    </div>
                  )}
                  {practicePlan}
                  <div>
                    <button type="button" className="coach-secondary" onClick={() => setShowEditor(!showEditor)}>{showEditor ? "Fermer" : "Modifier le plan"}</button>
                    {showEditor && (
                      <div style={{ marginTop: 16 }}>
                        <SessionPlanEditor activityId={activity.id} initialBlocks={sessionBlocks} initialExercises={initialExercises} />
                      </div>
                    )}
                  </div>
                </div>
                <aside className="coach-avant__side">
                  {activity.activity_type !== "Match" && !guest && <PracticeReadCard items={readItems} seen={readSeen} readAt={readAt} onConfirm={confirmRead} />}
                  {activity.activity_type !== "Match" && <BriefingCard activity={activity} players={briefing} expected={roster.length} />}
                  {isPractice ? <CoachGuideCard activityId={activity.id} start={String(activity.start_time).slice(0, 5)} blocks={guideBlocks} /> : null}
                  {isPractice ? <PreviousDebriefCard activityId={activity.id} /> : null}
                  {activity.activity_type !== "Match" && musts.length > 0 && (
                    <details className="coach-card">
                      <summary className="coach-card__label" style={{ cursor: "pointer", marginBottom: 0 }}>Obligatoire dans chaque entraînement · {musts.length} point{musts.length > 1 ? "s" : ""}</summary>
                      <ol className="coach-musts" style={{ marginTop: 12 }}>
                        {musts.map((m, i) => (
                          <li key={i}>
                            <strong>{m.title}</strong>
                            {m.text ? <span>{m.text}</span> : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {(activity.notes || activity.video_url) && (
                    <div className="coach-card">
                      <p className="coach-card__label">Ressources</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {activity.notes && /^https?:\/\//.test(activity.notes) && <a href={activity.notes} target="_blank" rel="noreferrer" className="coach-secondary">Ouvrir le document ↗</a>}
                        {activity.video_url && <a href={activity.video_url} target="_blank" rel="noreferrer" className="coach-secondary">Ouvrir la vidéo ↗</a>}
                      </div>
                    </div>
                  )}
                  <EntityDocuments entityType="coach_activity" entityId={activity.id} apiBase="/api/coach/documents" readOnly hideCategory="Pratique" hideEmpty />
                  <button type="button" className="coach-primary" style={{ marginTop: 0 }} onClick={() => goTo("pendant")}>Commencer : les présences</button>
                </aside>
              </div>
            </>
          )}

          {step === "pendant" && (
            <div className="coach-aside-layout">
              {/* Ordinateur : le minuteur et la vidéo à droite, les présences et les équipes au centre. */}
              <aside className="coach-aside-layout__side">
                {practiceTimer}
                {activity.activity_type !== "Match" ? (videos.length > 0 ? videosBlock("La pratique en vidéo") : noVideoCard) : null}
              </aside>
              <div className="coach-aside-layout__main">
              {attendanceStep}
              {activity.activity_type === "Pratique" || activity.activity_type === "Camp" ? (
                <CoachTeamsCard
                  activityId={activity.id}
                  players={participants.length ? participants : roster}
                  theme={themeForGroup(theme?.theme, activity.category ?? activity.title)}
                />
              ) : null}
              {isPractice && !guest && isCoach ? <CoachPracticeJournal activityId={activity.id} blocks={journalBlocks} /> : null}
              {activity.activity_type !== "Match" && <CoachIncidentCard activityId={activity.id} />}
              <button type="button" className="coach-primary" style={{ marginTop: 12 }} onClick={() => goTo("apres")}>Fin de la pratique : le rapport</button>
              </div>
            </div>
          )}

          {step === "apres" && (
            <div className="coach-aside-layout">
              {/* Ordinateur : ma présence, la liste du rapport et la vidéo restent à droite pendant qu'on évalue au centre. */}
              <aside className="coach-aside-layout__side">
              {presenceBlock}
              {checklistBlock}
              {helpedBlock}
              {videosBlock(videos.length > 1 ? "Les vidéos de cette activité" : "La vidéo de cette activité")}
              </aside>
              <div className="coach-aside-layout__main">
              {plannedCard}

              {reportNeeded && marked < roster.length && (
                <div className="coach-card" style={{ marginBottom: 16 }}>
                  <p style={{ margin: 0, color: "var(--adm-text)" }}>Il reste {roster.length - marked} présence{roster.length - marked > 1 ? "s" : ""} à marquer.</p>
                  <button className="coach-secondary" style={{ marginTop: 12 }} onClick={() => goTo("pendant")}>Marquer les présences</button>
                </div>
              )}

              {evaluationBlock}
              {surveyBlock}
              {teamsAfterBlock}
              {championsBlock}
              {exerciseRatingsBlock}

              {activity.activity_type === "Pratique" || activity.activity_type === "Camp" ? (
                <div style={{ marginBottom: 16 }}>
                  {!guest && reportNeeded ? <CoachPracticeJournal activityId={activity.id} blocks={journalBlocks} /> : null}
                  {debriefCard}
                </div>
              ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
