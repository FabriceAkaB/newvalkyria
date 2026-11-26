"use client";

import { Check, CircleSlash, ListChecks } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { announcePlannedChange, PLANNED_EVENT } from "@/lib/planned-exercises";
import type { PlannedView } from "@/lib/planned-exercises-repo";

/** « Exercices prévus : faits ? » (JP, 26 nov. 2026) : au début du rapport (portail, vue par étapes et tout-en-un) et
 *  dans la fiche admin de la pratique. Chaque bloc du plan reçoit Oui ou Non, une réponse partagée par tous les
 *  éducateurs. La ligne du ball mastery remplace l'ancienne question « Ball mastery fait aujourd'hui ? » :
 *  Non = ses gestes ne sont pas demandés dans l'évaluation des filles. Le rapport journalier (Sauté) et la note des
 *  exercices (On ne l'a pas fait) lisent et écrivent le même état ; les trois se resynchronisent entre eux. */

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;

export function PlannedExercisesCard({
  activityId,
  initial,
  statusUrl,
  saveUrl,
  saveBody = {},
  canAnswer,
  required = false,
  className = "coach-card",
  buttonClassName = "coach-secondary",
  onChange
}: {
  activityId: string;
  initial: PlannedView | null;
  statusUrl: string;
  saveUrl: string;
  saveBody?: Record<string, unknown>;
  /** Faux avant le jour de la pratique : on lit seulement. */
  canAnswer: boolean;
  /** Fait partie du rapport complet (pratiques depuis le 26 nov. 2026). */
  required?: boolean;
  className?: string;
  /** Bouton « Les autres ont été faits » : style du portail ou de l'admin. */
  buttonClassName?: string;
  onChange?: (view: PlannedView) => void;
}) {
  const [view, setView] = useState<PlannedView | null>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (next: PlannedView) => {
      setView(next);
      onChange?.(next);
    },
    [onChange]
  );

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(statusUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: PlannedView | null) => {
          if (alive && d && Array.isArray(d.blocks)) apply(d);
        })
        .catch(() => null);
    void load();
    const onEvent = (e: Event) => {
      if ((e as CustomEvent<{ activityId?: string; source?: string }>).detail?.activityId === activityId) void load();
    };
    window.addEventListener(PLANNED_EVENT, onEvent);
    return () => {
      alive = false;
      window.removeEventListener(PLANNED_EVENT, onEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusUrl, activityId]);

  if (!view || view.blocks.length === 0) return null;

  const answer = async (blockIds: string[], done: boolean, key: string) => {
    if (saving || !canAnswer) return;
    setSaving(key);
    setError(null);
    const res = await fetch(saveUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...saveBody, blockIds, done }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setSaving(null);
    if (!res?.ok || !data?.blocks) return setError(data?.error ?? "Pas enregistré. Réessaie.");
    apply(data as PlannedView);
    announcePlannedChange(activityId);
  };

  const { summary } = view;
  const unanswered = view.blocks.filter((b) => !b.answer);
  const bm = view.blocks.some((b) => b.ballMastery);

  const option = (blockId: string, current: string | null, done: boolean, label: string) => {
    const active = current === (done ? "oui" : "non");
    const tone = done ? "var(--adm-good)" : "var(--adm-warn)";
    const key = `${blockId}:${done}`;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={`${label} : ${done ? "Oui, fait" : "Non, pas fait"}`}
        disabled={!canAnswer || Boolean(saving)}
        onClick={() => (active ? undefined : answer([blockId], done, key))}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 40,
          minWidth: 76,
          padding: "0 12px",
          borderRadius: 10,
          border: active ? `2px solid ${tone}` : "1px solid var(--adm-border)",
          background: active ? "var(--adm-surface-2)" : "var(--adm-surface)",
          color: active ? tone : "var(--adm-text)",
          fontWeight: 600,
          font: "inherit",
          cursor: !canAnswer ? "default" : saving ? "wait" : "pointer",
          opacity: !canAnswer && !active ? 0.55 : 1
        }}
      >
        {done ? <Check size={16} aria-hidden /> : <CircleSlash size={16} aria-hidden />}
        {saving === key ? "…" : done ? "Oui" : "Non"}
      </button>
    );
  };

  return (
    <div className={className} style={{ marginBottom: 16, border: summary.complete ? undefined : "1px solid var(--adm-accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <p className="coach-card__label" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--adm-text)" }}>
          <ListChecks size={16} aria-hidden style={{ color: "var(--adm-accent)" }} />
          Exercices prévus : faits ?
        </p>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: summary.complete ? "var(--adm-good)" : "var(--adm-text-2)", fontVariantNumeric: "tabular-nums" }}>
          {summary.answered}/{summary.total} répondus{summary.notDone ? ` · ${summary.notDone} pas fait${summary.notDone > 1 ? "s" : ""}` : ""}
        </span>
      </div>
      <p style={{ margin: "6px 0 10px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        {canAnswer
          ? `Pour chaque bloc du plan : l'a-t-on fait ? Une réponse pour toute la pratique, la même pour tous les éducateurs, modifiable après coup.${bm ? " Ball mastery à Non : ses gestes ne sont pas demandés dans l'évaluation des filles." : ""}${required ? " Fait partie de ton rapport." : ""}`
          : "Tu répondras après la pratique : pour chaque bloc du plan, l'a-t-on fait ?"}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {view.blocks.map((b, i) => {
          const by = [b.byName, when(b.at)].filter(Boolean).join(", ");
          return (
            <li key={b.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", padding: "10px 0", borderTop: i ? "1px solid var(--adm-border)" : "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: "1 1 220px", minWidth: 0 }}>
                <span aria-hidden style={{ flex: "0 0 auto", width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: "0.75rem", fontWeight: 700, background: "var(--adm-surface-3)", color: "var(--adm-text-2)" }}>{i + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, color: "var(--adm-text)", overflowWrap: "anywhere" }}>{b.title}</span>
                  <span style={{ display: "block", fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
                    {[b.ballMastery ? "Ball mastery" : b.blockType, b.minutes ? `${b.minutes} min` : null].filter(Boolean).join(" · ")}
                    {b.answer === "non" && b.ballMastery ? " · gestes retirés de l'évaluation" : ""}
                    {b.answer && by ? ` · ${b.answer === "oui" ? "fait" : "pas fait"}, répondu par ${by}` : ""}
                  </span>
                </span>
              </div>
              <div role="radiogroup" aria-label={`${b.title} : fait ?`} style={{ display: "flex", gap: 8 }}>
                {option(b.id, b.answer, true, b.title)}
                {option(b.id, b.answer, false, b.title)}
              </div>
            </li>
          );
        })}
      </ul>
      {canAnswer && unanswered.length > 1 ? (
        <button type="button" className={buttonClassName} disabled={Boolean(saving)} onClick={() => answer(unanswered.map((b) => b.id), true, "tout")} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={16} aria-hidden /> {saving === "tout" ? "Enregistrement…" : `Les ${unanswered.length} autres ont été faits`}
        </button>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "var(--adm-bad)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
