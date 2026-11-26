"use client";

import { Check, CircleHelp, Lightbulb, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { dequeue, enqueue, parsePresenceQueue, parseQueue, presenceKey, queueKey, sendOutcome, type QueuedAnswer, type QueuedPresence } from "@/lib/kiosk-queue";
import { KIOSK_QUESTIONS, SCALE_VALUES, type KioskQuestion } from "@/lib/practice-survey";
import { isThemeCorrect, THEME_FAIL_LABEL, THEME_PASS_PCT, themeVerdict, type ThemeQuiz } from "@/lib/theme-quiz-core";

/** Borne de sondage sur l'iPad : la joueuse touche sa photo, répond aux 4 questions (une par écran : plaisir et
 *  fatigue sur 10, puis l'aide de sa coach et l'aide des autres, oui / non et qui), puis la
 *  borne revient à la liste pour la suivante. Grands boutons, mots d'enfant, aucun clavier. Une fille qui a fini
 *  disparaît de la liste (personne ne peut revoir ni changer ses réponses) ; elle peut seulement les réviser tout de
 *  suite, sur l'écran « Merci », avant que la borne revienne à la liste.
 *  Hors ligne (JP, 17 nov. 2026) : une fois la page ouverte, tout marche sans réseau. Chaque réponse est gardée sur
 *  l'iPad (file d'attente, kiosk-queue.ts) et part toute seule dès que le réseau revient. */

interface KioskPlayer {
  id: string;
  first: string;
  initial: string;
  photo: string | null;
}

interface Answers {
  practiceRating?: number;
  fatigue?: number;
  coachHelped?: boolean;
  coachHelpers?: string[];
  peerHelped?: boolean;
  peerHelpers?: string[];
  /** « Qu'est-ce qu'on a travaillé aujourd'hui ? » : le choix touché (un des 3). */
  themeAnswer?: string;
}

/** La 5e question, posée seulement quand la pratique a un thème (JP, 25 nov. 2026). La fille ne voit jamais si elle
 *  a bon : les éducateurs le voient dans « Qui a compris le thème ». */
type Question = KioskQuestion | { kind: "theme"; question: string };
const THEME_QUESTION: Question = { kind: "theme", question: "Qu'est-ce qu'on a travaillé aujourd'hui\u00a0?" };

const HELP = { coach: { flag: "coachHelped", list: "coachHelpers" }, peer: { flag: "peerHelped", list: "peerHelpers" } } as const;
const GREEN = "#1f7a4d";

const PURPLE = "#5b2a86";
// Du rouge au vert : la couleur aide les plus jeunes à comprendre l'échelle.
const color = (v: number) => `hsl(${Math.round(((v - 1) / 9) * 120)}, 70%, 45%)`;

export function SurveyKiosk({ activityId, cle, title, players, coaches = [], done: initialDone, absent: initialAbsent = [], themeQuiz = null, themeResults: initialThemeResults = {} }: { activityId: string; cle: string; title: string; players: KioskPlayer[]; coaches?: { id: string; first: string }[]; done: string[]; absent?: string[]; themeQuiz?: ThemeQuiz | null; themeResults?: Record<string, boolean> }) {
  const questions: Question[] = themeQuiz ? [...KIOSK_QUESTIONS, THEME_QUESTION] : KIOSK_QUESTIONS;
  // Qui a compris le thème : ce qui est déjà en base, plus les réponses de cet iPad (même hors réseau).
  const [themeResults, setThemeResults] = useState<Record<string, boolean>>(initialThemeResults);
  const [showResults, setShowResults] = useState(false);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTheme = useCallback(
    (items: { registrationId: string; answers: Record<string, unknown> }[]) => {
      if (!themeQuiz) return;
      const add: Record<string, boolean> = {};
      for (const it of items) if (typeof it.answers.themeAnswer === "string") add[it.registrationId] = isThemeCorrect(it.answers.themeAnswer, themeQuiz.correct);
      if (Object.keys(add).length) setThemeResults((r) => ({ ...r, ...add }));
    },
    [themeQuiz]
  );
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  // Absentes : marquées dans MonClubSportif (X) ou touchées ici ; elles sortent de la liste et se remettent d'un clic.
  const [absent, setAbsent] = useState<Set<string>>(new Set(initialAbsent));
  const presenceRef = useRef<QueuedPresence[]>([]);
  const [who, setWho] = useState<KioskPlayer | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // « Oui » à une question d'aide : l'écran pour choisir qui.
  const [picking, setPicking] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "thanks">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<QueuedAnswer[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [online, setOnline] = useState(true);
  const queueRef = useRef<QueuedAnswer[]>([]);
  const flushing = useRef(false);

  const persist = useCallback(
    (q: QueuedAnswer[]) => {
      queueRef.current = q;
      setPending(q);
      try {
        localStorage.setItem(queueKey(activityId), JSON.stringify(q));
      } catch {
        /* stockage indisponible : la réponse reste en mémoire tant que la page est ouverte */
      }
    },
    [activityId]
  );

  const persistPresence = useCallback(
    (q: QueuedPresence[]) => {
      presenceRef.current = q;
      try {
        localStorage.setItem(presenceKey(activityId), JSON.stringify(q));
      } catch {
        /* stockage indisponible : la présence reste en mémoire tant que la page est ouverte */
      }
    },
    [activityId]
  );

  /** Envoie les réponses gardées sur l'iPad, une à la fois ; s'arrête au premier échec réseau (on réessaie plus tard). */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of [...presenceRef.current]) {
        const res = await fetch(`/api/borne/${activityId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cle, registrationId: item.registrationId, presence: item.status }) }).catch(() => null);
        if (sendOutcome(res ? res.status : null) === "retry") break;
        persistPresence(dequeue(presenceRef.current, item));
      }
      for (const item of [...queueRef.current]) {
        const res = await fetch(`/api/borne/${activityId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cle, registrationId: item.registrationId, ...item.answers }) }).catch(() => null);
        const outcome = sendOutcome(res ? res.status : null);
        if (outcome === "retry") break;
        if (outcome === "rejected") {
          const data = await res?.json().catch(() => null);
          const name = players.find((p) => p.id === item.registrationId)?.first ?? "Une joueuse";
          setRejected((r) => [...r, `${name} : ${data?.error ?? "réponse refusée"}`]);
        }
        persist(dequeue(queueRef.current, item));
      }
    } finally {
      flushing.current = false;
    }
  }, [activityId, cle, players, persist, persistPresence]);

  // Au chargement : les réponses restées sur l'iPad (page rechargée) comptent comme faites et repartent.
  useEffect(() => {
    let saved: QueuedAnswer[] = [];
    try {
      saved = parseQueue(localStorage.getItem(queueKey(activityId)));
    } catch {
      saved = [];
    }
    if (saved.length) {
      persist(saved);
      noteTheme(saved);
      setDone((d) => new Set([...d, ...saved.map((q) => q.registrationId)]));
    }
    let marks: QueuedPresence[] = [];
    try {
      marks = parsePresenceQueue(localStorage.getItem(presenceKey(activityId)));
    } catch {
      marks = [];
    }
    if (marks.length) {
      persistPresence(marks);
      setAbsent((a) => {
        const next = new Set(a);
        for (const m of marks) m.status === "absent" ? next.add(m.registrationId) : next.delete(m.registrationId);
        return next;
      });
    }
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    void flush();
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  /** « Absente » (ou remise) : gardé sur l'iPad d'abord, envoyé ensuite ; marche sans réseau. */
  const markPresence = (id: string, status: "absent" | "present") => {
    setAbsent((a) => {
      const next = new Set(a);
      status === "absent" ? next.add(id) : next.delete(id);
      return next;
    });
    persistPresence(enqueue(presenceRef.current, { registrationId: id, status, at: Date.now() }));
    void flush();
  };

  // Tant qu'il reste des réponses à envoyer : un essai toutes les 15 secondes.
  useEffect(() => {
    if (!pending.length && !presenceRef.current.length) return;
    const t = setInterval(() => void flush(), 15000);
    return () => clearInterval(t);
  }, [pending.length, flush]);

  const reset = () => {
    setWho(null);
    setStep(0);
    setAnswers({});
    setPicking(false);
    setState("idle");
    setError(null);
  };

  // Une fille qui part sans finir : la borne revient seule à la liste après 60 secondes.
  useEffect(() => {
    if (!who) return;
    const t = setTimeout(reset, state === "thanks" ? 8000 : 60000);
    return () => clearTimeout(t);
  }, [who, step, state, picking, answers]);

  /** Question suivante, ou fin : la réponse est d'abord gardée sur l'iPad, puis envoyée (sans réseau, elle partira
   *  toute seule plus tard). */
  const advance = (next: Answers) => {
    setAnswers(next);
    setPicking(false);
    if (step < questions.length - 1) {
      setStep(step + 1);
      return;
    }
    persist(enqueue(queueRef.current, { registrationId: who!.id, answers: { ...next } as Record<string, unknown>, at: Date.now() }));
    noteTheme([{ registrationId: who!.id, answers: { ...next } }]);
    setDone(new Set([...done, who!.id]));
    setState("thanks");
    void flush();
  };

  const pick = (v: number) => {
    const q = questions[step];
    if (q.kind === "scale") advance({ ...answers, [q.field]: v });
  };

  /** Les personnes à proposer : les coachs de la pratique, ou les autres filles présentes (avec leur photo). */
  const helpOptions = (field: "coach" | "peer"): { id: string; label: string; photo: string | null }[] =>
    field === "coach"
      ? coaches.map((c) => ({ id: c.id, label: c.first, photo: null }))
      : players.filter((p) => p.id !== who?.id && !absent.has(p.id)).map((p) => ({ id: p.id, label: `${p.first} ${p.initial}.`, photo: p.photo }));

  const answerHelp = (field: "coach" | "peer", yes: boolean) => {
    const { flag, list } = HELP[field];
    const options = helpOptions(field);
    if (!yes) return advance({ ...answers, [flag]: false, [list]: [] });
    // Une seule coach : c'est elle ; personne à proposer : le « oui » suffit.
    if (options.length <= 1) return advance({ ...answers, [flag]: true, [list]: options.map((o) => o.id) });
    setAnswers({ ...answers, [flag]: true, [list]: answers[flag] ? answers[list] ?? [] : [] });
    setPicking(true);
  };

  const toggleHelper = (field: "coach" | "peer", id: string) => {
    const { list } = HELP[field];
    const cur = answers[list] ?? [];
    setAnswers({ ...answers, [list]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  const card: React.CSSProperties = { background: "#fff", borderRadius: 20, border: "1px solid #e6e0ee", padding: "1.4rem" };

  if (!who && showResults && themeQuiz) {
    // Pour l'éducatrice : qui a compris le thème. Seules les filles là aujourd'hui (absentes exclues).
    const here = players.filter((p) => !absent.has(p.id) || done.has(p.id));
    const cols: { key: string; label: string; icon: React.ReactNode; tone: string; soft: string; list: KioskPlayer[] }[] = [
      { key: "ok", label: "A compris", icon: <Check size={20} aria-hidden />, tone: "var(--adm-good, #1f7a4d)", soft: "var(--adm-good-soft, #e8f5ee)", list: here.filter((p) => themeResults[p.id] === true) },
      { key: "ko", label: "N'a pas compris", icon: <X size={20} aria-hidden />, tone: "var(--adm-bad, #b3261e)", soft: "var(--adm-bad-soft, #fdecea)", list: here.filter((p) => themeResults[p.id] === false) },
      { key: "na", label: "Pas répondu", icon: <CircleHelp size={20} aria-hidden />, tone: "var(--adm-text-2, #5d566b)", soft: "var(--adm-surface-2, #f4f0f8)", list: here.filter((p) => themeResults[p.id] === undefined) }
    ];
    const answered = cols[0].list.length + cols[1].list.length;
    const verdict = themeVerdict(answered ? Math.round((cols[0].list.length / answered) * 100) : null);
    return (
      <div style={{ display: "grid", gap: 16, fontFamily: "var(--adm-font, inherit)" }}>
        <div style={{ ...card, display: "grid", gap: 6 }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--adm-text-2, #5d566b)", fontWeight: 600 }}>
            <Lightbulb size={18} aria-hidden /> Pour l&apos;éducatrice · {title}
          </p>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: "var(--adm-text, #1d1730)" }}>Qui a compris le thème ?</h1>
          <p style={{ margin: 0, fontSize: "1.1rem", color: "var(--adm-text, #1d1730)" }}>
            Le thème : <strong>{themeQuiz.correct}</strong>
          </p>
          <p style={{ margin: 0, color: "var(--adm-text-2, #5d566b)" }}>
            {answered ? `${cols[0].list.length} sur ${answered} ont trouvé (${Math.round((cols[0].list.length / answered) * 100)} %).` : "Personne n'a encore répondu à cette question."} Autres choix proposés : {themeQuiz.choices.filter((c) => c !== themeQuiz.correct).join(" · ")}.
          </p>
          {verdict ? (
            <p style={{ margin: "4px 0 0", padding: "8px 12px", borderRadius: 10, fontWeight: 700, background: verdict === "echec" ? "var(--adm-bad-soft, #fdecea)" : "var(--adm-good-soft, #e8f5ee)", color: verdict === "echec" ? "var(--adm-bad, #b3261e)" : "var(--adm-good, #1f7a4d)" }}>
              {verdict === "echec" ? `${THEME_FAIL_LABEL} : moins de ${THEME_PASS_PCT} % des filles l'ont trouvé.` : `Thème compris : ${THEME_PASS_PCT} % ou plus des filles l'ont trouvé.`}
            </p>
          ) : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {cols.map((c) => (
            <section key={c.key} style={{ ...card, padding: "1rem", display: "grid", gap: 10, alignContent: "start" }}>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: "1.15rem", fontWeight: 800, color: c.tone }}>
                <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: "50%", background: c.soft }}>{c.icon}</span>
                {c.label} ({c.list.length})
              </h2>
              {c.list.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                  {c.list.map((p) => (
                    <li key={p.id} style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--adm-text, #1d1730)" }}>
                      {p.first} {p.initial}.
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: "var(--adm-text-3, #6b6478)" }}>Personne</p>
              )}
            </section>
          ))}
        </div>
        <button type="button" onClick={() => setShowResults(false)} style={{ minHeight: 60, borderRadius: 16, border: "none", background: `var(--adm-accent, ${PURPLE})`, color: "var(--adm-on-accent, #fff)", fontSize: "1.2rem", fontWeight: 800, cursor: "pointer" }}>
          Revenir au sondage
        </button>
      </div>
    );
  }

  if (!who) {
    const waiting = players.filter((p) => !done.has(p.id) && !absent.has(p.id));
    const away = players.filter((p) => absent.has(p.id) && !done.has(p.id));
    // Bouton de l'éducatrice : il faut le tenir 1 seconde (une fille qui le touche en passant ne voit rien).
    const holdStart = () => {
      if (holdRef.current) clearTimeout(holdRef.current);
      holdRef.current = setTimeout(() => setShowResults(true), 1000);
    };
    const holdEnd = () => {
      if (holdRef.current) clearTimeout(holdRef.current);
      holdRef.current = null;
    };
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ ...card, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#1d1730" }}>Comment était ta pratique ?</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#5d566b", fontSize: "1.05rem" }}>
            {title} · Touche ta photo ({done.size}/{players.length - away.length} ont répondu)
          </p>
        </div>
        {pending.length || !online ? (
          <div role="status" style={{ ...card, padding: "0.9rem 1.2rem", background: "#fff8e6", borderColor: "#f2d48a", color: "#6b4e00", fontWeight: 600, textAlign: "center" }}>
            {online ? "📶 Envoi en cours" : "📶 Pas de réseau : la borne continue de fonctionner"}
            {pending.length ? ` · ${pending.length} réponse${pending.length > 1 ? "s" : ""} gardée${pending.length > 1 ? "s" : ""} sur l'iPad, elle${pending.length > 1 ? "s partiront" : " partira"} toute${pending.length > 1 ? "s" : ""} seule${pending.length > 1 ? "s" : ""} dès que le réseau revient.` : "."}
            {pending.length ? <span style={{ display: "block", fontWeight: 400, marginTop: 4 }}>Ne ferme pas cette page avant que tout soit envoyé.</span> : null}
          </div>
        ) : null}
        {rejected.length ? (
          <div role="alert" style={{ ...card, padding: "0.9rem 1.2rem", borderColor: "#f1b5b0", color: "#b3261e" }}>
            Réponse non enregistrée : {rejected.join(" · ")}. Montre ce message à ton éducatrice.
          </div>
        ) : null}
        {waiting.length === 0 && done.size > 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "2.4rem 1.4rem" }}>
            <p style={{ fontSize: "3.2rem", margin: 0 }}>🎉</p>
            <h2 style={{ margin: "0.4rem 0 0", fontSize: "1.6rem", fontWeight: 800, color: PURPLE }}>Tout le monde a répondu. Merci !</h2>
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {waiting.map((p) => {
            const ok = false;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setWho(p)}
                style={{ ...card, padding: "1rem 0.6rem", display: "grid", justifyItems: "center", gap: 8, cursor: "pointer", opacity: ok ? 0.55 : 1, position: "relative", minHeight: 170 }}
              >
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <span style={{ width: 96, height: 96, borderRadius: "50%", background: "#efe7f7", color: PURPLE, display: "grid", placeItems: "center", fontSize: "2.2rem", fontWeight: 800 }}>{p.first.charAt(0)}</span>
                )}
                <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1d1730" }}>
                  {p.first} {p.initial}.
                </span>
                {ok ? <span style={{ position: "absolute", top: 10, right: 12, fontSize: "1.4rem" }}>✅</span> : null}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.first} est absente`}
                  onClick={(e) => {
                    e.stopPropagation();
                    markPresence(p.id, "absent");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      markPresence(p.id, "absent");
                    }
                  }}
                  style={{ position: "absolute", top: 6, right: 6, padding: "4px 8px", borderRadius: 999, background: "#f4f0f8", color: "#5d566b", fontSize: "0.8rem", fontWeight: 700 }}
                >
                  Absente
                </span>
              </button>
            );
          })}
        </div>
        {away.length ? (
          <div style={{ ...card, padding: "0.9rem 1.2rem", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#5d566b", fontWeight: 600 }}>Absentes :</span>
            {away.map((p) => (
              <button key={p.id} type="button" onClick={() => markPresence(p.id, "present")} style={{ minHeight: 40, padding: "0 12px", borderRadius: 999, border: "1px solid #e6e0ee", background: "#fff", color: "#1d1730", fontWeight: 600, cursor: "pointer" }} title="Elle est là finalement : la remettre">
                {p.first} {p.initial}. ↺
              </button>
            ))}
          </div>
        ) : null}
        {themeQuiz ? (
          <button
            type="button"
            onPointerDown={holdStart}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
            onContextMenu={(e) => e.preventDefault()}
            style={{ minHeight: 52, borderRadius: 14, border: "1px dashed var(--adm-border, #d9d2e3)", background: "transparent", color: "var(--adm-text-2, #5d566b)", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, userSelect: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}
          >
            <Lightbulb size={18} aria-hidden /> Éducatrice : tiens ce bouton 1 seconde pour voir qui a compris le thème
          </button>
        ) : null}
      </div>
    );
  }

  if (state === "thanks") {
    return (
      <div style={{ ...card, textAlign: "center", padding: "3rem 1.4rem", display: "grid", gap: 14, justifyItems: "center" }}>
        <p style={{ fontSize: "4rem", margin: 0 }}>🎉</p>
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: PURPLE }}>Merci {who.first} !</h1>
        <p style={{ color: "#5d566b", fontSize: "1.1rem", margin: 0 }}>Tes réponses sont gardées secrètes. Passe l&apos;iPad à la prochaine.</p>
        {pending.some((q) => q.registrationId === who.id) && !online ? <p style={{ color: "#6b4e00", fontSize: "0.95rem", margin: 0 }}>📶 Pas de réseau : tes réponses sont gardées sur l&apos;iPad et partiront toutes seules.</p> : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" onClick={() => (setStep(0), setPicking(false), setState("idle"))} style={{ minHeight: 56, padding: "0 22px", borderRadius: 14, border: `2px solid ${PURPLE}`, background: "#fff", color: PURPLE, fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}>
            ✏️ Changer mes réponses
          </button>
          <button type="button" onClick={reset} style={{ minHeight: 56, padding: "0 22px", borderRadius: 14, border: "none", background: PURPLE, color: "#fff", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}>
            J&apos;ai fini
          </button>
        </div>
      </div>
    );
  }

  const q = questions[step];
  const head = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <button type="button" onClick={() => (picking ? setPicking(false) : step ? setStep(step - 1) : reset())} style={{ background: "none", border: "none", color: PURPLE, fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", padding: 8 }}>
        ← {picking || step ? "Retour" : "Ce n'est pas moi"}
      </button>
      <span style={{ color: "#5d566b", fontWeight: 600 }}>
        {who.first} · question {step + 1} sur {questions.length}
      </span>
    </div>
  );

  if (q.kind === "theme") {
    return (
      <div style={{ ...card, display: "grid", gap: 18 }}>
        {head}
        <h1 style={{ margin: 0, fontSize: "1.9rem", lineHeight: 1.25, fontWeight: 800, color: "#1d1730", textAlign: "center" }}>{q.question}</h1>
        <p style={{ margin: "-6px 0 0", textAlign: "center", color: "#5d566b", fontSize: "1.05rem" }}>Touche une seule réponse.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {(themeQuiz?.choices ?? []).map((c) => {
            const on = answers.themeAnswer === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => advance({ ...answers, themeAnswer: c })}
                style={{ minHeight: 88, padding: "0.8rem 1.2rem", borderRadius: 18, border: on ? `4px solid var(--adm-accent, ${PURPLE})` : "1px solid var(--adm-border, #e6e0ee)", background: on ? "var(--adm-accent-soft, #f4ecfb)" : "var(--adm-surface, #fff)", color: "var(--adm-text, #1d1730)", fontSize: "1.45rem", lineHeight: 1.25, fontWeight: 800, cursor: "pointer", fontFamily: "var(--adm-font, inherit)" }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (q.kind === "help" && picking) {
    const chosen = answers[HELP[q.field].list] ?? [];
    const options = helpOptions(q.field);
    return (
      <div style={{ ...card, display: "grid", gap: 18 }}>
        {head}
        <h1 style={{ margin: 0, fontSize: "1.9rem", lineHeight: 1.25, fontWeight: 800, color: "#1d1730", textAlign: "center" }}>{q.pick}</h1>
        <p style={{ margin: "-6px 0 0", textAlign: "center", color: "#5d566b", fontSize: "1.05rem" }}>Tu peux en choisir plusieurs.</p>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${q.field === "coach" ? 170 : 130}px, 1fr))`, gap: 12 }}>
          {options.map((o) => {
            const on = chosen.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleHelper(q.field, o.id)}
                style={{ position: "relative", display: "grid", justifyItems: "center", gap: 8, padding: "1rem 0.6rem", minHeight: q.field === "coach" ? 150 : 150, borderRadius: 18, border: on ? `4px solid ${PURPLE}` : "1px solid #e6e0ee", background: on ? "#f4ecfb" : "#fff", cursor: "pointer" }}
              >
                {o.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.photo} alt="" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <span style={{ width: 80, height: 80, borderRadius: "50%", background: "#efe7f7", color: PURPLE, display: "grid", placeItems: "center", fontSize: "2rem", fontWeight: 800 }}>{o.label.charAt(0)}</span>
                )}
                <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1d1730" }}>{o.label}</span>
                {on ? <span aria-hidden style={{ position: "absolute", top: 8, right: 10, width: 30, height: 30, borderRadius: "50%", background: PURPLE, color: "#fff", display: "grid", placeItems: "center", fontSize: "1.1rem", fontWeight: 800 }}>✓</span> : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!chosen.length}
          onClick={() => advance(answers)}
          style={{ position: "sticky", bottom: 12, boxShadow: "0 6px 20px rgba(29, 23, 48, 0.18)", minHeight: 64, borderRadius: 16, border: "none", background: chosen.length ? PURPLE : "#d9d2e3", color: chosen.length ? "#fff" : "#5d566b", fontSize: "1.3rem", fontWeight: 800, cursor: chosen.length ? "pointer" : "default" }}
        >
          {chosen.length ? `C'est bon (${chosen.length})` : "Touche au moins une personne"}
        </button>
      </div>
    );
  }

  if (q.kind === "help") {
    const was = answers[HELP[q.field].flag];
    const big = (yes: boolean): React.CSSProperties => ({ minHeight: 120, borderRadius: 20, border: was === yes ? `4px solid ${PURPLE}` : "none", background: yes ? GREEN : "#5d566b", color: "#fff", fontSize: "2.2rem", fontWeight: 800, cursor: "pointer" });
    return (
      <div style={{ ...card, display: "grid", gap: 18 }}>
        {head}
        <h1 style={{ margin: 0, fontSize: "1.9rem", lineHeight: 1.25, fontWeight: 800, color: "#1d1730", textAlign: "center" }}>{q.question}</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <button type="button" onClick={() => answerHelp(q.field, true)} style={big(true)}>Oui</button>
          <button type="button" onClick={() => answerHelp(q.field, false)} style={big(false)}>Non</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...card, display: "grid", gap: 18 }}>
      {head}
      <h1 style={{ margin: 0, fontSize: "1.9rem", lineHeight: 1.25, fontWeight: 800, color: "#1d1730", textAlign: "center" }}>{q.question}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {SCALE_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            disabled={state === "saving"}
            onClick={() => pick(v)}
            style={{ minHeight: 76, borderRadius: 16, border: answers[q.field] === v ? `4px solid ${PURPLE}` : "none", background: color(q.field === "fatigue" ? 11 - v : v), color: "#fff", fontSize: "1.9rem", fontWeight: 800, cursor: "pointer" }}
          >
            {v}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#5d566b", fontSize: "1.05rem", fontWeight: 600 }}>
        <span>1 = {q.scale.low}</span>
        <span>10 = {q.scale.high}</span>
      </div>
      {state === "saving" ? <p style={{ textAlign: "center", color: "#5d566b", margin: 0 }}>J&apos;enregistre…</p> : null}
      {error ? <p style={{ textAlign: "center", color: "#b3261e", margin: 0, fontWeight: 600 }}>{error}</p> : null}
    </div>
  );
}
