"use client";

import { useEffect, useState } from "react";

import { KIOSK_QUESTIONS, SCALE_VALUES } from "@/lib/practice-survey";

/** Borne de sondage sur l'iPad : la joueuse touche sa photo, répond à 5 questions sur 10 (une par écran), puis la
 *  borne revient à la liste pour la suivante. Grands boutons, mots d'enfant, aucun clavier. Une fille qui a fini
 *  disparaît de la liste (personne ne peut revoir ni changer ses réponses) ; elle peut seulement les réviser tout de
 *  suite, sur l'écran « Merci », avant que la borne revienne à la liste. */

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
    setState("saving");
    const res = await fetch(`/api/borne/${activityId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cle, registrationId: who!.id, ...next }) }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "Oups, ce n'est pas enregistré. Demande à ton éducatrice.");
      setState("idle");
      return;
    }
    setDone(new Set([...done, who!.id]));
    setState("thanks");
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
