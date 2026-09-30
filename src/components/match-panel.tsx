"use client";

import { useRef, useState } from "react";

import { Avatar } from "@/components/admin-avatar";
import type {
  ConvocationStatus,
  MatchConvocation,
  MatchDetails,
  MatchLineupSlot,
  MatchPlayerEvaluation,
  MatchRosterPlayer,
  MatchStatus,
  PlaytimeSegment
} from "@/lib/match-repo";
import { MATCH_POSITIONS, computeTotalMinutes } from "@/lib/match-repo";

const POSITION_LABELS: Record<string, string> = {
  GB: "Gardienne",
  AD: "Arrière droit",
  DC: "Défenseure centrale",
  AG: "Arrière gauche",
  MDC: "Milieu défensif",
  MC: "Milieu centrale",
  MOC: "Milieu offensif",
  AiD: "Ailière droite",
  AiG: "Ailière gauche",
  AT: "Attaquante"
};

const CONVOCATION_LABELS: Record<ConvocationStatus, string> = {
  convoked: "Convoquée",
  confirmed: "Confirmée",
  declined: "Déclinée",
  absent: "Absente"
};

const STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: "À venir",
  live: "En cours",
  completed: "Terminé",
  cancelled: "Annulé"
};

interface Props {
  activityId: string;
  roster: MatchRosterPlayer[];
  initialDetails: MatchDetails | null;
  initialConvocations: MatchConvocation[];
  initialLineup: MatchLineupSlot[];
  initialPlaytime: PlaytimeSegment[];
  initialEvaluations: MatchPlayerEvaluation[];
  role: "admin" | "coach";
  coachId?: string;
}

function apiBase(activityId: string, role: "admin" | "coach") {
  return role === "admin" ? `/api/admin/coach-activities/${activityId}/match` : `/api/coach/activities/${activityId}/match`;
}

function playerName(roster: MatchRosterPlayer[], registrationId: string) {
  const p = roster.find((r) => r.registrationId === registrationId);
  return p ? `${p.firstName} ${p.lastName}` : "Joueuse";
}

