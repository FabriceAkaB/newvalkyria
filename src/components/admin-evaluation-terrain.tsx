"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { computeVerdict, FICHE_SECTIONS, RATING_BAND_LABELS, RATING_VALUES, ratingBand, summarizeSections, VERDICT_COLORS, type CriterionScoreInput } from "@/lib/tryout-scoring";
import type {
  QuickComment,
  TryoutCriteriaConfig,
  TryoutEvaluation,
  TryoutEvaluator,
  TryoutEvent,
  TryoutParticipantWithPlayer,
  TryoutTeam
} from "@/lib/tryout-repo";

function birthYear(dob: string | null): string {
  return dob ? String(new Date(dob + "T00:00:00").getFullYear()) : "—";
}

function Avatar({ firstName, lastName, photoUrl, colorHex, size = 44 }: { firstName: string; lastName: string; photoUrl: string | null; colorHex?: string; size?: number }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colorHex ?? "#342b40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

type LocalScores = Record<string, CriterionScoreInput>;

function FicheField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#9d9da0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      {children}
    </label>
  );
}

function scoreButton(value: number, current: number | undefined, onClick: () => void, key: string) {
  const active = current === value;
  return (
    <button
      key={key}
      onClick={onClick}
      style={{
        minWidth: "44px",
        minHeight: "44px",
        borderRadius: "8px",
        border: active ? "2px solid #c4a4e4" : "1px solid #302e36",
        background: active ? "#342b40" : "#17151e",
        color: active ? "#fff" : "#9d9da0",
        fontWeight: active ? 700 : 500,
        fontSize: "0.85rem",
        cursor: "pointer"
      }}
    >
      {value}
    </button>
  );
}

