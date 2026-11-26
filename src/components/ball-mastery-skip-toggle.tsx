"use client";

import { Check, CircleSlash } from "lucide-react";
import { useEffect, useState } from "react";

/** « Ball mastery fait aujourd'hui ? Oui / Non » (JP, 25 nov. 2026) : une réponse par pratique, partagée par tous ses
 *  éducateurs. Au début de l'évaluation des filles dans le rapport (vue par étapes et vue tout-en-un) et dans la fiche
 *  admin de la pratique, aussi pour les pratiques passées. Tant que personne n'a répondu, les gestes sont demandés. */

export interface BallMasteryToggleStatus {
  planned: boolean;
  skipped: boolean;
  answer: "oui" | "non" | null;
  byName: string | null;
  at: string | null;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;

export function BallMasterySkipToggle({
  initial,
  statusUrl,
  saveUrl,
  saveBody = {},
  title = "Ball mastery fait aujourd'hui ?",
  onChange
}: {
  initial: BallMasteryToggleStatus;
  /** Relit la réponse (qui, quand) à l'ouverture de la page. */
  statusUrl?: string;
  saveUrl: string;
  saveBody?: Record<string, unknown>;
  title?: string;
  onChange?: (skipped: boolean) => void;
}) {
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!statusUrl) return;
    let alive = true;
    fetch(statusUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || typeof d.skipped !== "boolean") return;
        setStatus(d);
        onChange?.(d.skipped);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusUrl]);

  if (!status.planned) return null;

  const answer = async (done: boolean) => {
    if (saving || status.answer === (done ? "oui" : "non")) return;
    setSaving(true);
    setError(null);
    const res = await fetch(saveUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...saveBody, done }) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setSaving(false);
    if (!res?.ok || !data) return setError(data?.error ?? "Pas enregistré. Réessaie.");
    setStatus(data);
    onChange?.(Boolean(data.skipped));
  };

  const by = [status.byName, when(status.at)].filter(Boolean).join(", ");
  const option = (done: boolean) => {
    const active = status.answer === (done ? "oui" : "non");
    const tone = done ? "var(--adm-good)" : "var(--adm-warn)";
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={saving}
        onClick={() => answer(done)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 40,
          minWidth: 88,
          padding: "0 14px",
          borderRadius: 10,
          border: active ? `2px solid ${tone}` : "1px solid var(--adm-border)",
          background: active ? "var(--adm-surface-2)" : "var(--adm-surface)",
          color: active ? tone : "var(--adm-text)",
          fontWeight: 600,
          font: "inherit",
          cursor: saving ? "wait" : "pointer"
        }}
      >
        {done ? <Check size={16} aria-hidden /> : <CircleSlash size={16} aria-hidden />}
        {done ? "Oui" : "Non"}
      </button>
    );
  };

  return (
    <div style={{ border: `1px solid ${status.answer ? "var(--adm-border)" : "var(--adm-accent)"}`, borderRadius: 12, background: "var(--adm-surface)", padding: "12px 14px", margin: "0 0 12px", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>{title}</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
          {status.answer === "non"
            ? "Non : les gestes du ball mastery ne sont pas demandés dans l'évaluation des filles et ne comptent pas dans leurs moyennes, pour tous les éducateurs. Le rapport est complet sans eux."
            : status.answer === "oui"
              ? "Oui : note chaque geste du ball mastery dans l'évaluation de chaque fille."
              : "Réponds pour toute la pratique. « Non » enlève les gestes du ball mastery de l'évaluation de chaque fille, pour tous les éducateurs."}
          {status.answer && by ? ` Répondu par ${by}.` : ""}
        </p>
        {error ? (
          <p role="alert" style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--adm-bad)" }}>
            {error}
          </p>
        ) : null}
      </div>
      <div role="radiogroup" aria-label={title} style={{ display: "flex", gap: 8 }}>
        {option(true)}
        {option(false)}
      </div>
    </div>
  );
}
