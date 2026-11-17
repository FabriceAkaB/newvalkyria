"use client";

import { useCallback, useEffect, useState } from "react";

import { LAB_RATING, LAB_STATUS_LABEL, MIN_TRIALS, type LabStatus } from "@/lib/coach-lab-core";
import type { LabExperiment } from "@/lib/coach-lab-repo";

/** Portail : le laboratoire des éducateurs. On note un concept entendu, on le teste à une pratique, on dit si la séance
 *  s'est améliorée ; ce qui a beaucoup de succès, JP le fait entrer dans la méthode Valkyria. */

const TONE: Record<LabStatus, string> = {
  a_tester: "var(--adm-text-2)",
  en_test: "var(--adm-info)",
  concluant: "var(--adm-good)",
  a_revoir: "var(--adm-warn)",
  abandonne: "var(--adm-text-3)",
  dans_methode: "var(--adm-good)"
};

const fr = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

export function CoachLab() {
  const [data, setData] = useState<{ experiments: LabExperiment[]; practices: { id: string; label: string }[] } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const load = useCallback(() => {
    fetch("/api/coach/laboratoire")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => null);
  }, []);
  useEffect(() => load(), [load]);

  const active = (data?.experiments ?? []).filter((e) => e.status !== "abandonne");
  const done = (data?.experiments ?? []).filter((e) => e.status === "abandonne");
  return (
    <div className="coach-page coach-page--wide">
      <p className="coach-eyebrow">Tester, observer, garder ce qui marche</p>
      <h1 className="coach-title coach-title--xl">Laboratoire</h1>
      <p className="coach-sub" style={{ maxWidth: 700 }}>
        Une idée entendue en formation, dans une vidéo ou chez un autre coach ? Note-la ici, teste-la à une pratique et dis si la séance s&apos;est améliorée. Après {MIN_TRIALS} essais, le site dit si c&apos;est concluant ; ce qui a beaucoup de succès, JP le fait entrer dans la méthode Valkyria.
      </p>
      <button type="button" className="coach-primary" style={{ margin: "12px 0" }} onClick={() => setShowNew((v) => !v)}>
        {showNew ? "Fermer" : "+ Une idée à tester"}
      </button>
      {showNew ? <NewExperiment onCreated={() => (setShowNew(false), load())} /> : null}
      {!data ? <p className="coach-muted">Chargement…</p> : null}
      {data && !data.experiments.length ? (
        <div className="coach-card">
          <p style={{ margin: 0, color: "var(--adm-text)", fontWeight: 600 }}>Le laboratoire est vide pour l&apos;instant.</p>
          <p className="coach-sub">Exemple : « Capitaine avec brassard et 1 temps mort » ou « Montrer l&apos;exercice avant de l&apos;expliquer ».</p>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 12 }}>
        {active.map((e) => (
          <ExperimentCard key={e.id} e={e} practices={data?.practices ?? []} onChanged={load} />
        ))}
      </div>
      {done.length ? (
        <details style={{ marginTop: 16 }}>
          <summary className="coach-muted" style={{ cursor: "pointer" }}>Abandonnées ({done.length})</summary>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {done.map((e) => (
              <ExperimentCard key={e.id} e={e} practices={[]} onChanged={load} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function NewExperiment({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState({ title: "", source: "", hypothesis: "", howTo: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/laboratoire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(d?.error ?? "Pas enregistré. Réessaie.");
    onCreated();
  };
  const field = (key: keyof typeof f, label: string, placeholder: string, rows = 2) => (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>{label}</span>
      {rows === 1 ? (
        <input className="admin-input" value={f[key]} placeholder={placeholder} onChange={(e) => setF((v) => ({ ...v, [key]: e.target.value }))} />
      ) : (
        <textarea className="admin-input" rows={rows} value={f[key]} placeholder={placeholder} onChange={(e) => setF((v) => ({ ...v, [key]: e.target.value }))} />
      )}
    </label>
  );
  return (
    <div className="coach-card" style={{ marginBottom: 12, display: "grid", gap: 10 }}>
      {field("title", "Le concept à tester", "Ex. : la capitaine a un brassard et peut demander 1 temps mort", 1)}
      {field("source", "Où on l'a entendu", "Ex. : formation C Diploma, vidéo de …, un coach de …", 1)}
      {field("hypothesis", "Ce qu'on espère améliorer", "Ex. : les filles se responsabilisent et communiquent plus")}
      {field("howTo", "Comment l'appliquer à une pratique", "Ex. : 1 brassard par équipe au match de fin ; la capitaine peut arrêter le jeu 30 s une fois")}
      {error ? <p className="coach-error" role="alert">{error}</p> : null}
      <button type="button" className="coach-primary" onClick={save} disabled={busy || !f.title.trim()}>
        {busy ? "Enregistrement…" : "Ajouter au laboratoire"}
      </button>
    </div>
  );
}

function ExperimentCard({ e, practices, onChanged }: { e: LabExperiment; practices: { id: string; label: string }[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [activityId, setActivityId] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [observation, setObservation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/coach/laboratoire/${e.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activityId, rating, observation }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(d?.error ?? "Pas enregistré. Réessaie.");
    setOpen(false);
    setRating(null);
    setObservation("");
    onChanged();
  };
  return (
    <div className="coach-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--adm-text)" }}>{e.title}</p>
        <span style={{ color: TONE[e.status], fontWeight: 700, fontSize: "0.85rem" }}>
          {LAB_STATUS_LABEL[e.status]}
          {e.average !== null ? ` · ${e.average.toLocaleString("fr-CA")}/5` : ""}
        </span>
      </div>
      <p className="coach-muted" style={{ margin: "2px 0 8px" }}>
        Proposé par {e.createdBy} le {fr(e.createdAt)}
        {e.source ? ` · source : ${e.source}` : ""}
      </p>
      {e.hypothesis ? <p className="coach-sub" style={{ margin: "0 0 4px" }}><strong>On espère :</strong> {e.hypothesis}</p> : null}
      {e.howTo ? <p className="coach-sub" style={{ margin: 0 }}><strong>Comment :</strong> {e.howTo}</p> : null}
      {e.trials.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>
          {e.trials.map((t) => (
            <li key={t.id} className="coach-block" style={{ margin: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                {fr(t.date)} · {t.coachName}
                {t.rating ? ` · ${t.rating}/5 (${LAB_RATING[t.rating].toLowerCase()})` : ""}
              </p>
              {t.activityLabel ? <p className="coach-muted" style={{ margin: 0 }}>{t.activityLabel}</p> : null}
              {t.observation ? <p className="coach-sub" style={{ margin: "4px 0 0" }}>{t.observation}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {e.status !== "abandonne" && e.status !== "dans_methode" ? (
        open ? (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <select className="admin-input" value={activityId} onChange={(ev) => setActivityId(ev.target.value)}>
              <option value="">À quelle pratique l&apos;as-tu testé ?</option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="coach-muted">Est-ce que ça a amélioré la séance ?</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={rating === n ? "coach-primary" : "coach-secondary"} style={{ minWidth: 44 }} title={LAB_RATING[n]} onClick={() => setRating(n)}>
                  {n}
                </button>
              ))}
            </div>
            {rating ? <span className="coach-muted">{LAB_RATING[rating]}</span> : null}
            <textarea className="admin-input" rows={3} value={observation} placeholder="Ce que tu as observé : les filles, la séance, ce qu'il faudrait ajuster" onChange={(ev) => setObservation(ev.target.value)} />
            {error ? <p className="coach-error" role="alert">{error}</p> : null}
            <button type="button" className="coach-primary" onClick={save} disabled={busy || !rating || !activityId}>
              {busy ? "Enregistrement…" : "Enregistrer l'essai"}
            </button>
          </div>
        ) : (
          <button type="button" className="coach-secondary" style={{ marginTop: 10, width: "100%" }} onClick={() => setOpen(true)}>
            Je l&apos;ai testé à une pratique
          </button>
        )
      ) : null}
    </div>
  );
}
