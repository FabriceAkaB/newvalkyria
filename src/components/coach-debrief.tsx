"use client";

import { useEffect, useState } from "react";

import { DictateButton } from "@/components/coach-group-evaluation";
import { DEBRIEF_POINT_MIN_WORDS, countWords, debriefPoints, isDebriefComplete } from "@/lib/coach-report";

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

/** Deux choses qui ont bien marché, deux à améliorer (obligatoire pour que les heures comptent, JP 18 nov. 2026),
 *  puis ce qu'on change la prochaine fois. Les points sont gardés une ligne chacun dans went_well / to_improve. */
const POINTS = [
  { key: "wentWell", label: "2 choses qui ont bien marché", placeholders: ["Ex. : les transitions entre les blocs étaient rapides", "Ex. : Mia a bien pris sa place de capitaine"] },
  { key: "toImprove", label: "2 choses à améliorer", placeholders: ["Ex. : trop d'attente en file au 2e exercice", "Ex. : le montage du terrain pas prêt à l'arrivée"] }
] as const;
type PointKey = (typeof POINTS)[number]["key"];
type Values = { wentWell: [string, string]; toImprove: [string, string]; nextTime: string };

const splitTwo = (text: string | null | undefined): [string, string] => {
  const lines = String(text ?? "").split(/\n+/).map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  if (lines.length <= 2) return [lines[0] ?? "", lines[1] ?? ""];
  return [lines[0], lines.slice(1).join(" ")];
};
const join = (pair: [string, string]) => pair.map((p) => p.trim()).filter(Boolean).join("\n");

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

export function CoachDebriefCard({ activityId, onStatus, required = true }: { activityId: string; onStatus?: (complete: boolean) => void; required?: boolean }) {
  const [values, setValues] = useState<Values>({ wentWell: ["", ""], toImprove: ["", ""], nextTime: "" });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const data = useDebriefs(activityId, (d) => {
    const mine = d.debriefs.find((x) => x.coachId === d.coachId);
    if (mine) {
      setValues({ wentWell: splitTwo(mine.wentWell), toImprove: splitTwo(mine.toImprove), nextTime: mine.nextTime ?? "" });
      onStatus?.(isDebriefComplete(mine));
    }
  });

  const payload = { wentWell: join(values.wentWell), toImprove: join(values.toImprove), nextTime: values.nextTime };
  const complete = isDebriefComplete(payload);
  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/coach/activities/${activityId}/retour`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) onStatus?.(complete);
  };
  const others = (data?.debriefs ?? []).filter((d) => d.coachId !== data?.coachId);
  const okPoints = debriefPoints(payload.wentWell).length + debriefPoints(payload.toImprove).length;
  // La dictée ajoute au texte déjà là (le micro envoie une phrase à la fois).
  const appendPoint = (key: PointKey, i: 0 | 1, t: string) => {
    setValues((prev) => {
      const pair: [string, string] = [...prev[key]] as [string, string];
      const cur = pair[i].trimEnd();
      pair[i] = cur ? `${cur} ${t}` : `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
      return { ...prev, [key]: pair };
    });
    setState("idle");
  };
  const setPoint = (key: PointKey, i: 0 | 1, v: string) => {
    setValues((prev) => {
      const pair: [string, string] = [...prev[key]] as [string, string];
      pair[i] = v.replace(/\n/g, " ");
      return { ...prev, [key]: pair };
    });
    setState("idle");
  };

  return (
    <div className="coach-card" style={{ marginTop: 16 }}>
      <p className="coach-card__label">Retour sur la pratique · {Math.min(okPoints, 4)}/4</p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        {required ? "Obligatoire pour ton heure de rapport : " : ""}2 choses qui ont bien marché et 2 à améliorer, au moins {DEBRIEF_POINT_MIN_WORDS} mots chacune. Ton retour revient au début de la prochaine pratique de ce groupe, et JP le lit.
      </p>
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        {POINTS.map((f) => (
          <div key={f.key} style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>{f.label}</span>
            {([0, 1] as const).map((i) => {
              const v = values[f.key][i];
              const ok = countWords(v) >= DEBRIEF_POINT_MIN_WORDS;
              return (
                <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span aria-hidden style={{ minWidth: 18, paddingTop: 10, fontWeight: 700, color: ok ? "var(--adm-good)" : "var(--adm-text-2)" }}>{ok ? "✓" : `${i + 1}.`}</span>
                  <span style={{ flex: 1, display: "grid", gap: 4 }}>
                    <textarea className="admin-input" rows={2} value={v} placeholder={f.placeholders[i]} aria-label={`${f.label}, point ${i + 1}`} onChange={(e) => setPoint(f.key, i, e.target.value)} />
                    <span>
                      <DictateButton label="Dicter" onText={(t) => appendPoint(f.key, i, t)} />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>Ce qu&apos;on change la prochaine fois <span style={{ fontWeight: 400, color: "var(--adm-text-2)" }}>(facultatif)</span></span>
          <textarea
            className="admin-input"
            rows={2}
            value={values.nextTime}
            placeholder="Ex. : 2 ateliers au lieu d'une file, montrer avant d'expliquer"
            onChange={(e) => {
              setValues((v) => ({ ...v, nextTime: e.target.value }));
              setState("idle");
            }}
          />
        </label>
        <button type="button" className="coach-primary" onClick={save} disabled={state === "saving" || okPoints === 0}>
          {state === "saving" ? "Enregistrement…" : "Enregistrer mon retour"}
        </button>
        {state === "saved" ? (
          <p className={complete ? "coach-ok" : "coach-sub"} style={{ margin: 0 }}>
            {complete ? "✓ Retour complet. Il reviendra avant la prochaine pratique de ce groupe." : `Enregistré, mais il manque ${4 - Math.min(okPoints, 4)} point${4 - okPoints > 1 ? "s" : ""}${required ? " pour ton heure de rapport" : ""}.`}
          </p>
        ) : null}
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
        {d.wentWell ? <div><dt>Bien marché</dt><dd style={{ whiteSpace: "pre-line" }}>{d.wentWell}</dd></div> : null}
        {d.toImprove ? <div><dt>À améliorer</dt><dd style={{ whiteSpace: "pre-line" }}>{d.toImprove}</dd></div> : null}
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
