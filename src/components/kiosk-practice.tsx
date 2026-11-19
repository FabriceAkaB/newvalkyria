"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ExerciseDiagramView } from "@/components/exercise-diagram";
import type { KioskPlan } from "@/lib/kiosk-practice-repo";

/** La borne (code 180180) : « La pratique » et « Sondage des filles » dans la même page. Une fois ouverte avec du
 *  réseau, tout reste lisible sans réseau : le plan est dans la page et les diapos sont téléchargées tout de suite. */

const card = { background: "#fff", borderRadius: 16, padding: "1.1rem 1.2rem", border: "1px solid #e6e0ee" } as const;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")} h ${String(m % 60).padStart(2, "0")}`;

export function KioskTabs({ initial, plan, survey }: { initial: "pratique" | "sondage"; plan: ReactNode; survey: ReactNode }) {
  const [tab, setTab] = useState(initial);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const btn = (key: "pratique" | "sondage", label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      style={{ flex: 1, minHeight: 48, borderRadius: 12, border: "none", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", background: tab === key ? "#5b2a86" : "transparent", color: tab === key ? "#fff" : "#3b1d5e" }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, padding: 6, background: "#ece6f3", borderRadius: 16 }}>
        {btn("pratique", "La pratique")}
        {btn("sondage", "Sondage des filles")}
      </div>
      {!online && (
        <p style={{ margin: 0, padding: "8px 12px", borderRadius: 10, background: "#fff4e0", color: "#7a4a00", fontSize: "0.9rem" }}>
          Hors réseau : la pratique reste lisible et les réponses du sondage partent dès que le réseau revient. Ne recharge pas la page.
        </p>
      )}
      {/* Les deux restent montés : changer d'onglet ne perd rien, même sans réseau. */}
      <div style={{ display: tab === "pratique" ? "block" : "none" }}>{plan}</div>
      <div style={{ display: tab === "sondage" ? "block" : "none" }}>{survey}</div>
    </div>
  );
}

function OfflineDeck({ deck }: { deck: KioskPlan["decks"][number] }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetch(deck.url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(new Blob([b], { type: "application/pdf" }));
        setSrc(url);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [deck.url]);
  const name = deck.fileName.replace(/\.pdf$/i, "");
  return (
    <section style={{ ...card, padding: 0, overflow: "hidden" }} aria-label="La pratique en diapos">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #eee8f3" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b6478" }}>Diapos {src ? "· gardées sur l'appareil" : ""}</p>
          <p style={{ margin: "2px 0 0", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
        </div>
        {src && (
          <a href={src} target="_blank" rel="noreferrer" style={{ color: "#5b2a86", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
            Plein écran ↗
          </a>
        )}
      </div>
      {src ? (
        <iframe src={`${src}#view=FitH`} title={name} style={{ display: "block", width: "100%", height: "70vh", minHeight: 360, border: "none", background: "#fff" }} />
      ) : (
        <p style={{ margin: 0, padding: 20, color: failed ? "#a3261b" : "#6b6478" }}>
          {failed ? "Les diapos n'ont pas pu se télécharger. Rouvre la page avec du réseau ; le plan écrit plus bas reste là." : "Téléchargement des diapos…"}
        </p>
      )}
    </section>
  );
}

export function KioskPracticePlan({ plan, title, when }: { plan: KioskPlan; title: string; when: string }) {
  const total = plan.blocks.reduce((s, b) => s + b.minutes, 0);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={card}>
        <p style={{ margin: 0, color: "#6b6478", fontSize: "0.9rem", textTransform: "capitalize" }}>{when}</p>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 800 }}>{title}</h1>
        {plan.theme && (
          <>
            <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: "#6b6478" }}>Thème de la semaine</p>
            <p style={{ margin: "2px 0 0", fontSize: "1.1rem", fontWeight: 700, color: "#3b1d5e" }}>{plan.theme.theme}</p>
            {plan.theme.notes && <p style={{ margin: "6px 0 0", whiteSpace: "pre-line", color: "#4a4358" }}>{plan.theme.notes}</p>}
          </>
        )}
        {plan.blocks.length > 0 && (
          <p style={{ margin: "12px 0 0", color: "#4a4358" }}>
            {plan.blocks.length} bloc{plan.blocks.length > 1 ? "s" : ""} · {total} min{plan.players ? ` · ${plan.players} joueuse${plan.players > 1 ? "s" : ""} attendue${plan.players > 1 ? "s" : ""}` : ""}
          </p>
        )}
      </div>

      {plan.decks.map((d) => <OfflineDeck key={d.id} deck={d} />)}

      {plan.blocks.length === 0 && plan.decks.length === 0 && (
        <div style={card}>
          <p style={{ margin: 0, fontWeight: 700 }}>Le plan de cette pratique n&apos;est pas encore prêt.</p>
          <p style={{ margin: "6px 0 0", color: "#6b6478" }}>JP le prépare dans l&apos;admin (Coaching › Pratiques).</p>
        </div>
      )}

      {plan.blocks.map((b) => (
        <section key={b.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b6478" }}>{b.type}</p>
              <p style={{ margin: "2px 0 0", fontSize: "1.15rem", fontWeight: 800 }}>{b.title}</p>
            </div>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "#5b2a86" }}>
              {hhmm(b.from)} à {hhmm(b.from + b.minutes)} · {b.minutes} min
            </span>
          </div>
          {b.rows.length > 0 && (
            <dl style={{ margin: "12px 0 0", display: "grid", gap: 10 }}>
              {b.rows.map((r) => (
                <div key={r.label}>
                  <dt style={{ fontSize: "0.8rem", fontWeight: 700, color: "#6b6478" }}>{r.label}</dt>
                  <dd style={{ margin: "2px 0 0", whiteSpace: "pre-line", color: "#1d1730" }}>{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {b.diagram ? <div style={{ marginTop: 12 }}><ExerciseDiagramView diagram={b.diagram as never} /></div> : null}
          {b.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt={b.title} style={{ maxWidth: "100%", borderRadius: 10, marginTop: 12 }} />
          )}
        </section>
      ))}
    </div>
  );
}
