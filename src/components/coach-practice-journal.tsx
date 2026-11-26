"use client";

import { Check, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { announcePlannedChange, journalOutcome, PLANNED_EVENT, type BlockAnswer } from "@/lib/planned-exercises";
import { EXERCISE_OUTCOMES, JOURNAL_FIELDS, journalProgress, type ExerciseOutcome, type Journal } from "@/lib/practice-journal";

/** Rapport journalier de la pratique (JP, 20 nov. 2026) : la mémoire de ce qui s'est passé, rempli au fil de la
 *  journée. Chaque champ s'enregistre seul (un toucher pour les échelles, à la sortie du champ ou après une pause
 *  pour le texte). Ce n'est pas l'évaluation du coach : on décrit la pratique.
 *  « Exercices réalisés » montre l'état partagé « Exercices prévus : faits ? » (Sauté = Non), le même pour tous. */
export function CoachPracticeJournal({ activityId, blocks }: { activityId: string; blocks: { id: string; title: string }[] }) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [answers, setAnswers] = useState<Record<string, BlockAnswer>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch(`/api/coach/activities/${activityId}/journal`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setJournal((d?.journal ?? {}) as Journal);
        setAnswers((d?.answers ?? {}) as Record<string, BlockAnswer>);
      })
      .catch(() => setJournal({}));
    // Réponse donnée ailleurs (carte « Exercices prévus », note des exercices) : on relit l'état partagé.
    const onEvent = (e: Event) => {
      if ((e as CustomEvent<{ activityId?: string }>).detail?.activityId !== activityId) return;
      fetch(`/api/coach/activities/${activityId}/journal`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.answers && setAnswers(d.answers as Record<string, BlockAnswer>))
        .catch(() => null);
    };
    window.addEventListener(PLANNED_EVENT, onEvent);
    return () => window.removeEventListener(PLANNED_EVENT, onEvent);
  }, [activityId]);

  const save = async (patch: Journal) => {
    const res = await fetch(`/api/coach/activities/${activityId}/journal`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    if (res?.ok) {
      setError(false);
      if (patch.exercices) {
        const d = await res.json().catch(() => null);
        if (d?.answers) setAnswers(d.answers as Record<string, BlockAnswer>);
        announcePlannedChange(activityId);
      }
      setSavedAt(new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" }));
    } else setError(true);
  };
  const set = (patch: Journal, delay = 0) => {
    setJournal((j) => ({ ...(j ?? {}), ...patch, ...(patch.exercices ? { exercices: { ...(j?.exercices ?? {}), ...patch.exercices } } : {}) }));
    if (patch.exercices) {
      const ex = patch.exercices;
      setAnswers((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(ex).map(([id, o]) => [id, o === "saute" ? "non" : "oui"])) }));
    }
    const key = Object.keys(patch)[0];
    clearTimeout(timers.current[key]);
    if (delay) timers.current[key] = setTimeout(() => void save(patch), delay);
    else void save(patch);
  };

  if (!journal) return null;
  // Les issues affichées suivent l'état partagé (Non = Sauté), puis ce que ce coach a précisé (Modifié).
  const outcomes: Record<string, ExerciseOutcome> = {};
  for (const b of blocks) {
    const o = journalOutcome(answers[b.id] ?? null, journal.exercices?.[b.id]);
    if (o) outcomes[b.id] = o;
  }
  const p = journalProgress({ ...journal, exercices: outcomes }, blocks.length);

  return (
    <div className="coach-card" style={{ marginTop: 12, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <p className="coach-card__label" style={{ margin: 0 }}>Rapport journalier de la pratique · {p.done}/{p.total}</p>
        <span className="coach-muted" style={{ fontSize: "0.8rem", color: error ? "var(--adm-bad)" : undefined }}>
          {error ? "Pas enregistré : vérifie le réseau" : savedAt ? `Enregistré à ${savedAt}` : "S'enregistre tout seul"}
        </span>
      </div>
      <p className="coach-sub" style={{ margin: 0 }}>
        Note tes observations au fil de la pratique, pas besoin d&apos;attendre la fin. Ce rapport garde la mémoire de la pratique ; ce n&apos;est pas ton évaluation. <Clock size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Minuteur et alarmes de chaque bloc : étape « Pendant ».
      </p>

      {blocks.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Exercices réalisés</p>
          <p className="coach-muted" style={{ margin: "-2px 0 0", fontSize: "0.8rem" }}>Même réponse que « Exercices prévus : faits ? » : Sauté = pas fait, pour tous les éducateurs.</p>
          {blocks.map((b) => {
            const cur = outcomes[b.id];
            return (
              <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <span style={{ color: "var(--adm-text)", minWidth: 0 }}>{b.title}</span>
                <div className="coach-seg" role="radiogroup" aria-label={`Exercice ${b.title}`}>
                  {EXERCISE_OUTCOMES.map((o) => (
                    <button key={o.value} type="button" role="radio" aria-checked={cur === o.value} data-active={String(cur === o.value)} onClick={() => set({ exercices: { [b.id]: o.value as ExerciseOutcome } })}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {JOURNAL_FIELDS.map((f) => {
        const v = journal[f.key];
        const filled = f.kind === "scale" ? typeof v === "number" : typeof v === "string" && v.trim().length > 0;
        return (
          <div key={f.key} style={{ display: "grid", gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)", display: "flex", alignItems: "center", gap: 6 }}>
              {filled ? <Check size={16} aria-hidden style={{ color: "var(--adm-good)" }} /> : null}
              {f.label}
            </p>
            <p className="coach-muted" style={{ margin: "-4px 0 0", fontSize: "0.8rem" }}>{f.hint}</p>
            {f.kind === "scale" ? (
              <>
                <div className="coach-seg" role="radiogroup" aria-label={f.label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={v === n} data-active={String(v === n)} onClick={() => set({ [f.key]: n })}>
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  className="admin-input"
                  placeholder="Précision (facultatif)"
                  defaultValue={String(journal[`${f.key}_note`] ?? "")}
                  onChange={(e) => set({ [`${f.key}_note`]: e.target.value }, 1500)}
                  onBlur={(e) => set({ [`${f.key}_note`]: e.target.value })}
                />
              </>
            ) : (
              <textarea className="admin-input" rows={2} defaultValue={String(v ?? "")} onChange={(e) => set({ [f.key]: e.target.value }, 1500)} onBlur={(e) => set({ [f.key]: e.target.value })} />
            )}
          </div>
        );
      })}
      <p className="coach-muted" style={{ margin: 0, fontSize: "0.8rem" }}>Tes 2 réussites et tes 2 améliorations se notent plus bas, dans « Retour sur la pratique ».</p>
    </div>
  );
}
