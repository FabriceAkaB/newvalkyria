"use client";

import { useEffect, useState } from "react";

/** La pratique en diapos, déjà ouverte dans la page (pas de fichier à cliquer), avec « Télécharger » et « Plein écran ».
 *  Sert à JP (« Voir le plan » dans l'admin) et aux éducateurs (portail, étape « Avant »).
 *  `downloadUrl(id)` : la route qui rend un lien signé ({ signedUrl }) selon l'espace (admin ou portail). */
export function PracticeDeckViewer({
  decks,
  downloadUrl,
  onShown,
  variant = "admin"
}: {
  decks: { id: string; fileName: string }[];
  downloadUrl: (id: string) => string;
  onShown?: (id: string) => void;
  variant?: "admin" | "coach";
}) {
  const [current, setCurrent] = useState(decks[0]?.id ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deck = decks.find((d) => d.id === current) ?? null;

  useEffect(() => {
    if (!current) return;
    let alive = true;
    setUrl(null);
    setError(null);
    fetch(downloadUrl(current))
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data?.signedUrl) {
          setUrl(data.signedUrl);
          onShown?.(current);
        } else setError("La pratique n'a pas pu s'ouvrir. Recharge la page.");
      })
      .catch(() => alive && setError("La pratique n'a pas pu s'ouvrir. Recharge la page."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!decks.length) return null;
  const name = (deck?.fileName ?? "pratique.pdf").replace(/\.pdf$/i, "");
  const download = url ? `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(deck?.fileName ?? "pratique.pdf")}` : null;
  const linkStyle = { fontSize: "0.85rem", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" as const };

  return (
    <section
      className={variant === "coach" ? "coach-card" : undefined}
      style={
        variant === "coach"
          ? { marginBottom: 12, padding: 0, overflow: "hidden" }
          : { background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: 12, overflow: "hidden", margin: "1.25rem 0" }
      }
      aria-label="La pratique en diapos"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: "1px solid var(--adm-line)" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--adm-text-2)" }}>La pratique</p>
          <p style={{ margin: "2px 0 0", fontWeight: 600, color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {download ? (
            <a href={download} style={{ ...linkStyle, color: "var(--adm-good)" }}>
              ⬇ Télécharger
            </a>
          ) : null}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ ...linkStyle, color: "var(--adm-info)" }}>
              Plein écran ↗
            </a>
          ) : null}
        </div>
      </div>
      {decks.length > 1 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 14px", borderBottom: "1px solid var(--adm-line)" }}>
          {decks.map((d) => (
            <button key={d.id} type="button" onClick={() => setCurrent(d.id)} className={d.id === current ? "admin-btn-primary" : "admin-btn-ghost"} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
              {d.fileName.replace(/\.pdf$/i, "")}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p style={{ margin: 0, padding: 14, color: "var(--adm-bad)" }}>{error}</p> : null}
      {url ? (
        <iframe src={`${url}#view=FitH`} title={name} style={{ display: "block", width: "100%", height: variant === "coach" ? "62vh" : "75vh", minHeight: 360, border: "none", background: "#fff" }} />
      ) : !error ? (
        <p style={{ margin: 0, padding: 24, color: "var(--adm-text-2)" }}>Ouverture de la pratique…</p>
      ) : null}
      {variant === "coach" ? <p style={{ margin: 0, padding: "8px 14px", fontSize: "0.78rem", color: "var(--adm-text-2)" }}>Sur téléphone, « Plein écran » montre toutes les diapos.</p> : null}
    </section>
  );
}
