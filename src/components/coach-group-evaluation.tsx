"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff } from "lucide-react";

import { countWords, NOTE_MIN_WORDS, QUICK_CRITERIA } from "@/lib/coach-report";
import type { PlayerEvaluation, RosterPlayer } from "@/lib/coach-portal-repo";

/** Rapport plus simple et plus fluide (JP, 27 nov. 2026) : au lieu d'ouvrir chaque fille une à une, l'éducateur note
 *  tout le groupe d'un coup, un critère à la fois (Ball mastery, Prestation, Attitude, puis chaque geste du jour),
 *  puis dicte la note de chaque fille au micro. Rien à enregistrer à la main : chaque fille part au serveur dès qu'elle
 *  est complète, et le brouillon reste sur l'appareil en attendant. Mêmes règles que l'évaluation fille par fille
 *  (api/coach/evaluations : 3 notes de 1 à 5, gestes de 1 à 10, note de 25 mots, pas de copier-coller). */

type SpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const speechCtor = (): SpeechCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Bouton micro : parle, le texte s'ajoute à la note (français du Québec). Caché si le navigateur ne sait pas faire. */
export function DictateButton({ onText, label = "Dicter" }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<InstanceType<SpeechCtor> | null>(null);
  useEffect(() => setSupported(Boolean(speechCtor())), []);
  useEffect(() => () => rec.current?.stop(), []);
  if (!supported) return null;
  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "fr-CA";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      // Seulement les nouveaux morceaux de phrase (le micro reste ouvert tant qu'on parle).
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (t) onText(t);
      }
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };
  return (
    <button type="button" className="coach-secondary" onClick={toggle} aria-pressed={on} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, marginTop: 0, color: on ? "var(--adm-bad)" : undefined }}>
      {on ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
      {on ? "Arrêter" : label}
    </button>
  );
}

const joinText = (prev: string, add: string) => {
  const p = prev.trimEnd();
  const a = add.charAt(0).toUpperCase() + add.slice(1);
  return p ? `${p}${/[.!?]$/.test(p) ? "" : "."} ${a}` : a;
};

interface Draft {
  ratings: Record<string, number>;
  scores: Record<string, number>;
  note: string;
}

type Status = "draft" | "saving" | "saved" | "error";

