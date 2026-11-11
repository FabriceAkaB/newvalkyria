"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** « Envoyer ma vidéo » (Valkyria Lab, page famille) : la joueuse, le geste, la vidéo.
 *  Le fichier part directement du téléphone vers le stockage privé (lien signé), avec une barre de progression. */

const INK = "#1d1730";
const MUTED = "#5d566b";
const ACCENT = "#5b2a86";
const LINE = "#e0d8ea";
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.25rem", border: "1px solid #e6e0ee" };
const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 44,
  padding: "0.55rem 0.95rem",
  borderRadius: 999,
  border: `2px solid ${on ? ACCENT : LINE}`,
  background: on ? ACCENT : "#fff",
  color: on ? "#fff" : INK,
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer"
});
const legend: React.CSSProperties = { fontWeight: 700, fontSize: "0.95rem", color: INK, margin: "0 0 0.6rem" };

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024)).toLocaleString("fr-CA")} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

type Phase = "idle" | "uploading" | "saving" | "done";

async function api(token: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/lab/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur, réessayez dans un instant.");
  return json;
}

/** Téléverse le fichier vers le lien signé du stockage, en suivant la progression. */
function putFile(url: string, file: File, contentType: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413 || /too large|EntityTooLarge/i.test(xhr.responseText)) return reject(new Error("Vidéo trop lourde. Coupez-la pour garder seulement le geste, puis réessayez."));
      if (/mime/i.test(xhr.responseText)) return reject(new Error("Ce fichier n'est pas une vidéo acceptée. Choisissez une vidéo MP4 ou MOV."));
      reject(new Error("L'envoi n'a pas fonctionné. Réessayez."));
    };
    xhr.onerror = () => reject(new Error("La connexion a coupé pendant l'envoi. Vérifiez le Wi-Fi et réessayez."));
    xhr.send(file);
  });
}

