"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { dequeue, enqueue, parseQueue, queueKey, sendOutcome, type QueuedAnswer } from "@/lib/kiosk-queue";
import { KIOSK_QUESTIONS, SCALE_VALUES } from "@/lib/practice-survey";

/** Borne de sondage sur l'iPad : la joueuse touche sa photo, répond à 5 questions sur 10 (une par écran), puis la
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

type Answers = Partial<Record<(typeof KIOSK_QUESTIONS)[number]["field"], number>>;

const PURPLE = "#5b2a86";
// Du rouge au vert : la couleur aide les plus jeunes à comprendre l'échelle.
const color = (v: number) => `hsl(${Math.round(((v - 1) / 9) * 120)}, 70%, 45%)`;

export function SurveyKiosk({ activityId, cle, title, players, done: initialDone }: { activityId: string; cle: string; title: string; players: KioskPlayer[]; done: string[] }) {
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [who, setWho] = useState<KioskPlayer | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
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

  /** Envoie les réponses gardées sur l'iPad, une à la fois ; s'arrête au premier échec réseau (on réessaie plus tard). */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
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
  }, [activityId, cle, players, persist]);

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
      setDone((d) => new Set([...d, ...saved.map((q) => q.registrationId)]));
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

  // Tant qu'il reste des réponses à envoyer : un essai toutes les 15 secondes.
  useEffect(() => {
    if (!pending.length) return;
    const t = setInterval(() => void flush(), 15000);
    return () => clearInterval(t);
  }, [pending.length, flush]);

  const reset = () => {
    setWho(null);
    setStep(0);
    setAnswers({});
    setState("idle");
    setError(null);
  };

  // Une fille qui part sans finir : la borne revient seule à la liste après 60 secondes.
  useEffect(() => {
    if (!who) return;
    const t = setTimeout(reset, state === "thanks" ? 8000 : 60000);
    return () => clearTimeout(t);
  }, [who, step, state]);

  const pick = async (v: number) => {
    const q = KIOSK_QUESTIONS[step];
    const next = { ...answers, [q.field]: v };
    setAnswers(next);
    if (step < KIOSK_QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    // La réponse est d'abord gardée sur l'iPad, puis envoyée : sans réseau, elle partira toute seule plus tard.
    persist(enqueue(queueRef.current, { registrationId: who!.id, answers: next as Record<string, number>, at: Date.now() }));
    setDone(new Set([...done, who!.id]));
    setState("thanks");
    void flush();
  };

  const card: React.CSSProperties = { background: "#fff", borderRadius: 20, border: "1px solid #e6e0ee", padding: "1.4rem" };

  if (!who) {
    const waiting = players.filter((p) => !done.has(p.id));
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ ...card, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#1d1730" }}>Comment était ta pratique ?</h1>
          <p style={{ margin: "0.4rem 0 0", color: "#5d566b", fontSize: "1.05rem" }}>
            {title} · Touche ta photo ({done.size}/{players.length} ont répondu)
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
        {waiting.length === 0 ? (
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
              </button>
            );
          })}
        </div>
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
          <button type="button" onClick={() => (setStep(0), setState("idle"))} style={{ minHeight: 56, padding: "0 22px", borderRadius: 14, border: `2px solid ${PURPLE}`, background: "#fff", color: PURPLE, fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}>
            ✏️ Changer mes réponses
          </button>
          <button type="button" onClick={reset} style={{ minHeight: 56, padding: "0 22px", borderRadius: 14, border: "none", background: PURPLE, color: "#fff", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer" }}>
            J&apos;ai fini
          </button>
        </div>
      </div>
    );
  }

  const q = KIOSK_QUESTIONS[step];
  return (
    <div style={{ ...card, display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={() => (step ? setStep(step - 1) : reset())} style={{ background: "none", border: "none", color: PURPLE, fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", padding: 8 }}>
          ← {step ? "Retour" : "Ce n'est pas moi"}
        </button>
        <span style={{ color: "#5d566b", fontWeight: 600 }}>
          {who.first} · question {step + 1} sur {KIOSK_QUESTIONS.length}
        </span>
      </div>
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
