"use client";

import { useState } from "react";

/** Dépôt de la photo d'une joueuse par sa famille (page blanche /photo/[jeton]), au téléphone. */
export function PlayerPhotoUpload({ token, firstName, hasPhoto, initialConsent }: { token: string; firstName: string; hasPhoto: boolean; initialConsent: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(initialConsent);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string }>({ kind: "idle" });

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setState({ kind: "idle" });
  };

  const send = async () => {
    setState({ kind: "sending" });
    const body = new FormData();
    if (file) body.append("photo", file);
    body.append("consent", consent ? "oui" : "non");
    const res = await fetch(`/api/photo/${token}`, { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "La photo n'est pas partie : vérifiez la connexion et réessayez." });
    setState({ kind: "done" });
  };

  if (state.kind === "done") {
    return (
      <div style={{ background: "#fff", border: "1px solid #e6e0ee", borderRadius: 14, padding: "1.25rem", display: "grid", gap: "0.5rem" }}>
        <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#2e7d32" }}>Merci ! La photo de {firstName} est enregistrée.</p>
        <p style={{ margin: 0, color: "#4a4358" }}>Vous pouvez fermer cette page.</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e6e0ee", borderRadius: 14, padding: "1.25rem", display: "grid", gap: "1rem" }}>
      {hasPhoto && !file && <p style={{ margin: 0, color: "#2e7d32", fontWeight: 600 }}>Nous avons déjà une photo de {firstName}. Vous pouvez la remplacer.</p>}
      <label style={{ display: "grid", placeItems: "center", gap: "0.5rem", minHeight: 180, border: "2px dashed #c9bedb", borderRadius: 12, cursor: "pointer", padding: "1rem", textAlign: "center", color: "#5b2a86", fontWeight: 600 }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`Aperçu de la photo de ${firstName}`} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: "2.2rem" }} aria-hidden>📷</span>
        )}
        <span>{preview ? "Changer la photo" : `Prendre ou choisir la photo de ${firstName}`}</span>
        <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      </label>

      <label style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", lineHeight: 1.45, color: "#1d1730", cursor: "pointer" }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: "#5b2a86", flex: "none" }} />
        <span>
          <strong>Facultatif :</strong> j&apos;accepte que New Valkyria publie des photos ou des vidéos de {firstName} prises pendant les activités (site web et réseaux sociaux de l&apos;académie). Les matchs filmés sont aussi visibles dans l&apos;espace client du site, seulement par les familles de l&apos;équipe. Je peux retirer cet accord en tout temps en écrivant à info@newvalkyria.com.
        </span>
      </label>

      <button
        type="button"
        onClick={send}
        disabled={state.kind === "sending" || (!file && !hasPhoto)}
        style={{ minHeight: 52, border: "none", borderRadius: 12, background: !file && !hasPhoto ? "#c9bedb" : "#5b2a86", color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}
      >
        {state.kind === "sending" ? "Envoi…" : file ? "Envoyer la photo" : hasPhoto ? "Enregistrer mon choix" : "Choisissez d'abord une photo"}
      </button>
      {state.kind === "error" && <p role="alert" style={{ margin: 0, color: "#b3261e" }}>{state.message}</p>}
    </div>
  );
}
