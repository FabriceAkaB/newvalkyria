"use client";

import { Check, Copy, Star, Upload, Video } from "lucide-react";
import { useState } from "react";

import { VIDEO_STATUS_LABEL } from "@/lib/family-reviews";

/** Votre avis (JP, 19 nov. 2026) : les étoiles et le texte écrits une fois, puis publiés sur Google et Facebook en
 *  deux clics (le texte est copié, la page d'avis s'ouvre) ; et le témoignage vidéo filmé au téléphone. */

const post = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/compte/avis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: !!res?.ok, json: res ? await res.json().catch(() => null) : null };
};

function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 || /too large|maximum allowed size/i.test(xhr.responseText) ? "Vidéo trop lourde : gardez-la sous 1 minute." : "L'envoi n'a pas fonctionné. Réessayez.")));
    xhr.onerror = () => reject(new Error("La connexion a coupé. Réessayez sur le Wi-Fi."));
    xhr.send(file);
  });
}

interface Initial { stars: number | null; body: string | null; videoStatus: string; googleClicked: boolean; facebookClicked: boolean }

export function FamilyReview({ initial, googleUrl, facebookUrl, creditLabel }: { initial: Initial | null; googleUrl: string | null; facebookUrl: string | null; creditLabel: string }) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [text, setText] = useState(initial?.body ?? "");
  const [saved, setSaved] = useState(Boolean(initial?.body));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [clicked, setClicked] = useState({ google: !!initial?.googleClicked, facebook: !!initial?.facebookClicked });
  const [videoStatus, setVideoStatus] = useState(initial?.videoStatus ?? "aucune");
  const [consent, setConsent] = useState(false);
  const [upload, setUpload] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await post({ action: "enregistrer", stars, text });
    setBusy(false);
    if (r.ok) setSaved(true);
    else setError(r.json?.error ?? "Pas enregistré. Réessayez.");
  };

  const publish = async (network: "google" | "facebook", url: string) => {
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(network);
    } catch {
      setCopied(null);
    }
    void post({ action: "clic", network });
    setClicked((c) => ({ ...c, [network]: true }));
    window.open(url, "_blank", "noopener");
  };

  const sendVideo = async (file: File) => {
    setVideoError(null);
    if (!consent) return setVideoError("Cochez d'abord l'autorisation ci-dessus.");
    setUpload("Préparation…");
    const start = await post({ action: "depot", fileName: file.name, contentType: file.type || "video/mp4" });
    if (!start.ok) {
      setUpload(null);
      return setVideoError(start.json?.error ?? "Envoi impossible.");
    }
    try {
      await putFile(start.json.signedUrl, file, (p) => setUpload(`Envoi ${Math.round(p * 100)} %`));
    } catch (e) {
      setUpload(null);
      return setVideoError(e instanceof Error ? e.message : "Envoi impossible.");
    }
    const done = await post({ action: "video", path: start.json.path, consent: true });
    setUpload(null);
    if (done.ok) setVideoStatus("a-valider");
    else setVideoError(done.json?.error ?? "La vidéo n'a pas été reçue.");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="parent-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>1. Votre avis</h2>
        <div role="radiogroup" aria-label="Votre note" style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} étoile${n > 1 ? "s" : ""}`} onClick={() => { setStars(n); setSaved(false); }} style={{ background: "none", border: 0, padding: 2, cursor: "pointer", color: n <= stars ? "var(--adm-accent-strong)" : "var(--adm-border)" }}>
              <Star size={34} strokeWidth={1.5} fill={n <= stars ? "currentColor" : "none"} aria-hidden />
            </button>
          ))}
        </div>
        <textarea className="insc-input" rows={5} value={text} placeholder="Ce que votre fille vit à l'académie, ce qui a changé pour elle, ce que vous aimez des éducatrices…" onChange={(e) => { setText(e.target.value); setSaved(false); }} />
        <button type="button" className="nv27-btn-primary" style={{ flex: "none", justifySelf: "start" }} disabled={busy || !stars} onClick={save}>
          {busy ? "Enregistrement…" : saved ? "Avis enregistré" : "Enregistrer mon avis"}
        </button>
        {error && <p role="alert" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p>}
      </div>

      <div className="parent-card" style={{ display: "grid", gap: 10, opacity: saved ? 1 : 0.55 }}>
        <h2 style={{ margin: 0 }}>2. Publiez-le en deux clics</h2>
        <p className="parent-muted" style={{ margin: 0 }}>
          Votre texte est copié automatiquement. La page d&apos;avis s&apos;ouvre : choisissez vos étoiles, collez le texte (appui long, puis « Coller ») et publiez. Google et Facebook demandent que ce soit vous qui cliquiez sur « Publier ».
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {googleUrl ? (
            <button type="button" className="nv27-btn-ghost" disabled={!saved} onClick={() => publish("google", googleUrl)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {clicked.google ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} Publier sur Google
            </button>
          ) : null}
          {facebookUrl ? (
            <button type="button" className="nv27-btn-ghost" disabled={!saved} onClick={() => publish("facebook", facebookUrl)} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {clicked.facebook ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} Publier sur Facebook
            </button>
          ) : null}
          {!googleUrl && !facebookUrl ? <p className="parent-muted" style={{ margin: 0 }}>Les liens Google et Facebook arrivent très bientôt. Votre avis est déjà enregistré chez nous.</p> : null}
        </div>
        {copied ? <p style={{ margin: 0, color: "var(--adm-good)", fontWeight: 600 }}>Texte copié : il ne reste qu&apos;à le coller.</p> : null}
      </div>

      <div className="parent-card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Video size={20} strokeWidth={1.75} aria-hidden /> 3. Votre témoignage vidéo · {creditLabel}</h2>
        <p className="parent-muted" style={{ margin: 0 }}>
          Filmez-vous avec votre téléphone, 30 à 60 secondes, à la verticale : qui vous êtes, ce que votre fille vivait avant, ce qui a changé depuis New Valkyria. Une fois votre vidéo validée par l&apos;équipe, {creditLabel.toLowerCase()} s&apos;ajoute à votre crédit (onglet Recommandations).
        </p>
        <p style={{ margin: 0, fontWeight: 600 }}>{VIDEO_STATUS_LABEL[videoStatus] ?? videoStatus}</p>
        {videoStatus !== "approuvee" ? (
          <>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4 }} />
              <span>J&apos;autorise New Valkyria à publier ma vidéo sur son site et ses réseaux sociaux.</span>
            </label>
            <label className="nv27-btn-primary" style={{ flex: "none", justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 8, cursor: upload ? "wait" : "pointer" }}>
              <Upload size={16} aria-hidden />
              {upload ?? (videoStatus === "aucune" ? "Me filmer ou choisir une vidéo" : "Envoyer une nouvelle vidéo")}
              <input type="file" accept="video/*" capture="user" hidden disabled={!!upload} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendVideo(f); e.target.value = ""; }} />
            </label>
          </>
        ) : null}
        {videoError && <p role="alert" style={{ margin: 0, color: "var(--adm-bad)" }}>{videoError}</p>}
      </div>
    </div>
  );
}