export function CoachGroupEvaluation({
  activityId,
  activityDate,
  players,
  mine,
  gestureChoices,
  bmSkipped,
  onSaved
}: {
  activityId: string;
  activityDate: string;
  players: RosterPlayer[];
  mine: Record<string, PlayerEvaluation>;
  gestureChoices: string[];
  bmSkipped: boolean;
  onSaved: (ev: PlayerEvaluation) => void;
}) {
  const storeKey = `nv-eval-groupe-${activityId}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const base: Record<string, Draft> = {};
    for (const p of players) {
      const m = mine[p.registrationId];
      base[p.registrationId] = { ratings: { ...(m?.ratings ?? {}) }, scores: { ...(m?.gesture_scores ?? {}) }, note: m?.comment ?? "" };
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? "{}") as Record<string, Draft>;
      for (const [id, d] of Object.entries(saved)) if (base[id] && !mine[id]) base[id] = d;
    } catch {
      /* stockage indisponible */
    }
    return base;
  });
  const [status, setStatus] = useState<Record<string, Status>>(() => Object.fromEntries(players.map((p) => [p.registrationId, mine[p.registrationId] ? "saved" : "draft"])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedSig = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      localStorage.setItem(storeKey, JSON.stringify(drafts));
    } catch {
      /* rien */
    }
  }, [drafts, storeKey]);

  const complete = (d: Draft) => QUICK_CRITERIA.every((c) => d.ratings[c] >= 1) && countWords(d.note) >= NOTE_MIN_WORDS && (bmSkipped || gestureChoices.every((g) => d.scores[g]));

  const save = async (id: string, d: Draft) => {
    const sig = JSON.stringify(d);
    if (savedSig.current[id] === sig) return;
    setStatus((s) => ({ ...s, [id]: "saving" }));
    const res = await fetch("/api/coach/evaluations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activityId, registrationId: id, ratings: d.ratings, comment: d.note, gestureScores: bmSkipped ? {} : d.scores })
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setStatus((s) => ({ ...s, [id]: "error" }));
      setErrors((e) => ({ ...e, [id]: data?.error ?? "Pas enregistrée (réseau). Elle repart dès que tu touches sa note." }));
      return;
    }
    savedSig.current[id] = sig;
    setStatus((s) => ({ ...s, [id]: "saved" }));
    setErrors((e) => ({ ...e, [id]: "" }));
    onSaved({ id: mine[id]?.id ?? "", activity_id: activityId, registration_id: id, coach_id: "", ratings: data.ratings, comment: data.comment, gestures: data.gestures ?? [], gesture_scores: data.gestureScores ?? d.scores, created_at: new Date().toISOString() });
  };

  const update = (id: string, patch: (d: Draft) => Draft) => {
    setDrafts((all) => {
      const next = patch(all[id]);
      clearTimeout(timers.current[id]);
      if (complete(next)) timers.current[id] = setTimeout(() => save(id, next), 1200);
      else setStatus((s) => ({ ...s, [id]: s[id] === "saved" ? "draft" : s[id] }));
      return { ...all, [id]: next };
    });
  };

  const first = (p: RosterPlayer) => p.firstName.trim().replace(/^./, (c) => c.toUpperCase());
  const doneCount = players.filter((p) => status[p.registrationId] === "saved").length;
  const rows = (label: string, help: string, max: number, get: (d: Draft) => number | undefined, set: (d: Draft, v: number) => Draft) => (
    <section key={label} className="coach-card" style={{ marginBottom: 12 }}>
      <p className="coach-field__label" style={{ marginBottom: 8 }}>
        {label}
        <span>{help}</span>
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {players.map((p) => {
          const v = get(drafts[p.registrationId]);
          return (
            <div key={p.registrationId} style={{ display: "grid", gridTemplateColumns: "minmax(72px, 110px) 1fr", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first(p)}</span>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))`, gap: 4 }} role="radiogroup" aria-label={`${label} : ${first(p)}`}>
                {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={v === n}
                    onClick={() => update(p.registrationId, (d) => set(d, n))}
                    style={{
                      minHeight: 38,
                      borderRadius: 8,
                      padding: 0,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: v === n ? "2px solid var(--adm-accent)" : "1px solid var(--adm-line)",
                      background: v === n ? (max === 10 ? `hsl(${Math.round(((n - 1) / 9) * 120)}, 65%, 45%)` : "var(--adm-accent)") : "var(--adm-surface)",
                      color: v === n ? "var(--adm-on-accent)" : "var(--adm-text)"
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div>
      <p className="coach-muted" style={{ margin: "0 0 12px" }}>
        Un critère à la fois pour tout le groupe, puis la note de chaque fille (dicte-la au micro). Chaque fille s&apos;enregistre toute seule dès qu&apos;elle est complète · {doneCount}/{players.length} enregistrées.
      </p>
      {QUICK_CRITERIA.map((c) =>
        rows(c, "1 = à travailler · 5 = excellent", 5, (d) => d.ratings[c], (d, v) => ({ ...d, ratings: { ...d.ratings, [c]: v } }))
      )}
      {!bmSkipped && gestureChoices.map((g) => rows(`Geste : ${g}`, "1 = incapable · 10 = parfait · 4 ou moins = à retravailler", 10, (d) => d.scores[g], (d, v) => ({ ...d, scores: { ...d.scores, [g]: v } })))}

      <section className="coach-card" style={{ marginBottom: 12 }}>
        <p className="coach-field__label" style={{ marginBottom: 8 }}>
          La note de chaque fille
          <span>{NOTE_MIN_WORDS} mots : comment elle était, comment elle progresse, un exemple vu à la pratique</span>
        </p>
        <div style={{ display: "grid", gap: 14 }}>
          {players.map((p) => {
            const id = p.registrationId;
            const d = drafts[id];
            const words = countWords(d.note);
            const st = status[id];
            return (
              <div key={id} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>
                    {first(p)} {p.lastName.trim().charAt(0)}.
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className="coach-muted" style={{ margin: 0, color: words >= NOTE_MIN_WORDS ? "var(--adm-good)" : undefined }}>{words}/{NOTE_MIN_WORDS} mots</span>
                    {st === "saved" ? (
                      <span className="coach-pill" data-tone="good" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={14} aria-hidden /> Enregistrée</span>
                    ) : st === "saving" ? (
                      <span className="coach-pill">Enregistrement…</span>
                    ) : (
                      <span className="coach-pill" data-tone="warn">{complete(d) ? "Prête" : "À compléter"}</span>
                    )}
                  </span>
                </div>
                <textarea
                  className="coach-textarea"
                  value={d.note}
                  placeholder={`Observation de ${first(p)} (touche « Dicter » et parle)`}
                  onChange={(e) => update(id, (x) => ({ ...x, note: e.target.value }))}
                  onPaste={(e) => {
                    e.preventDefault();
                    setErrors((er) => ({ ...er, [id]: `Le copier-coller est désactivé : écris ou dicte une note propre à ${first(p)}.` }));
                  }}
                  onDrop={(e) => e.preventDefault()}
                  style={{ minHeight: 70 }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <DictateButton onText={(t) => update(id, (x) => ({ ...x, note: joinText(x.note, t) }))} />
                  {st === "error" && complete(d) ? (
                    <button type="button" className="coach-secondary" style={{ marginTop: 0 }} onClick={() => save(id, d)}>Réessayer</button>
                  ) : null}
                </div>
                {errors[id] ? <p className="coach-error" role="alert" style={{ margin: 0 }}>{errors[id]}</p> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