export function LabUpload({
  token,
  players,
  gestures,
  maxBytes,
  limitHint,
  videoExts,
  preview
}: {
  token: string;
  players: { value: string; label: string }[];
  gestures: string[];
  maxBytes: number;
  limitHint: string;
  videoExts: string[];
  preview?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [player, setPlayer] = useState(players.length === 1 ? players[0].value : "");
  const [gesture, setGesture] = useState(gestures.length === 1 ? gestures[0] : "");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Prévenir avant de quitter la page pendant l'envoi.
  useEffect(() => {
    if (phase !== "uploading" && phase !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    const ext = (f.name.match(/\.([A-Za-z0-9]{2,4})$/)?.[1] ?? "").toLowerCase();
    if (!f.type.startsWith("video/") && !videoExts.includes(ext)) {
      setFile(null);
      return setError("Ce fichier n'est pas une vidéo. Choisissez une vidéo (MP4, MOV…).");
    }
    if (f.size > maxBytes) {
      setFile(null);
      return setError(`Vidéo trop lourde (${sizeLabel(f.size)}) : ${sizeLabel(maxBytes)} maximum. Coupez-la pour garder seulement le geste (Photos → Modifier), ou filmez en 1080p plutôt qu'en 4K.`);
    }
    setFile(f);
  };

  const reset = () => {
    setFile(null);
    setPhase("idle");
    setProgress(0);
    setError(null);
    if (players.length > 1) setPlayer("");
    if (gestures.length > 1) setGesture("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const busy = phase === "uploading" || phase === "saving";
  const ready = !!player && !!gesture && !!file && !busy && !preview;
  const who = players.find((p) => p.value === player)?.label ?? "votre fille";

  if (phase === "done") {
    return (
      <div style={{ ...card, textAlign: "center", padding: "1.75rem 1.25rem" }} role="status">
        <p style={{ fontSize: "2.4rem", margin: 0, lineHeight: 1 }} aria-hidden>
          ✓
        </p>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.6rem 0 0", color: INK }}>Vidéo reçue, merci !</h3>
        <p style={{ color: MUTED, lineHeight: 1.6, margin: "0.5rem 0 1.1rem" }}>Le coach de {who} va la regarder et vous laissera un commentaire sur cette page.</p>
        <button type="button" onClick={reset} style={{ ...chip(false), borderRadius: 12, padding: "0.7rem 1.2rem" }}>
          Envoyer une autre vidéo
        </button>
      </div>
    );
  }

  return (
    <form
      style={{ ...card, display: "grid", gap: "1.25rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready || !file) return;
        setError(null);
        setPhase("uploading");
        setProgress(0);
        try {
          const start = await api(token, { action: "start", player, gesture, fileName: file.name, size: file.size, type: file.type || null });
          await putFile(start.signedUrl, file, start.contentType, setProgress);
          setPhase("saving");
          await api(token, { action: "complete", path: start.path, player, gesture });
          setPhase("done");
          router.refresh();
        } catch (err) {
          setPhase("idle");
          setError(err instanceof Error ? err.message : "Erreur, réessayez dans un instant.");
        }
      }}
    >
      {players.length > 1 ? (
        <fieldset style={{ border: "none", margin: 0, padding: 0 }} disabled={busy}>
          <legend style={legend}>1. Qui est sur la vidéo ?</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {players.map((p) => (
              <button key={p.value} type="button" style={chip(player === p.value)} aria-pressed={player === p.value} onClick={() => setPlayer(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset style={{ border: "none", margin: 0, padding: 0 }} disabled={busy}>
        <legend style={legend}>{players.length > 1 ? "2." : "1."} Quel geste ?</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {gestures.map((g) => (
            <button key={g} type="button" style={chip(gesture === g)} aria-pressed={gesture === g} onClick={() => setGesture(g)}>
              {g}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <p style={legend}>{players.length > 1 ? "3." : "2."} La vidéo</p>
        <input
          ref={inputRef}
          id="lab-video"
          type="file"
          accept="video/*"
          disabled={busy || preview}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
        <label
          htmlFor="lab-video"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            minHeight: 64,
            padding: "0.9rem 1rem",
            borderRadius: 12,
            border: `2px dashed ${file ? ACCENT : "#cfc3df"}`,
            background: file ? "#f5f0fb" : "#faf8fc",
            cursor: busy || preview ? "default" : "pointer"
          }}
        >
          <span aria-hidden style={{ fontSize: "1.6rem", lineHeight: 1 }}>
            {file ? "🎬" : "🎥"}
          </span>
          <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file ? file.name : "Choisir ou filmer la vidéo"}</span>
            <span style={{ fontSize: "0.85rem", color: MUTED }}>{file ? `${sizeLabel(file.size)} · toucher pour changer` : limitHint}</span>
          </span>
        </label>
      </div>

      {busy ? (
        <div role="status" aria-live="polite" style={{ display: "grid", gap: 6 }}>
          <div style={{ height: 10, borderRadius: 999, background: "#eee7f5", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((phase === "saving" ? 1 : progress) * 100)}%`, background: ACCENT, borderRadius: 999, transition: "width 0.3s" }} />
          </div>
          <p style={{ margin: 0, fontSize: "0.88rem", color: MUTED }}>
            {phase === "saving" ? "Presque fini…" : `Envoi en cours : ${Math.round(progress * 100)} %. Gardez cette page ouverte.`}
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b3261e", fontWeight: 600, lineHeight: 1.5 }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!ready}
        style={{ width: "100%", minHeight: 52, borderRadius: 12, border: "none", background: ready ? ACCENT : "#c9bcd9", color: "#fff", fontWeight: 800, fontSize: "1.05rem", cursor: ready ? "pointer" : "default" }}
      >
        {busy ? "Envoi…" : preview ? "Envoi désactivé dans l'aperçu" : "Envoyer la vidéo"}
      </button>
      <p style={{ margin: 0, fontSize: "0.82rem", color: MUTED, lineHeight: 1.5 }}>
        Votre vidéo est privée : seuls les coachs de New Valkyria la voient. Elle n’est jamais publiée. Pour en retirer une, écrivez-nous à info@newvalkyria.com.
      </p>
    </form>
  );
}
