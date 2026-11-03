"use client";

import { useRef, useState } from "react";

import { FATIGUE, isAnswered, NOTE_MAX, PLEASURE, SCALE_VALUES, summarizeSurvey, WANTS_MORE, wantsLabel, type Scale, type SurveyAnswer } from "@/lib/practice-survey";

export interface SurveyPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  isTrial?: boolean;
}

export type SurveyPresence = "present" | "absent" | "injured" | "late" | "left_early";
const HERE: SurveyPresence[] = ["present", "late", "left_early"];
const EMPTY: SurveyAnswer = { practiceRating: null, fatigue: null, wantsMore: [], wantsMoreNote: null };

async function post(url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return null;
  const data = await res?.json().catch(() => ({}));
  return data?.error ?? "Pas enregistré : vérifie le réseau et réessaie.";
}

const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));

function ScaleRow({ scale, value, onPick, name }: { scale: Scale; value: number | null; onPick: (v: number) => void; name: string }) {
  return (
    <div className="ps-row">
      <p className="ps-row-label">
        {scale.label} sur 10
        {value !== null ? <span>{value}/10</span> : null}
      </p>
      <div className="ps-scale" role="radiogroup" aria-label={`${scale.label} de ${name}, de 1 à 10`}>
        {SCALE_VALUES.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} data-active={String(value === v)} onClick={() => onPick(v)}>
            {v}
          </button>
        ))}
      </div>
      <p className="ps-scale-ends" aria-hidden>
        <span>1 {scale.low}</span>
        <span>{scale.high} 10</span>
      </p>
    </div>
  );
}

/** Sondage de fin de pratique : la présence (facultative), puis pour chaque fille présente son plaisir, sa fatigue
 *  et ce qu'elle aimerait avoir plus. Chaque touche est enregistrée tout de suite. */
