"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { clock, highlightCounts, type VideoHighlight, type VideoPeriod } from "@/lib/match-videos-core";

export interface PlayerPayload {
  title: string;
  date: string | null;
  url: string;
  poster: string | null;
  duration_s: number | null;
  periods: VideoPeriod[];
  highlights: VideoHighlight[];
}

const ICON: Record<string, string> = { goal: "⚽", shot_on_goal: "🎯", shot: "👟", save: "🧤", penalty: "⚑", free_kick: "⚑", corner: "⚑" };

/** Palette selon l'écran : espace parent (sombre, violet), admin et portail (variables de l'admin). */
const PALETTE = {
  famille: { text: "#fff", sub: "#b9a9cf", card: "rgba(255,255,255,0.05)", line: "rgba(255,255,255,0.12)", accent: "#c9a227", accentText: "#1d1730", track: "rgba(255,255,255,0.12)", period: "rgba(201,162,39,0.25)" },
  admin: { text: "var(--adm-text, #1d1730)", sub: "var(--adm-text-3, #6b6478)", card: "var(--adm-surface-2, rgba(0,0,0,0.03))", line: "var(--adm-border, rgba(0,0,0,0.1))", accent: "#5b2a86", accentText: "#fff", track: "var(--adm-border, rgba(0,0,0,0.12))", period: "rgba(91,42,134,0.18)" }
};

/** Le lecteur des matchs et pratiques filmés (vidéo lue chez Veo, 1080p) : on saute aux périodes et aux temps forts
 *  (buts, tirs… détectés par Veo), une frise montre où ils sont, et on reprend là où on s'était arrêté. */
export function MatchPlayer({ id, endpoint, label = "Regarder", palette = "famille" }: { id: string; endpoint: string; label?: string; palette?: keyof typeof PALETTE }) {
  const c = PALETTE[palette];
  const [data, setData] = useState<PlayerPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [resume, setResume] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const storeKey = `nv-video-${id}`;

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(storeKey));
      if (v > 30) setResume(v);
    } catch {
      /* stockage indisponible : on recommence au début */
    }
  }, [storeKey]);

  const duration = data?.duration_s ?? 0;
  const counts = useMemo(() => highlightCounts(data?.highlights ?? []), [data]);
  const shown = useMemo(() => (data?.highlights ?? []).filter((h) => !filter || h.type === filter), [data, filter]);

  const seek = (t: number, play = true) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, t);
    if (play) void v.play().catch(() => null);
  };

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) throw new Error(json?.error ?? "Vidéo indisponible.");
      setData(json as PlayerPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vidéo indisponible.");
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean): React.CSSProperties => ({ minHeight: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${on ? c.accent : c.line}`, background: on ? c.accent : "transparent", color: on ? c.accentText : c.text, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" });

  if (!data) {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <button type="button" onClick={open} disabled={busy} style={{ minHeight: 44, padding: "0 18px", borderRadius: 10, border: "none", background: c.accent, color: c.accentText, fontWeight: 700, cursor: "pointer", justifySelf: "start" }}>
          {busy ? "Chargement…" : `▶ ${label}`}
        </button>
        {error ? <span style={{ fontSize: "0.85rem", color: "#e5484d" }}>{error}</span> : null}
      </div>
    );
  }

  const nextMoment = shown.find((h) => h.t > now + 2);

  return (
    <div style={{ display: "grid", gap: 10, color: c.text }}>
      <video
        ref={video}
        src={data.url}
        poster={data.poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        style={{ width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 12 }}
        onLoadedMetadata={() => {
          if (resume) seek(resume, false);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setNow(t);
          if (Math.floor(t) % 5 === 0) {
            try {
              localStorage.setItem(storeKey, String(Math.floor(t)));
            } catch {
              /* rien */
            }
          }
        }}
      />

      {duration > 0 && (data.periods.length > 0 || data.highlights.length > 0) ? (
        <div
          role="presentation"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * duration);
          }}
          style={{ position: "relative", height: 22, borderRadius: 6, background: c.track, cursor: "pointer", overflow: "hidden" }}
          title="Clique pour aller à ce moment"
        >
          {data.periods.map((p, i) => (
            <span key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${(p.from / duration) * 100}%`, width: `${((p.to - p.from) / duration) * 100}%`, background: c.period }} />
          ))}
          {data.highlights
            .filter((h) => h.type === "goal" || h.type === filter)
            .map((h, i) => (
              <span key={i} style={{ position: "absolute", top: 3, bottom: 3, width: 3, borderRadius: 2, left: `${(h.t / duration) * 100}%`, background: h.type === "goal" ? "#2fbf71" : c.accent }} />
            ))}
          <span style={{ position: "absolute", top: 0, bottom: 0, width: 2, left: `${(now / duration) * 100}%`, background: c.text }} />
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={chip(false)} onClick={() => seek(now - 10)}>
          − 10 s
        </button>
        <button type="button" style={chip(false)} onClick={() => seek(now + 10)}>
          + 10 s
        </button>
        {nextMoment ? (
          <button type="button" style={chip(false)} onClick={() => seek(nextMoment.t - 5)}>
            Temps fort suivant ▸
          </button>
        ) : null}
        {resume && now < 5 ? (
          <button type="button" style={chip(false)} onClick={() => seek(resume)}>
            Reprendre à {clock(resume)}
          </button>
        ) : null}
      </div>

      {data.periods.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {data.periods.map((p, i) => (
            <button key={i} type="button" style={chip(now >= p.from && now < p.to)} onClick={() => seek(p.from)}>
              {p.label} · {clock(p.from)}
            </button>
          ))}
        </div>
      ) : null}

      {counts.length ? (
        <div style={{ display: "grid", gap: 8, background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            <button type="button" style={chip(filter === null)} onClick={() => setFilter(null)}>
              Tous les temps forts · {data.highlights.length}
            </button>
            {counts.map((k) => (
              <button key={k.type} type="button" style={chip(filter === k.type)} onClick={() => setFilter(filter === k.type ? null : k.type)}>
                {ICON[k.type] ?? "★"} {k.label} · {k.n}
              </button>
            ))}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, maxHeight: 260, overflowY: "auto" }}>
            {shown.map((h, i) => {
              const on = now >= h.t - 5 && now < h.t + h.d;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => seek(h.t - 5)}
                    style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", padding: "8px 6px", borderRadius: 8, border: "none", background: on ? c.period : "transparent", color: c.text, cursor: "pointer", textAlign: "left", fontSize: "0.9rem" }}
                  >
                    <span aria-hidden>{ICON[h.type] ?? "★"}</span>
                    <span style={{ flex: 1 }}>{h.label}</span>
                    <span style={{ color: c.sub, fontVariantNumeric: "tabular-nums" }}>{clock(h.t)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {data.highlights.some((h) => h.ai) ? <p style={{ margin: 0, fontSize: "0.75rem", color: c.sub }}>Temps forts repérés automatiquement par la caméra Veo : un moment peut manquer ou être en trop.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