export function AdminEvaluationTerrain({
  event,
  participants: initialParticipants,
  teams,
  evaluators,
  config,
  initialEvaluations,
  quickComments
}: {
  event: TryoutEvent;
  participants: TryoutParticipantWithPlayer[];
  teams: TryoutTeam[];
  evaluators: TryoutEvaluator[];
  config: TryoutCriteriaConfig;
  initialEvaluations: TryoutEvaluation[];
  quickComments: QuickComment[];
}) {
  const storageKey = `tryout_evaluator_${event.id}`;
  const [participants, setParticipants] = useState<TryoutParticipantWithPlayer[]>(initialParticipants);
  const [evaluatorId, setEvaluatorId] = useState<string>("");
  const [evaluations, setEvaluations] = useState<TryoutEvaluation[]>(initialEvaluations);
  const [teamFilters, setTeamFilters] = useState<string[]>([]);
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [gkOnly, setGkOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [localScores, setLocalScores] = useState<LocalScores>({});
  const [comment, setComment] = useState("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  // Copie synchrone des remarques : l'enregistrement au blur envoie toujours
  // toutes les sections à jour, même si deux champs sont quittés très vite.
  const remarksRef = useRef<Record<string, string>>({});
  const [evaluatedOn, setEvaluatedOn] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [sweetheart, setSweetheart] = useState(false);
  const [insufficientData, setInsufficientData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSyncedAgo, setLastSyncedAgo] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) setEvaluatorId(stored);
    else if (evaluators.length === 1) setEvaluatorId(evaluators[0].id);
  }, [storageKey, evaluators]);

  useEffect(() => {
    if (evaluatorId) window.localStorage.setItem(storageKey, evaluatorId);
  }, [evaluatorId, storageKey]);

  useEffect(() => {
    const interval = setInterval(() => setLastSyncedAgo((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const visibleParticipants = useMemo(
    () => participants.filter((p) => p.attendance_status !== "absent"),
    [participants]
  );

  const myEvalByParticipant = useMemo(() => {
    const map = new Map<string, TryoutEvaluation>();
    for (const ev of evaluations) {
      if (ev.evaluator_id === evaluatorId) map.set(ev.participant_id, ev);
    }
    return map;
  }, [evaluations, evaluatorId]);

  const anyCompletedByParticipant = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const ev of evaluations) {
      if (ev.completed_at) map.set(ev.participant_id, true);
    }
    return map;
  }, [evaluations]);

  const filtered = useMemo(() => {
    return visibleParticipants.filter((p) => {
      if (teamFilters.length > 0 && !teamFilters.includes(p.team_id ?? "")) return false;
      if (remainingOnly && myEvalByParticipant.get(p.id)?.completed_at) return false;
      if (gkOnly && p.primary_position_observed !== "GK") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = `${p.player_first_name} ${p.player_last_name}`.toLowerCase().includes(q);
        const matchesBib = p.bib_number != null && String(p.bib_number) === q;
        if (!matchesName && !matchesBib) return false;
      }
      return true;
    });
  }, [visibleParticipants, teamFilters, remainingOnly, gkOnly, search, myEvalByParticipant]);

  const selected = participants.find((p) => p.id === selectedId) ?? null;

  // Toutes les sauvegardes de la fiche passent dans une seule file : deux
  // envois rapprochés ne peuvent plus arriver dans le désordre et s'écraser.
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueueSave = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = saveQueue.current.then(task, task);
    saveQueue.current = run.catch(() => undefined);
    return run;
  };

  const myEvalRef = useRef(myEvalByParticipant);
  myEvalRef.current = myEvalByParticipant;
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  // Initialisation du formulaire seulement quand on change d'athlète ou
  // d'évaluateur — jamais à chaque sauvegarde, pour ne rien écraser pendant la saisie.
  useEffect(() => {
    if (!selectedId || !evaluatorId) {
      setLocalScores({});
      setComment("");
      setRemarks({});
      remarksRef.current = {};
      setEvaluatedOn("");
      setCommentInternal(false);
      return;
    }
    const existing = myEvalRef.current.get(selectedId);
    const part = participantsRef.current.find((p) => p.id === selectedId);
    setLocalScores(existing?.criteria_scores ?? {});
    setComment(existing?.comment ?? "");
    setRemarks(existing?.section_remarks ?? {});
    remarksRef.current = { ...(existing?.section_remarks ?? {}) };
    setEvaluatedOn(existing?.evaluated_on ?? new Date().toISOString().slice(0, 10));
    setCommentInternal(existing?.comment_internal ?? false);
    setSweetheart(part?.sweetheart ?? false);
    setInsufficientData(part?.insufficient_data ?? false);
  }, [selectedId, evaluatorId]);

  const verdict = useMemo(
    () => computeVerdict(config.criteria, config.thresholds, localScores),
    [config, localScores]
  );

  const sectionSummaries = useMemo(() => summarizeSections(config.criteria, localScores), [config, localScores]);

  const completedCriteriaCount = config.criteria.filter((c) => {
    const raw = localScores[c.id];
    if (!raw) return false;
    return "score" in raw ? raw.score > 0 : raw.isole > 0 && raw.match > 0;
  }).length;

  const persistScores = async (next: LocalScores) => {
    if (!selected || !evaluatorId) return;
    const participantId = selected.id;
    setSaving(true);
    setLastSyncedAgo(0);
    try {
      await enqueueSave(async () => {
        const res = await fetch(`/api/admin/evaluations/participants/${participantId}/evaluations/${evaluatorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ criteriaScores: next })
        });
        const data = await res.json();
        if (data.evaluation) {
          setEvaluations((prev) => {
            const others = prev.filter((e) => !(e.participant_id === participantId && e.evaluator_id === evaluatorId));
            return [...others, data.evaluation];
          });
        }
      });
    } finally {
      setSaving(false);
    }
  };

  const setScore = (criterionId: string, mode: "score" | "isole" | "match", value: number) => {
    // Fonctionnel plutôt que basé sur la fermeture (localScores) : deux taps
    // rapides sur des critères différents, avant qu'un re-rendu ne passe
    // entre les deux, ne doivent jamais faire perdre le premier tap.
    setLocalScores((prev) => {
      const next: LocalScores = { ...prev };
      if (config.doubleScoringEnabled) {
        const prevVal = (next[criterionId] as { isole: number; match: number }) ?? { isole: 0, match: 0 };
        next[criterionId] = mode === "isole" ? { isole: value, match: prevVal.match ?? 0 } : { isole: prevVal.isole ?? 0, match: value };
      } else {
        next[criterionId] = { score: value };
      }
      persistScores(next);
      return next;
    });
  };

  const saveCommentField = async (patch: { comment?: string; commentInternal?: boolean; sectionRemarks?: Record<string, string>; evaluatedOn?: string | null }) => {
    if (!selected || !evaluatorId) return;
    const participantId = selected.id;
    await enqueueSave(() =>
      fetch(`/api/admin/evaluations/participants/${participantId}/evaluations/${evaluatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      })
    );
  };

  /** Champs de l'en-tête de la fiche (poste, pied fort, club, niveau, contact…) :
   *  enregistrés sur la participation et reflétés tout de suite dans la liste locale. */
  const saveHeaderField = async (patch: Record<string, string | null>, local: Partial<TryoutParticipantWithPlayer>) => {
    if (!selected) return;
    setParticipants((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...local } : p)));
    await fetch(`/api/admin/evaluations/events/${event.id}/participants/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  };

  const saveParticipantFlags = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    await fetch(`/api/admin/evaluations/events/${event.id}/participants/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  };

  const completeEvaluation = async () => {
    if (!selected || !evaluatorId) return;
    if (completedCriteriaCount < config.criteria.length && !confirm(`Il reste ${config.criteria.length - completedCriteriaCount} critère(s) sans note sur la fiche. Terminer quand même ?`)) return;
    const participantId = selected.id;
    const data = await enqueueSave(async () => {
      const res = await fetch(`/api/admin/evaluations/participants/${participantId}/evaluations/${evaluatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, evaluatedOn: evaluatedOn || null })
      });
      return res.json();
    });
    if (data.evaluation) {
      setEvaluations((prev) => {
        const others = prev.filter((e) => !(e.participant_id === selected.id && e.evaluator_id === evaluatorId));
        return [...others, data.evaluation];
      });
    }
    goToNext();
  };

  const goToNext = () => {
    if (!selected) return;
    const idx = filtered.findIndex((p) => p.id === selected.id);
    const next = filtered[idx + 1];
    setSelectedId(next ? next.id : null);
  };

  const goToPrev = () => {
    if (!selected) return;
    const idx = filtered.findIndex((p) => p.id === selected.id);
    const prev = filtered[idx - 1];
    if (prev) setSelectedId(prev.id);
  };

  const totalCompleted = visibleParticipants.filter((p) => anyCompletedByParticipant.get(p.id)).length;
  const progressPct = visibleParticipants.length > 0 ? Math.round((totalCompleted / visibleParticipants.length) * 100) : 0;

  const currentEvaluator = evaluators.find((e) => e.id === evaluatorId);

  if (!evaluatorId) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0a10", padding: "1.5rem" }}>
        <Link href={`/admin/evaluations/${event.id}`} style={{ color: "#9d9da0", fontSize: "0.78rem", textDecoration: "none" }}>← Retour</Link>
        <p style={{ fontSize: "1rem", color: "#fff", fontWeight: 700, margin: "1rem 0" }}>Qui évalue sur cet appareil ?</p>
        {evaluators.length === 0 && (
          <p style={{ fontSize: "0.85rem", color: "#9d9da0" }}>
            Aucun évaluateur assigné à cet événement. Ajoute-en un depuis la page{" "}
            <Link href={`/admin/evaluations/${event.id}`} style={{ color: "#c4a4e4" }}>gérer l&apos;événement</Link>.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "320px" }}>
          {evaluators.map((e) => (
            <button
              key={e.id}
              onClick={() => setEvaluatorId(e.id)}
              className="admin-btn-ghost"
              style={{ fontSize: "0.9rem", padding: "0.8rem", textAlign: "left" }}
            >
              {e.guest_name ?? `${e.coach_first_name ?? ""} ${e.coach_last_name ?? ""}`.trim()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0a10", paddingBottom: "3rem" }}>
      {/* ── Bandeau supérieur ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0b0a10", borderBottom: "1px solid #1f1d25", padding: "0.6rem 0.9rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
          <Link href={`/admin/evaluations/${event.id}`} style={{ color: "#9d9da0", fontSize: "0.72rem", textDecoration: "none" }}>← {event.name}</Link>
          <span style={{ fontSize: "0.68rem", color: "#6d6b71" }}>
            {saving ? "Sauvegarde..." : `Synchronisé il y a ${lastSyncedAgo}s`} · {currentEvaluator?.guest_name ?? currentEvaluator?.coach_first_name}
            <button onClick={() => setEvaluatorId("")} style={{ marginLeft: "0.5rem", background: "none", border: "none", color: "#c4a4e4", fontSize: "0.68rem", cursor: "pointer" }}>changer</button>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ flex: 1, height: "6px", background: "#1f1d25", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#8fce9f" }} />
          </div>
          <span style={{ fontSize: "0.7rem", color: "#9d9da0", flexShrink: 0 }}>{totalCompleted} / {visibleParticipants.length} évaluées</span>
        </div>
      </div>

      {!selected ? (
        <div style={{ padding: "0.9rem" }}>
          {/* ── Filtres ── */}
          <input className="admin-input" placeholder="Rechercher par nom ou numéro..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: "0.6rem" }} />
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            {teams.map((t) => {
              const active = teamFilters.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTeamFilters((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                  style={{
                    minHeight: "36px",
                    padding: "0.3rem 0.7rem",
                    borderRadius: "999px",
                    border: active ? `2px solid ${t.color_hex}` : "1px solid #302e36",
                    background: active ? t.color_hex + "33" : "#17151e",
                    color: "#fff",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.color_hex, display: "inline-block" }} />
                  {t.name}
                </button>
              );
            })}
            <button
              onClick={() => setRemainingOnly((v) => !v)}
              className={remainingOnly ? "admin-btn-primary" : "admin-btn-ghost"}
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", minHeight: "36px" }}
            >
              Il me reste seulement
            </button>
            <button
              onClick={() => setGkOnly((v) => !v)}
              className={gkOnly ? "admin-btn-primary" : "admin-btn-ghost"}
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", minHeight: "36px" }}
            >
              🧤 Gardiennes seulement
            </button>
            {(teamFilters.length > 0 || remainingOnly || gkOnly || search) && (
              <button onClick={() => { setTeamFilters([]); setRemainingOnly(false); setGkOnly(false); setSearch(""); }} className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", minHeight: "36px" }}>
                Réinitialiser ✕
              </button>
            )}
          </div>

          {/* ── Grille des athlètes ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.6rem" }}>
            {filtered.map((p) => {
              const myEval = myEvalByParticipant.get(p.id);
              const team = teams.find((t) => t.id === p.team_id);
              const scoredCount = myEval ? Object.keys(myEval.criteria_scores ?? {}).length : 0;
              const isDone = Boolean(myEval?.completed_at);
              const isStarted = scoredCount > 0 && !isDone;
              const borderColor = isDone ? "#8fce9f" : isStarted ? "#f0c878" : "#302e36";
              const isNew = p.attendance_status === "en_retard";
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    background: "#100e17",
                    border: `2px solid ${borderColor}`,
                    borderRadius: "10px",
                    padding: "0.7rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.4rem",
                    cursor: "pointer",
                    position: "relative",
                    minHeight: "48px"
                  }}
                >
                  {isNew && <span style={{ position: "absolute", top: "4px", right: "4px", fontSize: "0.6rem", background: "#78a8f0", color: "#0b0a10", borderRadius: "4px", padding: "0.1rem 0.3rem" }}>Nouveau</span>}
                  {p.primary_position_observed === "GK" && (
                    <span style={{ position: "absolute", top: "4px", left: "4px", fontSize: "0.6rem", background: "#f0c878", color: "#0b0a10", borderRadius: "4px", padding: "0.1rem 0.3rem", fontWeight: 700 }}>🧤 GK</span>
                  )}
                  <Avatar firstName={p.player_first_name} lastName={p.player_last_name} photoUrl={p.player_photo_url} colorHex={team?.color_hex} size={48} />
                  <p style={{ fontSize: "0.78rem", color: "#fff", margin: 0, textAlign: "center" }}>{p.player_first_name} {p.player_last_name}</p>
                  <p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>#{p.bib_number ?? "—"} {isDone ? "✓" : isStarted ? `${scoredCount}/${config.criteria.length}` : ""}</p>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <p className="admin-empty-text">Aucune athlète ne correspond aux filtres.</p>}
        </div>
      ) : (
        <div style={{ padding: "0.9rem" }}>
          <button onClick={() => setSelectedId(null)} className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", marginBottom: "0.7rem" }}>← Liste des athlètes</button>

          {/* ── En-tête permanent ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.8rem", marginBottom: "0.8rem" }}>
            <Avatar firstName={selected.player_first_name} lastName={selected.player_last_name} photoUrl={selected.player_photo_url} colorHex={teams.find((t) => t.id === selected.team_id)?.color_hex} size={72} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", margin: 0 }}>{selected.player_first_name} {selected.player_last_name}</p>
              <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0.2rem 0 0" }}>{birthYear(selected.player_dob)}{selected.primary_position_observed ? ` · ${selected.primary_position_observed}` : ""}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.3rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "#c4a4e4" }}>#{selected.bib_number ?? "—"}</span>
                {teams.find((t) => t.id === selected.team_id) && (
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: teams.find((t) => t.id === selected.team_id)!.color_hex, display: "inline-block" }} />
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", margin: 0 }}>{verdict.total.toFixed(1)}<span style={{ fontSize: "0.8rem", color: "#6d6b71" }}>/{config.criteria.length * 5}</span></p>
              {completedCriteriaCount >= config.criteria.length ? (
                <p style={{ fontSize: "0.68rem", color: VERDICT_COLORS[verdict.verdict] ?? "#9d9da0", margin: 0, fontWeight: 700 }}>{verdict.verdictLabel}</p>
              ) : (
                <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: 0 }}>Fiche incomplète</p>
              )}
            </div>
          </div>

          {completedCriteriaCount >= config.criteria.length && verdict.maturationAlert && (
            <div style={{ background: "rgba(240,200,120,0.1)", border: "1px solid rgba(240,200,120,0.3)", borderRadius: "8px", padding: "0.6rem 0.8rem", marginBottom: "0.8rem" }}>
              <p style={{ fontSize: "0.75rem", color: "#f0c878", margin: 0 }}>
                ⚠ Profil physiquement dominant, techniquement en retard — vérifier l&apos;âge relatif et la maturation avant de conclure.
              </p>
            </div>
          )}

          <p style={{ fontSize: "0.72rem", color: "#9d9da0", marginBottom: "0.8rem" }}>{completedCriteriaCount} / {config.criteria.length} critères remplis</p>

          {/* ── FICHE D'ÉVALUATION DE L'ATHLÈTE — en-tête ── */}
          <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.9rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#c4a4e4", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.7rem" }}>Fiche d&apos;évaluation de l&apos;athlète</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.6rem" }}>
              <FicheField label="Nom complet"><input className="admin-input" readOnly value={`${selected.player_first_name} ${selected.player_last_name}`.trim()} style={{ width: "100%", opacity: 0.8 }} /></FicheField>
              <FicheField label="Position jouée"><input className="admin-input" key={`pj-${selected.id}`} defaultValue={selected.primary_position_observed ?? ""} onBlur={(e) => saveHeaderField({ primaryPositionObserved: e.target.value.trim() || null }, { primary_position_observed: e.target.value.trim() || null })} placeholder="ex. Milieu" style={{ width: "100%" }} /></FicheField>
              <FicheField label="Position préférée"><input className="admin-input" key={`pp-${selected.id}`} defaultValue={selected.preferred_position ?? ""} onBlur={(e) => saveHeaderField({ preferredPosition: e.target.value.trim() || null }, { preferred_position: e.target.value.trim() || null })} placeholder="ex. Attaquante" style={{ width: "100%" }} /></FicheField>
              <FicheField label="Pied fort">
                <select className="admin-group-select" key={`pf-${selected.id}`} defaultValue={selected.strong_foot ?? ""} onChange={(e) => saveHeaderField({ strongFoot: e.target.value || null }, { strong_foot: e.target.value || null })} style={{ width: "100%" }}>
                  <option value="">—</option>
                  <option value="Droit">Droit</option>
                  <option value="Gauche">Gauche</option>
                  <option value="Les deux">Les deux</option>
                </select>
              </FicheField>
              <FicheField label="Groupe"><input className="admin-input" key={`gr-${selected.id}`} defaultValue={selected.group_label ?? event.age_category ?? (selected.player_dob ? birthYear(selected.player_dob) : "")} onBlur={(e) => saveHeaderField({ groupLabel: e.target.value.trim() || null }, { group_label: e.target.value.trim() || null })} style={{ width: "100%" }} /></FicheField>
              <FicheField label="Date de naissance"><input className="admin-input" readOnly value={selected.player_dob ? new Date(selected.player_dob + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "—"} style={{ width: "100%", opacity: 0.8 }} /></FicheField>
              <FicheField label="Courriel"><input className="admin-input" type="email" key={`em-${selected.id}`} defaultValue={selected.contact_email ?? ""} onBlur={(e) => saveHeaderField({ parentEmail: e.target.value.trim() || null }, { parent_email: e.target.value.trim() || null, contact_email: e.target.value.trim() || null })} style={{ width: "100%" }} /></FicheField>
              <FicheField label="Téléphone"><input className="admin-input" type="tel" key={`ph-${selected.id}`} defaultValue={selected.contact_phone ?? ""} onBlur={(e) => saveHeaderField({ parentPhone: e.target.value.trim() || null }, { parent_phone: e.target.value.trim() || null, contact_phone: e.target.value.trim() || null })} style={{ width: "100%" }} /></FicheField>
              <FicheField label="Club actuel"><input className="admin-input" key={`cl-${selected.id}`} defaultValue={selected.current_club ?? ""} onBlur={(e) => saveHeaderField({ currentClub: e.target.value.trim() || null }, { current_club: e.target.value.trim() || null })} style={{ width: "100%" }} /></FicheField>
              <FicheField label="Niveau actuel">
                <input className="admin-input" list="fiche-niveaux" key={`nv-${selected.id}`} defaultValue={selected.current_level ?? ""} onBlur={(e) => saveHeaderField({ currentLevel: e.target.value.trim() || null }, { current_level: e.target.value.trim() || null })} placeholder="ex. D1, Débutante…" style={{ width: "100%" }} />
                <datalist id="fiche-niveaux">
                  {["Débutante", "D3", "D2", "D1", "Intermédiaire", "Élite"].map((n) => <option key={n} value={n} />)}
                </datalist>
              </FicheField>
            </div>
          </div>

          {/* ── Sections notées (5 → 1) + remarques de section ── */}
          {FICHE_SECTIONS.map(({ block, title }) => {
            const summary = sectionSummaries.find((x) => x.block === block);
            return (
              <div key={block} style={{ marginBottom: "1.1rem", background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c4a4e4", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{title}</p>
                  <span style={{ fontSize: "0.68rem", color: "#9d9da0" }}>
                    {summary?.rated ?? 0}/{summary?.total ?? 0}
                    {summary?.average != null && <> · moy. {summary.average.toFixed(1)}/5 · <strong style={{ color: summary.band === "B" ? "#8fce9f" : summary.band === "M" ? "#f0c878" : "#e6394a" }}>{summary.band} ({RATING_BAND_LABELS[summary.band!]})</strong></>}
                  </span>
                </div>
                {!config.doubleScoringEnabled && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 44px)", gap: "0.3rem", alignItems: "end", marginBottom: "0.2rem" }}>
                    <span />
                    {RATING_VALUES.map((v) => (
                      <span key={v} style={{ textAlign: "center", fontSize: "0.65rem", fontWeight: 700, color: "#6d6b71" }}>{ratingBand(v)}</span>
                    ))}
                  </div>
                )}
                {config.criteria.filter((c) => c.block === block).map((c) => {
                  const raw = localScores[c.id];
                  return config.doubleScoringEnabled ? (
                    <div key={c.id} style={{ marginBottom: "0.8rem" }}>
                      <p style={{ fontSize: "0.8rem", color: "#fff", margin: "0 0 0.3rem" }}>{c.label}</p>
                      <p style={{ fontSize: "0.65rem", color: "#6d6b71", margin: "0 0 0.2rem" }}>Isolé</p>
                      <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.4rem" }}>
                        {RATING_VALUES.map((v) => scoreButton(v, raw && "isole" in raw ? raw.isole : undefined, () => setScore(c.id, "isole", v), `${c.id}-isole-${v}`))}
                      </div>
                      <p style={{ fontSize: "0.65rem", color: "#6d6b71", margin: "0 0 0.2rem" }}>Match</p>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        {RATING_VALUES.map((v) => scoreButton(v, raw && "match" in raw ? raw.match : undefined, () => setScore(c.id, "match", v), `${c.id}-match-${v}`))}
                      </div>
                    </div>
                  ) : (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 44px)", gap: "0.3rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#fff", paddingRight: "0.3rem" }}>{c.label}</span>
                      {RATING_VALUES.map((v) => scoreButton(v, raw && "score" in raw ? raw.score : undefined, () => setScore(c.id, "score", v), `${c.id}-${v}`))}
                    </div>
                  );
                })}
                <p style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9d9da0", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0.7rem 0 0.3rem" }}>Remarques — {title}</p>
                <textarea
                  className="admin-input"
                  value={remarks[block] ?? ""}
                  onChange={(e) => {
                    remarksRef.current = { ...remarksRef.current, [block]: e.target.value };
                    setRemarks(remarksRef.current);
                  }}
                  onBlur={() => saveCommentField({ sectionRemarks: remarksRef.current })}
                  rows={2}
                  style={{ width: "100%", resize: "vertical" }}
                  placeholder={`Remarques sur la section ${title.toLowerCase()}…`}
                />
              </div>
            );
          })}

          {/* ── ÉVALUATION : commentaires généraux, évaluateur, date ── */}
          <div style={{ marginBottom: "1rem", background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "0.8rem" }}>
            <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c4a4e4", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" }}>Évaluation — commentaires généraux</p>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              {quickComments.map((qc) => (
                <button
                  key={qc.id}
                  onClick={() => { const next = comment ? `${comment} ${qc.text}` : qc.text; setComment(next); saveCommentField({ comment: next }); }}
                  className="admin-btn-ghost"
                  style={{ fontSize: "0.68rem", padding: "0.3rem 0.6rem", minHeight: "36px" }}
                >
                  {qc.text}
                </button>
              ))}
            </div>
            <textarea
              className="admin-input"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => saveCommentField({ comment })}
              rows={5}
              style={{ width: "100%", resize: "vertical" }}
              placeholder="Commentaires généraux…"
            />
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.75rem", color: "#9d9da0" }}>
              <input type="checkbox" checked={commentInternal} onChange={(e) => { setCommentInternal(e.target.checked); saveCommentField({ commentInternal: e.target.checked }); }} />
              Commentaire interne — ne pas partager avec le parent
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.6rem", marginTop: "0.8rem" }}>
              <FicheField label="Évaluateur"><input className="admin-input" readOnly value={currentEvaluator?.guest_name ?? `${currentEvaluator?.coach_first_name ?? ""} ${currentEvaluator?.coach_last_name ?? ""}`.trim()} style={{ width: "100%", opacity: 0.8 }} /></FicheField>
              <FicheField label="Date"><input className="admin-input" type="date" value={evaluatedOn} onChange={(e) => { setEvaluatedOn(e.target.value); saveCommentField({ evaluatedOn: e.target.value || null }); }} style={{ width: "100%" }} /></FicheField>
            </div>
            {selected && evaluatorId && (
              <p style={{ margin: "0.6rem 0 0", fontSize: "0.7rem" }}>
                <a href={`/admin/evaluations/${event.id}/fiche/${selected.id}`} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4" }}>Voir / imprimer la fiche →</a>
              </p>
            )}
          </div>

          {/* ── Champs additionnels ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#fff" }}>
              <input type="checkbox" checked={sweetheart} onChange={(e) => { setSweetheart(e.target.checked); saveParticipantFlags({ sweetheart: e.target.checked }); }} />
              ⭐ Coup de cœur
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#fff" }}>
              <input type="checkbox" checked={insufficientData} onChange={(e) => { setInsufficientData(e.target.checked); saveParticipantFlags({ insufficientData: e.target.checked }); }} />
              Données insuffisantes
            </label>
          </div>

          {/* ── Navigation ── */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={goToPrev} className="admin-btn-ghost" style={{ flex: 1, minHeight: "48px", fontSize: "0.85rem" }}>← Précédent</button>
            <button onClick={completeEvaluation} className="admin-btn-primary" style={{ flex: 2, minHeight: "48px", fontSize: "0.85rem" }}>
              Terminer cette évaluation
            </button>
            <button onClick={goToNext} className="admin-btn-ghost" style={{ flex: 1, minHeight: "48px", fontSize: "0.85rem" }}>Suivant →</button>
          </div>
        </div>
      )}
    </div>
  );
}