function MatchDetailsForm({ activityId, initial, role }: { activityId: string; initial: MatchDetails | null; role: "admin" | "coach" }) {
  const [opponentName, setOpponentName] = useState(initial?.opponent_name ?? "");
  const [homeAway, setHomeAway] = useState<"home" | "away">(initial?.home_away ?? "home");
  const [formation, setFormation] = useState(initial?.formation ?? "");
  const [status, setStatus] = useState<MatchStatus>(initial?.status ?? "scheduled");
  const [scoreUs, setScoreUs] = useState(initial?.final_score_us?.toString() ?? "");
  const [scoreThem, setScoreThem] = useState(initial?.final_score_them?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(apiBase(activityId, role), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Match</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input className="admin-input" placeholder="Adversaire *" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} style={{ flex: "1 1 160px" }} />
        <select className="admin-input" value={homeAway} onChange={(e) => setHomeAway(e.target.value as "home" | "away")} style={{ width: "auto" }}>
          <option value="home">Domicile</option>
          <option value="away">Extérieur</option>
        </select>
        <input className="admin-input" placeholder="Formation (ex. 4-3-3)" value={formation} onChange={(e) => setFormation(e.target.value)} style={{ width: "10rem" }} />
        <button
          className="admin-btn-primary"
          disabled={saving || !opponentName.trim()}
          onClick={() => patch({ opponentName, homeAway, formation: formation.trim() || null })}
          style={{ fontSize: "0.75rem" }}
        >
          {saving ? "..." : "Enregistrer"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <select className="admin-input" value={status} onChange={(e) => { const s = e.target.value as MatchStatus; setStatus(s); patch({ status: s }); }} style={{ width: "auto" }}>
          {(Object.keys(STATUS_LABELS) as MatchStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {(status === "live" || status === "completed") && (
          <>
            <input className="admin-input" type="number" min={0} placeholder="Nous" value={scoreUs} onChange={(e) => setScoreUs(e.target.value)} style={{ width: "5rem" }} />
            <span style={{ color: "#6d6b71" }}>—</span>
            <input className="admin-input" type="number" min={0} placeholder="Eux" value={scoreThem} onChange={(e) => setScoreThem(e.target.value)} style={{ width: "5rem" }} />
            <button
              className="admin-btn-ghost"
              onClick={() => patch({ finalScoreUs: scoreUs === "" ? null : parseInt(scoreUs, 10), finalScoreThem: scoreThem === "" ? null : parseInt(scoreThem, 10) })}
              style={{ fontSize: "0.72rem" }}
            >
              Enregistrer le score
            </button>
          </>
        )}
        {saved && <span style={{ fontSize: "0.72rem", color: "#7fd88f" }}>✓ Enregistré</span>}
      </div>
    </div>
  );
}

function LineupBoard({ activityId, roster, convocations, initial, role }: { activityId: string; roster: MatchRosterPlayer[]; convocations: Record<string, ConvocationStatus | undefined>; initial: MatchLineupSlot[]; role: "admin" | "coach" }) {
  const [slots, setSlots] = useState<MatchLineupSlot[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const convokedIds = Object.entries(convocations).filter(([, s]) => s === "convoked" || s === "confirmed").map(([id]) => id);
  const onPitchIds = new Set(slots.filter((s) => s.x !== null).map((s) => s.registration_id));
  const bench = convokedIds.filter((id) => !onPitchIds.has(id));

  const base = apiBase(activityId, role);

  const placeOnPitch = async (registrationId: string) => {
    const x = 50, y = 50;
    setSlots((prev) => [...prev.filter((s) => s.registration_id !== registrationId), { id: registrationId, activity_id: activityId, registration_id: registrationId, position_code: null, x, y, is_starter: true }]);
    await fetch(`${base}/lineup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, x, y, isStarter: true }) });
  };

  const removeFromPitch = async (registrationId: string) => {
    setSlots((prev) => prev.filter((s) => s.registration_id !== registrationId));
    await fetch(`${base}/lineup?registrationId=${registrationId}`, { method: "DELETE" });
  };

  const setPosition = async (registrationId: string, positionCode: string) => {
    setSlots((prev) => prev.map((s) => (s.registration_id === registrationId ? { ...s, position_code: positionCode } : s)));
    await fetch(`${base}/lineup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, positionCode }) });
  };

  const toPercent = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const { x, y } = toPercent(e.clientX, e.clientY);
    setSlots((prev) => prev.map((s) => (s.registration_id === dragId ? { ...s, x, y } : s)));
  };

  const handleUp = async () => {
    if (!dragId) return;
    const slot = slots.find((s) => s.registration_id === dragId);
    setDragId(null);
    if (slot) await fetch(`${base}/lineup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId: slot.registration_id, x: slot.x, y: slot.y }) });
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Alignement</p>

      <div
        ref={boardRef}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        style={{ position: "relative", width: "100%", maxWidth: "360px", paddingBottom: "130%", background: "linear-gradient(180deg, #1f5c3a, #184a2f)", borderRadius: "10px", border: "1px solid #2a7a4c", touchAction: "none" }}
      >
        <div style={{ position: "absolute", left: "4%", right: "4%", top: "50%", height: "1px", background: "rgba(230,221,239,0.35)" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "22%", paddingBottom: "22%", border: "1px solid rgba(230,221,239,0.35)", borderRadius: "50%", transform: "translate(-50%,-50%)" }} />

        {slots.filter((s) => s.x !== null).map((s) => (
          <div
            key={s.registration_id}
            onPointerDown={(e) => { e.stopPropagation(); setDragId(s.registration_id); }}
            style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", cursor: "grab", gap: "2px" }}
          >
            <Avatar firstName={roster.find((r) => r.registrationId === s.registration_id)?.firstName} lastName={roster.find((r) => r.registrationId === s.registration_id)?.lastName} photoUrl={roster.find((r) => r.registrationId === s.registration_id)?.photoUrl} size={30} />
            <select
              className="admin-input"
              value={s.position_code ?? ""}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => setPosition(s.registration_id, e.target.value)}
              style={{ fontSize: "0.6rem", padding: "0.1rem 0.2rem", width: "4.2rem" }}
            >
              <option value="">Poste</option>
              {MATCH_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        ))}
      </div>

      <p className="admin-drawer-label" style={{ marginTop: "0.8rem", marginBottom: "0.4rem" }}>Banc ({bench.length})</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {bench.map((id) => (
          <button key={id} onClick={() => placeOnPitch(id)} className="admin-btn-ghost" style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}>
            <Avatar firstName={roster.find((r) => r.registrationId === id)?.firstName} lastName={roster.find((r) => r.registrationId === id)?.lastName} photoUrl={roster.find((r) => r.registrationId === id)?.photoUrl} size={20} />
            {playerName(roster, id)}
          </button>
        ))}
        {bench.length === 0 && convokedIds.length === 0 && <p className="admin-empty-text">Convoquez des joueuses pour construire l&apos;alignement.</p>}
      </div>
      {slots.filter((s) => s.x !== null).length > 0 && (
        <p style={{ fontSize: "0.68rem", color: "#6d6b71", marginTop: "0.5rem" }}>
          Glissez une joueuse sur le terrain pour la repositionner.{" "}
          {slots.filter((s) => s.x !== null).map((s) => (
            <button key={s.id} onClick={() => removeFromPitch(s.registration_id)} className="admin-btn-ghost" style={{ fontSize: "0.6rem", padding: "0.1rem 0.4rem", marginRight: "0.3rem" }}>
              Retirer {playerName(roster, s.registration_id)}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}

function LiveTimer({ activityId, roster, convocations, lineup, initial, role }: { activityId: string; roster: MatchRosterPlayer[]; convocations: Record<string, ConvocationStatus | undefined>; lineup: MatchLineupSlot[]; initial: PlaytimeSegment[]; role: "admin" | "coach" }) {
  const [minute, setMinute] = useState(0);
  const [segments, setSegments] = useState<PlaytimeSegment[]>(initial);
  const base = apiBase(activityId, role);

  const convokedIds = Object.entries(convocations).filter(([, s]) => s === "convoked" || s === "confirmed").map(([id]) => id);
  const isOnField = (id: string) => segments.some((s) => s.registration_id === id && s.minute_out === null);

  const substitute = async (registrationId: string, action: "in" | "out") => {
    const res = await fetch(`${base}/playtime`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, registrationId, minute }) });
    if (!res.ok) return;
    if (action === "in") setSegments((prev) => [...prev, { id: `local-${Date.now()}`, activity_id: activityId, registration_id: registrationId, minute_in: minute, minute_out: null }]);
    else setSegments((prev) => prev.map((s) => (s.registration_id === registrationId && s.minute_out === null ? { ...s, minute_out: minute } : s)));
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Temps de jeu</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
        <button className="admin-btn-ghost" onClick={() => setMinute((m) => Math.max(0, m - 1))} style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}>−1</button>
        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", minWidth: "3.5rem", textAlign: "center" }}>{minute}&apos;</span>
        <button className="admin-btn-primary" onClick={() => setMinute((m) => m + 1)} style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}>+1 min</button>
        <input className="admin-input" type="number" min={0} value={minute} onChange={(e) => setMinute(parseInt(e.target.value, 10) || 0)} style={{ width: "5rem", fontSize: "0.75rem" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {convokedIds.map((id) => {
          const total = computeTotalMinutes(segments, id, minute);
          const onField = isOnField(id);
          const player = roster.find((r) => r.registrationId === id);
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.4rem 0.7rem" }}>
              <Avatar firstName={player?.firstName} lastName={player?.lastName} photoUrl={player?.photoUrl} size={24} />
              <span style={{ fontSize: "0.78rem", color: "#c3c2c8", flex: 1 }}>
                {playerName(roster, id)} {onField && <span style={{ color: "#7fd88f" }}>· sur le terrain</span>}
              </span>
              <span style={{ fontSize: "0.7rem", color: "#6d6b71" }}>{total} min</span>
              <button
                onClick={() => substitute(id, onField ? "out" : "in")}
                className={onField ? "admin-btn-ghost" : "admin-btn-primary"}
                style={{ fontSize: "0.68rem", padding: "0.25rem 0.6rem" }}
              >
                {onField ? "Faire sortir" : "Faire entrer"}
              </button>
            </div>
          );
        })}
        {convokedIds.length === 0 && <p className="admin-empty-text">Convoquez des joueuses pour suivre leur temps de jeu.</p>}
      </div>
      {lineup.length === 0 && <p style={{ fontSize: "0.68rem", color: "#6d6b71", marginTop: "0.4rem" }}>Astuce : placez d&apos;abord les titulaires dans l&apos;alignement ci-dessus.</p>}
    </div>
  );
}

function EvaluationsPanel({ activityId, roster, convocations, initial, role, coachId }: { activityId: string; roster: MatchRosterPlayer[]; convocations: Record<string, ConvocationStatus | undefined>; initial: MatchPlayerEvaluation[]; role: "admin" | "coach"; coachId?: string }) {
  const [evaluations, setEvaluations] = useState(initial);
  const convokedIds = Object.entries(convocations).filter(([, s]) => s === "convoked" || s === "confirmed").map(([id]) => id);
  const base = apiBase(activityId, role);

  if (role === "admin") {
    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Évaluations post-match</p>
        {evaluations.length === 0 && <p className="admin-empty-text">Aucune évaluation saisie pour l&apos;instant.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {evaluations.map((e) => (
            <div key={e.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.5rem 0.7rem", fontSize: "0.75rem", color: "#c3c2c8" }}>
              <strong>{playerName(roster, e.registration_id)}</strong>
              {e.position_code && ` · ${POSITION_LABELS[e.position_code] ?? e.position_code}`}
              {e.score !== null && ` · ${e.score}/${e.scale}`}
              {e.comment && <p style={{ margin: "0.2rem 0 0", color: "#9d9da0" }}>{e.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Évaluations post-match</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {convokedIds.map((id) => (
          <MatchEvalRow
            key={id}
            activityId={activityId}
            registrationId={id}
            coachId={coachId}
            playerLabel={playerName(roster, id)}
            existing={evaluations.find((e) => e.registration_id === id && e.coach_id === coachId)}
            base={base}
            onSaved={(saved) => setEvaluations((prev) => [...prev.filter((e) => !(e.registration_id === id && e.coach_id === coachId)), saved])}
          />
        ))}
        {convokedIds.length === 0 && <p className="admin-empty-text">Convoquez des joueuses pour pouvoir les évaluer après le match.</p>}
      </div>
    </div>
  );
}

function MatchEvalRow({ activityId, registrationId, coachId, playerLabel, existing, base, onSaved }: { activityId: string; registrationId: string; coachId?: string; playerLabel: string; existing: MatchPlayerEvaluation | undefined; base: string; onSaved: (evaluation: MatchPlayerEvaluation) => void }) {
  const [position, setPosition] = useState(existing?.position_code ?? "");
  const [scale, setScale] = useState<10 | 100>(existing?.scale ?? 10);
  const [score, setScore] = useState(existing?.score?.toString() ?? "");
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${base}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, positionCode: position || null, scale, score: score === "" ? null : parseFloat(score), comment: comment.trim() || null })
      });
      if (res.ok) {
        setSaved(true);
        onSaved({
          id: existing?.id ?? "",
          activity_id: activityId,
          registration_id: registrationId,
          coach_id: coachId ?? "",
          position_code: position || null,
          scale,
          score: score === "" ? null : parseFloat(score),
          comment: comment.trim() || null
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.8rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <strong style={{ fontSize: "0.8rem", color: "#fff" }}>{playerLabel}</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        <select className="admin-input" value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: "auto", fontSize: "0.72rem" }}>
          <option value="">Poste joué</option>
          {MATCH_POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABELS[p]}</option>)}
        </select>
        <select className="admin-input" value={scale} onChange={(e) => setScale(parseInt(e.target.value, 10) as 10 | 100)} style={{ width: "auto", fontSize: "0.72rem" }}>
          <option value={10}>Échelle /10</option>
          <option value={100}>Échelle /100</option>
        </select>
        <input className="admin-input" type="number" min={0} max={scale} placeholder={`Note /${scale}`} value={score} onChange={(e) => setScore(e.target.value)} style={{ width: "6rem", fontSize: "0.72rem" }} />
      </div>
      <textarea className="admin-input" placeholder="Commentaire" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} style={{ fontSize: "0.75rem" }} />
      <div>
        <button className="admin-btn-primary" onClick={save} disabled={saving} style={{ fontSize: "0.72rem" }}>{saving ? "..." : saved ? "✓ Enregistré" : "Enregistrer"}</button>
      </div>
    </div>
  );
}

export function MatchPanel({ activityId, roster, initialDetails, initialConvocations, initialLineup, initialPlaytime, initialEvaluations, role, coachId }: Props) {
  const convocationsMap: Record<string, ConvocationStatus | undefined> = Object.fromEntries(initialConvocations.map((c) => [c.registration_id, c.status]));
  const [convocations, setConvocations] = useState(convocationsMap);

  return (
    <div>
      <MatchDetailsForm activityId={activityId} initial={initialDetails} role={role} />
      <ConvocationsPanelWithSync activityId={activityId} roster={roster} initial={initialConvocations} role={role} onChange={setConvocations} />
      <LineupBoard activityId={activityId} roster={roster} convocations={convocations} initial={initialLineup} role={role} />
      <LiveTimer activityId={activityId} roster={roster} convocations={convocations} lineup={initialLineup} initial={initialPlaytime} role={role} />
      <EvaluationsPanel activityId={activityId} roster={roster} convocations={convocations} initial={initialEvaluations} role={role} coachId={coachId} />
    </div>
  );
}

/** Enveloppe ConvocationsPanel pour remonter les changements au parent
 *  (l'alignement/le temps de jeu/les évaluations ne concernent que les
 *  joueuses convoquées, donc doivent réagir en direct aux changements). */
function ConvocationsPanelWithSync({ activityId, roster, initial, role, onChange }: { activityId: string; roster: MatchRosterPlayer[]; initial: MatchConvocation[]; role: "admin" | "coach"; onChange: (map: Record<string, ConvocationStatus | undefined>) => void }) {
  const [map, setMap] = useState<Record<string, ConvocationStatus | undefined>>(
    Object.fromEntries(initial.map((c) => [c.registration_id, c.status]))
  );

  const setStatus = async (registrationId: string, status: ConvocationStatus | "none") => {
    const base = apiBase(activityId, role);
    const next = { ...map, [registrationId]: status === "none" ? undefined : status };
    setMap(next);
    onChange(next);
    if (status === "none") await fetch(`${base}/convocations?registrationId=${registrationId}`, { method: "DELETE" });
    else await fetch(`${base}/convocations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, status }) });
  };

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        Convocations <span style={{ color: "#6d6b71", fontWeight: 400 }}>· {Object.values(map).filter(Boolean).length}/{roster.length}</span>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {roster.map((p) => (
          <div key={p.registrationId} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.4rem 0.7rem" }}>
            <Avatar firstName={p.firstName} lastName={p.lastName} photoUrl={p.photoUrl} size={26} />
            <span style={{ fontSize: "0.78rem", color: "#c3c2c8", flex: 1 }}>{p.firstName} {p.lastName}</span>
            <select className="admin-input" value={map[p.registrationId] ?? "none"} onChange={(e) => setStatus(p.registrationId, e.target.value as ConvocationStatus | "none")} style={{ fontSize: "0.72rem", width: "auto" }}>
              <option value="none">Non convoquée</option>
              {(Object.keys(CONVOCATION_LABELS) as ConvocationStatus[]).map((s) => <option key={s} value={s}>{CONVOCATION_LABELS[s]}</option>)}
            </select>
          </div>
        ))}
        {roster.length === 0 && <p className="admin-empty-text">Aucune joueuse trouvée pour cette catégorie.</p>}
      </div>
    </div>
  );
}
