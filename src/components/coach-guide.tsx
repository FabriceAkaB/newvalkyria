"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { alarmPlan, GUIDE_ITEMS, timerState } from "@/lib/coach-guide";

/** Guide de l'éducateur (étape « Avant ») : on coche avant la pratique, avec les heures exactes des alarmes ; et le
 *  minuteur (étape « Pendant ») qui sonne et vibre à chaque changement d'exercice pour respecter le temps prévu. */

export interface GuideBlock {
  title: string;
  minutes: number;
}

export function CoachGuideCard({ activityId, start, blocks }: { activityId: string; start: string; blocks: GuideBlock[] }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/coach/activities/${activityId}/guide`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.checked && setChecked(d.checked))
      .catch(() => null);
  }, [activityId]);
  const toggle = (key: string) => {
    const next = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key];
    setChecked(next);
    void fetch(`/api/coach/activities/${activityId}/guide`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checked: next }) }).catch(() => null);
  };
  const alarms = alarmPlan(start, blocks);
  const done = checked.length === GUIDE_ITEMS.length;
  return (
    <div className="coach-card" style={{ marginTop: 12, borderColor: done ? "var(--adm-good)" : undefined }}>
      <p className="coach-card__label">Guide de l&apos;éducateur · avant de commencer · {checked.length}/{GUIDE_ITEMS.length}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
        {GUIDE_ITEMS.map((i) => {
          const on = checked.includes(i.key);
          return (
            <li key={i.key}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(i.key)}
                  style={{ flex: "none", width: 26, height: 26, borderRadius: 8, border: `2px solid ${on ? "var(--adm-good)" : "var(--adm-border)"}`, background: on ? "var(--adm-good-soft)" : "transparent", color: "var(--adm-good)", fontWeight: 800, cursor: "pointer", marginTop: 2 }}
                >
                  {on ? "✓" : ""}
                </button>
                <button type="button" onClick={() => setOpen(open === i.key ? null : i.key)} style={{ background: "none", border: 0, padding: "3px 0", textAlign: "left", color: on ? "var(--adm-text-2)" : "var(--adm-text)", fontWeight: 600, cursor: "pointer", textDecoration: on ? "line-through" : undefined }}>
                  {i.label}
                </button>
              </div>
              {open === i.key || (i.key === "alarmes" && !on) ? <p className="coach-sub" style={{ margin: "2px 0 6px 36px" }}>{i.detail}</p> : null}
              {i.key === "alarmes" && alarms.length ? (
                <ul style={{ listStyle: "none", margin: "0 0 8px 36px", padding: 0, display: "grid", gap: 2, fontVariantNumeric: "tabular-nums" }}>
                  {alarms.map((a, k) => (
                    <li key={k} style={{ color: "var(--adm-text-2)", fontSize: "0.9rem" }}>
                      ⏰ <strong style={{ color: "var(--adm-text)" }}>{a.time.replace(":", " h ")}</strong> · {a.label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function beep(times = 3) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.45;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    }
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    /* son indisponible */
  }
}

/** Minuteur de la pratique : un bloc après l'autre ; 1 bip à 1 minute de la fin, 3 bips (et vibration) au changement.
 *  L'écran reste allumé quand le téléphone le permet. Le départ est gardé : recharger la page ne le perd pas. */
export function PracticeTimer({ activityId, blocks }: { activityId: string; blocks: GuideBlock[] }) {
  const key = `nv-minuteur-${activityId}`;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Un minuteur déjà lancé (page rechargée) reprend où il était ; lu après l'affichage pour éviter un écart serveur/client.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = Number(localStorage.getItem(key));
        if (v > 0) {
          last.current = { index: timerState(v, Date.now(), blocks).index, warned: true };
          setStartedAt(v);
        }
      } catch {
        /* stockage indisponible */
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const [now, setNow] = useState(() => Date.now());
  const last = useRef<{ index: number; warned: boolean }>({ index: -1, warned: false });
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  const keepAwake = useCallback(async () => {
    try {
      lock.current = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {
      lock.current = null;
    }
  }, []);

  useEffect(() => {
    if (!startedAt) return;
    void keepAwake();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      void lock.current?.release().catch(() => null);
    };
  }, [startedAt, keepAwake]);

  const state = startedAt ? timerState(startedAt, now, blocks) : null;
  useEffect(() => {
    if (!state) return;
    if (state.index !== last.current.index) {
      if (last.current.index !== -1) beep(3);
      last.current = { index: state.index, warned: false };
    } else if (!state.done && state.remaining <= 60 && !last.current.warned) {
      beep(1);
      last.current.warned = true;
    }
  }, [state]);

  const start = () => {
    const t = Date.now();
    try {
      localStorage.setItem(key, String(t));
    } catch {
      /* rien */
    }
    last.current = { index: 0, warned: false };
    setStartedAt(t);
    setNow(t);
    beep(1);
  };
  const stop = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* rien */
    }
    setStartedAt(null);
  };

  if (!blocks.length) return null;
  const current = state && !state.done ? blocks[state.index] : null;
  const next = state && !state.done ? blocks[state.index + 1] : null;
  return (
    <div className="coach-card" style={{ marginBottom: 12 }}>
      <p className="coach-card__label">Minuteur sur le terrain</p>
      {!state ? (
        <>
          <p className="coach-sub" style={{ marginTop: 0 }}>
            Lance-le au début du 1er bloc : il sonne (et vibre) à chaque changement d&apos;exercice, et 1 minute avant. Garde le téléphone ouvert sur cette page.
          </p>
          <button type="button" className="coach-primary" style={{ width: "100%" }} onClick={start}>
            ▶ Lancer le minuteur ({blocks.reduce((s, b) => s + b.minutes, 0)} min)
          </button>
        </>
      ) : state.done ? (
        <>
          <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "var(--adm-good)" }}>Tous les blocs sont faits : bilan, sondage et rangement.</p>
          <button type="button" className="coach-secondary" style={{ width: "100%", marginTop: 10 }} onClick={stop}>Arrêter le minuteur</button>
        </>
      ) : (
        <>
          <p className="coach-muted" style={{ margin: 0 }}>Bloc {state.index + 1} sur {blocks.length}</p>
          <p style={{ margin: "2px 0 0", fontSize: "1.15rem", fontWeight: 700, color: "var(--adm-text)" }}>{current?.title}</p>
          <p style={{ margin: "4px 0", fontSize: "3rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: state.remaining <= 60 ? "var(--adm-warn)" : "var(--adm-text)" }}>{fmt(state.remaining)}</p>
          <p className="coach-sub" style={{ margin: 0 }}>{next ? `Ensuite : ${next.title} (${next.minutes} min)` : "Ensuite : bilan, sondage et rangement"}</p>
          <p className="coach-sub" style={{ margin: "6px 0 0" }}>Pendant cet exercice : ajoute 1 variante et 1 progression.</p>
          <button type="button" className="coach-secondary" style={{ width: "100%", marginTop: 10 }} onClick={stop}>Arrêter le minuteur</button>
        </>
      )}
    </div>
  );
}