export function PracticeSurvey({
  activityId,
  players,
  initialPresence,
  initialAnswers,
  feedbackUrl,
  attendanceUrl,
  onAnswersChange
}: {
  activityId: string;
  players: SurveyPlayer[];
  initialPresence: Record<string, SurveyPresence>;
  initialAnswers: Record<string, SurveyAnswer>;
  feedbackUrl: string;
  /** Sans adresse de présence, le sondage ne montre que les filles déjà marquées présentes (portail : étape Pendant). */
  attendanceUrl?: string;
  onAnswersChange?: (answers: Record<string, SurveyAnswer>) => void;
}) {
  const [presence, setPresence] = useState(initialPresence);
  const [answers, setAnswers] = useState(initialAnswers);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const withPresence = Boolean(attendanceUrl);
  const shown = withPresence ? players : players.filter((p) => HERE.includes(presence[p.registrationId]));
  const here = shown.filter((p) => HERE.includes(presence[p.registrationId]));
  const [openId, setOpenId] = useState<string | null>(() => here.find((p) => !isAnswered(initialAnswers[p.registrationId]))?.registrationId ?? null);
  const answered = here.filter((p) => isAnswered(answers[p.registrationId])).length;
  const unmarked = players.filter((p) => !presence[p.registrationId]);

  const summary = summarizeSurvey(
    here.map((p) => {
      const a = answers[p.registrationId] ?? EMPTY;
      return { practice_rating: a.practiceRating, fatigue: a.fatigue, wants_more: a.wantsMore, wants_more_note: a.wantsMoreNote };
    })
  );

  // Touches rapides : chaque changement part de la dernière réponse connue, et les envois d'une même fille
  // partent l'un après l'autre (le dernier gagne toujours en base).
  const latest = useRef(answers);
  const queue = useRef<Record<string, Promise<void>>>({});
  const apply = (all: Record<string, SurveyAnswer>) => {
    latest.current = all;
    setAnswers(all);
    onAnswersChange?.(all);
  };
  const save = (id: string, patch: Partial<SurveyAnswer>) => {
    const prev = latest.current[id] ?? EMPTY;
    const next = { ...prev, ...patch };
    apply({ ...latest.current, [id]: next });
    queue.current[id] = (queue.current[id] ?? Promise.resolve()).then(async () => {
      const err = await post(feedbackUrl, { activityId, registrationId: id, ...next });
      if (err && latest.current[id] === next) apply({ ...latest.current, [id]: prev });
      setError(err);
    });
  };

  const mark = async (ids: string[], status: SurveyPresence) => {
    if (!attendanceUrl) return;
    setBusy(true);
    const err = await post(attendanceUrl, { activityId, registrationIds: ids, status });
    setBusy(false);
    setError(err);
    if (err) return;
    setPresence((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, status])) }));
    if (status === "present" && !openId) setOpenId(ids.find((id) => !isAnswered(latest.current[id])) ?? null);
  };

  const next = (afterId: string) => {
    const order = here.map((p) => p.registrationId);
    const i = order.indexOf(afterId);
    setOpenId(order.slice(i + 1).concat(order.slice(0, i)).find((id) => !isAnswered(answers[id])) ?? null);
  };

  if (players.length === 0) return <p className="ps-empty">Aucune joueuse attendue à cette pratique.</p>;

  return (
    <div className="ps">
      <div className="ps-summary">
        <div>
          <p className="ps-big">
            {answered}
            <span> sur {here.length} présente{here.length > 1 ? "s" : ""} {answered > 1 ? "ont" : "a"} répondu</span>
          </p>
          <div className="ps-progress" aria-hidden>
            <div style={{ width: `${here.length ? (answered / here.length) * 100 : 0}%` }} />
          </div>
        </div>
        {summary.answered > 0 && (
          <dl className="ps-stats">
            <div><dt>Plaisir</dt><dd>{fr(summary.pleasure)}/10</dd></div>
            <div><dt>Fatigue</dt><dd>{fr(summary.fatigue)}/10</dd></div>
            {summary.wants.length > 0 && (
              <div className="ps-stats-wide">
                <dt>Elles veulent plus de</dt>
                <dd>{summary.wants.slice(0, 3).map((w) => `${w.label} (${w.count})`).join(" · ")}</dd>
              </div>
            )}
          </dl>
        )}
        {withPresence && unmarked.length > 0 && (
          <button type="button" className="ps-primary" disabled={busy} onClick={() => mark(unmarked.map((p) => p.registrationId), "present")}>
            {busy ? "Enregistrement…" : unmarked.length === players.length ? `Toutes présentes (${players.length})` : `Les ${unmarked.length} autres sont présentes`}
          </button>
        )}
        {error && <p className="ps-error" role="alert">{error}</p>}
      </div>

      {!withPresence && shown.length === 0 && <p className="ps-empty">Marque d&apos;abord les présences : le sondage se fait avec les filles présentes.</p>}

      <ul className="ps-list">
        {shown.map((p) => {
          const id = p.registrationId;
          const status = presence[id];
          const isHere = HERE.includes(status);
          const a = answers[id] ?? EMPTY;
          const done = isAnswered(a);
          const open = isHere && openId === id;
          const name = `${p.firstName} ${p.lastName}`.trim();
          return (
            <li key={id} className="ps-player" data-open={String(open)} data-absent={String(status === "absent" || status === "injured")}>
              <div className="ps-head">
                <button type="button" className="ps-name" onClick={() => isHere && setOpenId(open ? null : id)} aria-expanded={isHere ? open : undefined} disabled={!isHere}>
                  {p.photoUrl ? <img src={p.photoUrl} alt="" className="ps-avatar" /> : <span className="ps-avatar" aria-hidden>{p.firstName[0] ?? "?"}</span>}
                  <span className="ps-name-text">
                    <strong>{name}</strong>
                    <small>
                      {!status
                        ? "Présence à marquer"
                        : !isHere
                          ? status === "injured" ? "Blessée" : "Absente"
                          : done
                            ? [a.practiceRating != null && `Plaisir ${a.practiceRating}/10`, a.fatigue != null && `fatigue ${a.fatigue}/10`, a.wantsMore.length ? `plus de ${a.wantsMore.map(wantsLabel).join(", ").toLowerCase()}` : null].filter(Boolean).join(" · ")
                            : "À sonder"}
                      {p.isTrial ? " · essai" : ""}
                    </small>
                  </span>
                  {isHere && done && <span className="ps-check" aria-label="Sondage fait">✓</span>}
                </button>
                {withPresence && (
                  <div className="ps-presence" role="group" aria-label={`Présence de ${name}`}>
                    <button type="button" data-active={String(isHere)} disabled={busy} onClick={() => mark([id], "present")}>Présente</button>
                    <button type="button" data-active={String(status === "absent")} data-tone="bad" disabled={busy} onClick={() => mark([id], "absent")}>Absente</button>
                  </div>
                )}
              </div>

              {open && (
                <div className="ps-body">
                  <ScaleRow scale={PLEASURE} value={a.practiceRating} name={p.firstName} onPick={(v) => save(id, { practiceRating: v })} />
                  <ScaleRow scale={FATIGUE} value={a.fatigue} name={p.firstName} onPick={(v) => save(id, { fatigue: v })} />
                  <div className="ps-row">
                    <p className="ps-row-label">J&apos;aimerais avoir plus de… <span>facultatif</span></p>
                    <div className="ps-chips">
                      {WANTS_MORE.map((w) => {
                        const on = a.wantsMore.includes(w.key);
                        return (
                          <button key={w.key} type="button" aria-pressed={on} data-on={String(on)} onClick={() => {
                              const cur = latest.current[id]?.wantsMore ?? [];
                              save(id, { wantsMore: cur.includes(w.key) ? cur.filter((k) => k !== w.key) : [...cur, w.key] });
                            }}>
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                    <NoteInput key={`${id}-${a.wantsMoreNote ?? ""}`} initial={a.wantsMoreNote ?? ""} onSave={(note) => save(id, { wantsMoreNote: note || null })} />
                  </div>
                  <button type="button" className="ps-next" disabled={!done} onClick={() => next(id)}>
                    {done ? "Suivante →" : "Plaisir et fatigue d'abord"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {summary.notes.length > 0 && (
        <div className="ps-notes">
          <p className="ps-row-label">Leurs mots</p>
          <ul>{summary.notes.map((n, i) => <li key={i}>« {n} »</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function NoteInput({ initial, onSave }: { initial: string; onSave: (note: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      className="ps-note"
      value={value}
      maxLength={NOTE_MAX}
      placeholder="Autre chose ? (ex. jeux de poursuite)"
      aria-label="Autre chose qu'elle aimerait"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() !== initial.trim() && onSave(value.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Ouvre le sondage d'une pratique de l'horaire qui n'a pas encore d'activité (espace Coaching). */
export function OpenSurveyButton({ practiceKey, label }: { practiceKey: string; label: string }) {
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const open = async () => {
    setState({ busy: true });
    const res = await fetch("/api/admin/coaching/sondage/ouvrir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: practiceKey }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.activityId) return setState({ busy: false, error: data?.error ?? "Impossible d'ouvrir : réessaie." });
    window.location.href = `/admin/coaching/sondage/${data.activityId}`;
  };
  return (
    <>
      <button type="button" className="admin-btn-primary" onClick={open} disabled={state.busy} style={{ whiteSpace: "nowrap" }}>
        {state.busy ? "Ouverture…" : label}
      </button>
      {state.error && <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.8rem" }}>{state.error}</span>}
    </>
  );
}
