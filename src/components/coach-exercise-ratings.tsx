"use client";

import { useEffect, useState } from "react";

import { APPROVAL_SCORE, RATING_CRITERIA, SCORE_LABELS, STATUS_LABEL, STATUS_TONE, type RatingCriterion, type RatingScores } from "@/lib/exercise-bank";
import type { ExerciseToRate } from "@/lib/exercises-repo";

/** Rapport des 24 heures : l'éducateur note sur 10 chaque exercice de la banque utilisé dans la séance
 *  (5 critères à 0, 1 ou 2). La note décide du statut de l'exercice dans la banque Valkyria. */
export function CoachExerciseRatings({ activityId }: { activityId: string }) {
  const [items, setItems] = useState<ExerciseToRate[] | null>(null);
  const [canRate, setCanRate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/coach/activities/${activityId}/exercise-ratings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setItems(data.exercises);
        setCanRate(data.canRate);
        const first = (data.exercises as ExerciseToRate[]).find((e) => !e.myRating);
        if (data.canRate && first) setOpenId(first.exerciseId);
      })
      .catch(() => setItems([]));
    return () => {
      alive = false;
    };
  }, [activityId]);

  if (!items || items.length === 0) return null;
  const rated = items.filter((e) => e.myRating).length;

  return (
    <section className="xb-rate" aria-labelledby="xb-rate-title">
      <div className="xb-rate-head">
        <div>
          <h2 id="xb-rate-title" className="mda-h2">Note des exercices</h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            {canRate
              ? "Rapport des 24 heures : 5 critères, 30 secondes par exercice. Deux éducateurs à 8 ou plus = exercice approuvé ; sous 8, il sera changé."
              : "Après la séance, tu noteras ici chaque exercice utilisé (30 secondes par exercice)."}
          </p>
        </div>
        {canRate ? <span className="mda-pill" data-tone={rated === items.length ? "good" : "warn"}>{rated}/{items.length} notés</span> : null}
      </div>
      <ul className="xb-rate-list">
        {items.map((e) => (
          <ExerciseRow
            key={e.exerciseId}
            item={e}
            activityId={activityId}
            canRate={canRate}
            open={openId === e.exerciseId}
            onToggle={() => setOpenId(openId === e.exerciseId ? null : e.exerciseId)}
            onSaved={(updated) => {
              const next = items.map((x) => (x.exerciseId === updated.exerciseId ? updated : x));
              setItems(next);
              setOpenId(next.find((x) => !x.myRating)?.exerciseId ?? null);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function ExerciseRow({ item, activityId, canRate, open, onToggle, onSaved }: { item: ExerciseToRate; activityId: string; canRate: boolean; open: boolean; onToggle: () => void; onSaved: (e: ExerciseToRate) => void }) {
  const [scores, setScores] = useState<Partial<RatingScores>>(item.myRating?.scores ?? {});
  const [comment, setComment] = useState(item.myRating?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = RATING_CRITERIA.every((c) => scores[c.key] !== undefined);
  const total = RATING_CRITERIA.reduce((s, c) => s + (scores[c.key] ?? 0), 0);
  const low = complete && total < APPROVAL_SCORE;
  const needsComment = low && comment.trim().length < 10;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/activities/${activityId}/exercise-ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId: item.exerciseId, scores, comment: comment.trim() || null })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "La note n'a pas été enregistrée. Réessaie.");
        return;
      }
      onSaved({ ...item, myRating: { scores: scores as RatingScores, total, comment: comment.trim() || null }, bank: data.bank ?? item.bank });
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="xb-rate-item">
      <button type="button" className="xb-rate-row" onClick={onToggle} aria-expanded={open} disabled={!canRate}>
        <span className="xb-rate-name">
          <strong>{item.title}</strong>
          <span className="mda-muted">
            {item.blockTypes.join(", ")} · v{item.version}
            {item.objective ? ` · ${item.objective}` : ""}
          </span>
        </span>
        {item.myRating ? (
          <span className="xb-rate-score" data-low={item.myRating.total < APPROVAL_SCORE || undefined}>
            {item.myRating.total}
            <small>/10</small>
          </span>
        ) : canRate ? (
          <span className="mda-pill" data-tone="warn">À noter</span>
        ) : (
          <span className="mda-pill" data-tone={STATUS_TONE[item.bank.status]}>{STATUS_LABEL[item.bank.status]}</span>
        )}
      </button>

      {open && canRate ? (
        <div className="xb-rate-form">
          {RATING_CRITERIA.map((c) => (
            <div key={c.key} className="xb-crit">
              <span className="xb-crit-label">{c.label}</span>
              <div className="xb-seg" role="radiogroup" aria-label={c.label}>
                {SCORE_LABELS.map((label, value) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={scores[c.key] === value}
                    data-on={scores[c.key] === value || undefined}
                    data-v={value}
                    onClick={() => setScores((prev) => ({ ...prev, [c.key as RatingCriterion]: value as 0 | 1 | 2 }))}
                  >
                    {label}
                    <small>{value}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <textarea
            className="admin-input"
            rows={3}
            placeholder={low ? "Sous 8 : qu'est-ce qu'il faut changer ? (obligatoire)" : "Ce qui a marché, ce qu'il faut changer, adaptations (facultatif)"}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: "100%" }}
          />
          <div className="xb-rate-foot">
            <span className="xb-rate-total" data-low={low || undefined}>
              {complete ? `${total}/10` : `${RATING_CRITERIA.filter((c) => scores[c.key] !== undefined).length}/5 critères`}
              {low ? <small> · l’exercice passera « à changer »</small> : null}
            </span>
            <button type="button" className="admin-btn-primary" onClick={save} disabled={saving || !complete || needsComment}>
              {saving ? "Enregistrement…" : item.myRating ? "Mettre à jour" : "Enregistrer la note"}
            </button>
          </div>
          {error ? <p className="xb-error">{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
