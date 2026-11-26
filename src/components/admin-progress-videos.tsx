"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { checkpointLabel, type Checkpoint } from "@/lib/progress-videos";

const post = async (body: Record<string, unknown>, endpoint = "/api/admin/coaching/progression-video") => {
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, json };
};

function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413 || /too large|EntityTooLarge|maximum allowed size/i.test(xhr.responseText)) return reject(new Error("Vidéo trop lourde : garde un extrait de 30 secondes environ (ou exporte-la en 720p)."));
      reject(new Error("L'envoi n'a pas fonctionné. Réessaie."));
    };
    xhr.onerror = () => reject(new Error("La connexion a coupé pendant l'envoi. Réessaie sur le Wi-Fi."));
    xhr.send(file);
  });
}

interface Video { id: string; checkpoint: Checkpoint | null; title: string; note: string | null }

/** Une case « moment de la saison » d'une fille : ses vidéos (voir, retirer) et le dépôt d'une nouvelle. */
export function ProgressCell({ registrationId, name, checkpoint, videos, current, endpoint }: { registrationId: string; name: string; checkpoint: Checkpoint; videos: Video[]; current: boolean; endpoint?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Ball mastery");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    setBusy("Préparation…");
    const start = await post({ action: "depot", registrationId, fileName: file.name, contentType: file.type || "video/mp4" }, endpoint);
    if (!start.ok) {
      setBusy(null);
      return setError(start.json?.error ?? "Dépôt impossible.");
    }
    try {
      await putFile(start.json.signedUrl, file, (p) => setBusy(`Envoi ${Math.round(p * 100)} %`));
    } catch (e) {
      setBusy(null);
      return setError(e instanceof Error ? e.message : "Envoi impossible.");
    }
    const done = await post({ action: "relier", registrationId, checkpoint, title, note, path: start.json.path, fileName: file.name }, endpoint);
    setBusy(null);
    if (!done.ok) return setError(done.json?.error ?? "La vidéo n'a pas été reliée.");
    setOpen(false);
    setNote("");
    router.refresh();
  };

  return (
    <td style={{ verticalAlign: "top", minWidth: 150, background: current ? "var(--adm-surface-2)" : undefined }}>
      <div style={{ display: "grid", gap: 4 }}>
        {videos.map((v) => (
          <div key={v.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="admin-btn-ghost" style={{ padding: "2px 8px", fontSize: "0.8rem" }} onClick={async () => { const r = await post({ action: "voir", id: v.id }, endpoint); setPreview(r.json?.url ?? null); }}>
              ▶ {v.title}
            </button>
            <button type="button" aria-label={`Retirer la vidéo ${v.title} de ${name}`} className="admin-btn-ghost" style={{ padding: "2px 6px", fontSize: "0.75rem" }} onClick={async () => { if (confirm(`Retirer la vidéo « ${v.title} » de ${name} ?`)) { await post({ action: "retirer", id: v.id }, endpoint); router.refresh(); } }}>
              ✕
            </button>
          </div>
        ))}
        {!videos.length && <span style={{ fontSize: "0.8rem", color: current ? "var(--adm-warn)" : "var(--adm-text-3)" }}>{current ? "À filmer" : "—"}</span>}
        {!open ? (
          <button type="button" className="admin-btn-ghost" style={{ padding: "2px 8px", fontSize: "0.78rem", justifySelf: "start" }} onClick={() => setOpen(true)}>+ Vidéo</button>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            <input className="admin-input" style={{ fontSize: "0.8rem" }} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titre de la vidéo" />
            <input className="admin-input" style={{ fontSize: "0.8rem" }} placeholder="Note pour la famille (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
            <label className="admin-btn-primary" style={{ fontSize: "0.8rem", padding: "4px 10px", cursor: busy ? "wait" : "pointer", textAlign: "center" }}>
              {busy ?? "Choisir la vidéo"}
              <input type="file" accept="video/*" hidden disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
            </label>
            <button type="button" className="admin-btn-ghost" style={{ fontSize: "0.75rem", padding: "2px 8px" }} disabled={!!busy} onClick={() => setOpen(false)}>Annuler</button>
          </div>
        )}
        {error && <span style={{ fontSize: "0.78rem", color: "var(--adm-bad)" }}>{error}</span>}
      </div>
      {preview && (
        <div role="dialog" aria-label={`Vidéo de ${name}, ${checkpointLabel(checkpoint)}`} onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <video src={preview} controls autoPlay playsInline style={{ maxWidth: "min(900px, 100%)", maxHeight: "80vh", borderRadius: 12 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </td>
  );
}
