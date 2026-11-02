"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Réduit la photo dans le navigateur (côté long 900 px, JPEG) : téléversement rapide au téléphone
 *  et fichier léger (la limite d'envoi du site est de 4,5 Mo). */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
}

/** Une joueuse : sa photo (ou ses initiales) et le bouton « Prendre la photo » qui ouvre l'appareil photo. */
export function PlayerPhotoCard({ playerId, name, photoUrl }: { playerId: string; name: string; photoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="mda-card" style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", boxShadow: url ? undefined : "inset 0 0 0 1px rgba(242,193,78,0.45)" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} style={{ width: 88, height: 88, borderRadius: 999, objectFit: "cover" }} />
      ) : (
        <span style={{ width: 88, height: 88, borderRadius: 999, background: "var(--adm-surface-3)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", fontWeight: 700, color: "var(--adm-text-2)" }}>{initials}</span>
      )}
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", lineHeight: 1.25 }}>{name}</span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            const small = await shrink(f);
            const body = new FormData();
            body.append("file", small);
            const res = await fetch(`/api/admin/evaluations/players/${playerId}/photo`, { method: "POST", body });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error ?? "Erreur d'envoi");
            setUrl(json.photoUrl);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur");
          } finally {
            setBusy(false);
            if (input.current) input.current.value = "";
          }
        }}
      />
      <button type="button" className={url ? "admin-btn-ghost" : "admin-btn-primary"} style={{ width: "100%", minHeight: 40 }} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Envoi…" : url ? "Reprendre" : "📸 Prendre la photo"}
      </button>
      {error ? <span style={{ fontSize: "0.75rem", color: "var(--adm-bad)" }}>{error}</span> : null}
    </div>
  );
}
