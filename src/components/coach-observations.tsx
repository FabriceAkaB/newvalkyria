"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { OBSERVATION_CRITERIA, SCORE_LABEL, type ObservationCriterion } from "@/lib/coach-observations";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** Nouvelle observation filmée d'un coach (P1.4.03) : grille sur 10, points forts, à améliorer, focus du mois suivant. */
export function ObservationForm({ coaches, activities, defaultCoachId }: { coaches: { id: string; name: string }[]; activities: { coachId: string; activityId: string; label: string }[]; defaultCoachId?: string }) {
  const router = useRouter();
  const [coachId, setCoachId] = useState(defaultCoachId ?? coaches[0]?.id ?? "");
  const [activityId, setActivityId] = useState("");
  const [date, setDate] = useState(today());
  const [video, setVideo] = useState("");
  const [scores, setScores] = useState<Partial<Record<ObservationCriterion, number>>>({});
  const [strengths, setStrengths] = useState("");
  const [toImprove, setToImprove] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [share, setShare] = useState(true);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const total = OBSERVATION_CRITERIA.reduce((s, c) => s + (scores[c.key] ?? 0), 0);
  const complete = OBSERVATION_CRITERIA.every((c) => scores[c.key] !== undefined);
  const own = activities.filter((a) => a.coachId === coachId);

  const save = async () => {
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/coaching/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId, activityId: activityId || null, observedOn: date, videoUrl: video || null, scores, strengths, toImprove, nextFocus, share })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "Pas enregistré : réessaie." });
    setState({ kind: "saved", message: share ? "Enregistré et publié dans le portail de l'éducateur." : "Enregistré (pas encore publié)." });
    setScores({});
    setStrengths("");
    setToImprove("");
    setNextFocus("");
    setVideo("");
    router.refresh();
  };

  if (!coaches.length) return <p className="admin-empty-text">Aucun éducateur actif.</p>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <label className="ct-field">
          <span>Éducateur</span>
          <select className="admin-input" value={coachId} onChange={(e) => { setCoachId(e.target.value); setActivityId(""); }}>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="ct-field"><span>Date</span><input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="ct-field">
          <span>Séance observée</span>
          <select className="admin-input" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">—</option>
            {own.map((a) => <option key={a.activityId} value={a.activityId}>{a.label}</option>)}
          </select>
        </label>
      </div>
      <label className="ct-field"><span>Vidéo de la séance (YouTube non répertorié)</span><input className="admin-input" type="url" value={video} onChange={(e) => setVideo(e.target.value)} /></label>

      <div className="ct-field">
        <span>La règle du coach · {complete ? `${total}/10` : "note chaque critère"}</span>
        {OBSERVATION_CRITERIA.map((c) => (
          <div key={c.key} className="ob-row">
            <div>
              <strong>{c.label}</strong>
              <span>{c.hint}</span>
            </div>
            <div className="ob-seg" role="radiogroup" aria-label={c.label}>
              {[0, 1, 2].map((v) => (
                <button key={v} type="button" role="radio" aria-checked={scores[c.key] === v} data-active={String(scores[c.key] === v)} onClick={() => setScores((p) => ({ ...p, [c.key]: v }))}>
                  {SCORE_LABEL[v]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="ct-field"><span>Points forts</span><textarea className="admin-input" rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></label>
      <label className="ct-field"><span>À améliorer</span><textarea className="admin-input" rows={2} value={toImprove} onChange={(e) => setToImprove(e.target.value)} /></label>
      <label className="ct-field"><span>Focus du mois prochain (une seule chose)</span><input className="admin-input" value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} /></label>
      <label className="sp-check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Publier le retour dans le portail de l&apos;éducateur</label>
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" onClick={save} disabled={!complete || !coachId || state.kind === "saving"} style={{ minHeight: 44 }}>
          {state.kind === "saving" ? "Enregistrement…" : "Enregistrer l'observation"}
        </button>
        {state.kind === "saved" && <span style={{ color: "var(--adm-good)", fontSize: "0.85rem" }}>{state.message}</span>}
        {state.kind === "error" && <span style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }} role="alert">{state.message}</span>}
      </div>
    </div>
  );
}

export function ShareToggle({ id, shared }: { id: string; shared: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    await fetch("/api/admin/coaching/observations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, shared: !shared }) }).catch(() => null);
    setBusy(false);
    router.refresh();
  };
  return (
    <button type="button" className="admin-btn-ghost" onClick={toggle} disabled={busy} style={{ whiteSpace: "nowrap" }}>
      {shared ? "Retirer du portail" : "Publier au coach"}
    </button>
  );
}
