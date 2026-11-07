"use client";

import { useState } from "react";

/** Bouton « Regarder » : demande un lien signé (famille, éducateur ou admin) puis affiche le lecteur Cloudflare. */
export function StreamPlayer({ endpoint, label = "Regarder", buttonStyle }: { endpoint: string; label?: string; buttonStyle?: React.CSSProperties }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (url) {
    return (
      <div style={{ position: "relative", paddingTop: "56.25%", width: "100%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
        <iframe src={url} title="Vidéo" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={{ border: "none", position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        disabled={busy}
        style={buttonStyle ?? { minHeight: 42, padding: "0 16px", borderRadius: 10, border: "none", background: "#5b2a86", color: "#fff", fontWeight: 700, cursor: "pointer", justifySelf: "start" }}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(endpoint);
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.url) throw new Error(json?.error ?? "Vidéo indisponible.");
            setUrl(json.url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Vidéo indisponible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Chargement…" : `▶ ${label}`}
      </button>
      {error ? <span style={{ fontSize: "0.85rem", color: "#b42318" }}>{error}</span> : null}
    </div>
  );
}
