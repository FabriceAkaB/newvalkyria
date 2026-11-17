"use client";

import { useEffect, useState } from "react";

/** Retour sur la pratique (portail) : ce qu'on a bien fait, ce qu'on a moins bien fait, ce qu'on change la prochaine
 *  fois. `CoachDebriefCard` à l'étape « Après » ; `PreviousDebriefCard` avant la pratique suivante du même groupe. */

interface Debrief {
  id: string;
  coachId: string;
  coachName: string;
  wentWell: string | null;
  toImprove: string | null;
  nextTime: string | null;
  date?: string;
}

const FIELDS = [
  { key: "wentWell", label: "Ce qu'on a bien fait", placeholder: "Ex. : les transitions entre les blocs, le rondo très intense, Mia a pris sa place de capitaine" },
  { key: "toImprove", label: "Ce qu'on a moins bien fait", placeholder: "Ex. : trop d'attente au 2e exercice, consignes trop longues, le montage pas prêt" },
  { key: "nextTime", label: "Ce qu'on change la prochaine fois", placeholder: "Ex. : 2 ateliers au lieu d'une file, montrer avant d'expliquer, monter le terrain pendant le ball mastery" }
] as const;
type Key = (typeof FIELDS)[number]["key"];

type Loaded = { coachId: string; debriefs: Debrief[]; previous: Debrief[] };

function useDebriefs(activityId: string, onLoad?: (d: Loaded) => void) {
  const [data, setData] = useState<Loaded | null>(null);
  useEffect(() => {
    fetch(`/api/coach/activities/${activityId}/retour`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Loaded | null) => {
        if (!d) return;
        setData(d);
        onLoad?.(d);
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);
  return data;
}

const fr = (iso?: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");

export function CoachDebriefCard({ activityId }: { activityId: string }) {
  const [values, setValues] = useState<Record<Key, string>>({ wentWell: "", toImprove: "", nextTime: "" });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const data = useDebriefs(activityId, (d) => {
    const mine = d.debriefs.find((x) => x.coachId === d.coachId);
    if (mine) setValues({ wentWell: mine.wentWell ?? "", toImprove: mine.toImprove ?? "", nextTime: mine.nextTime ?? "" });
  });

  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/coach/activities/${activityId}/retour`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
  };
  const others = (data?.debriefs ?? []).filter((d) => d.coachId !== data?.coachId);
  const filled = FIELDS.filter((f) => values[f.key].trim()).length;

  return (
    <div className="coach-card" style={{ marginTop: 16 }}>
      <p className="coach-card__label">Retour sur la pratique · {filled}/3</p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        Pour s&apos;améliorer d&apos;une fois à l&apos;autre : ton retour revient au début de la prochaine pratique de ce groupe, et JP le lit.
      </p>
      <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>{f.label}</span>
            <textarea
              className="admin-input"
              rows={3}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }));
                setState("idle");
              }}
            />
          </label>
        ))}
        <button type="button" className="coach-primary" onClick={save} disabled={state === "saving" || !filled}>
          {state === "saving" ? "Enregistrement…" : "Enregistrer mon retour"}
        </button>
        {state === "saved" ? <p className="coach-ok" style={{ margin: 0 }}>✓ Retour enregistré. Il reviendra avant la prochaine pratique de ce groupe.</p> : null}
        {state === "error" ? <p className="coach-error" role="alert">Pas enregistré. Réessaie.</p> : null}
      </div>
      {others.length ? (
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {others.map((d) => (
            <DebriefView key={d.id} d={d} title={`Retour de ${d.coachName.split(" ")[0]}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DebriefView({ d, title }: { d: Debrief; title: string }) {
  return (
    <div className="coach-block" style={{ margin: 0 }}>
      <p className="coach-block__title" style={{ marginBottom: 6 }}>{title}</p>
      <dl>
        {d.wentWell ? <div><dt>Bien fait</dt><dd>{d.wentWell}</dd></div> : null}
        {d.toImprove ? <div><dt>Moins bien</dt><dd>{d.toImprove}</dd></div> : null}
        {d.nextTime ? <div><dt>On change</dt><dd>{d.nextTime}</dd></div> : null}
      </dl>
    </div>
  );
}

/** Avant la pratique : ce que l'équipe avait décidé de changer la dernière fois avec ce groupe. */
export function PreviousDebriefCard({ activityId }: { activityId: string }) {
  const data = useDebriefs(activityId);
  const prev = data?.previous ?? [];
  if (!prev.length) return null;
  return (
    <div className="coach-card" style={{ marginTop: 12 }}>
      <p className="coach-card__label">La dernière fois avec ce groupe · {fr(prev[0].date)}</p>
      <div style={{ display: "grid", gap: 8 }}>
        {prev.map((d) => (
          <DebriefView key={d.id} d={d} title={d.coachName} />
        ))}
      </div>
    </div>
  );
}
