"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const post = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/admin/avis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: !!res?.ok, json: res ? await res.json().catch(() => null) : null };
};

/** Voir, valider (crédit versé) ou refuser un témoignage vidéo ; afficher un avis écrit sur le site. */
export function ReviewActions({ id, videoStatus, hasVideo, showOnSite, canValidate }: { id: string; videoStatus: string; hasVideo: boolean; showOnSite: boolean; canValidate: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await post({ id, ...body });
    setBusy(false);
    if (!r.ok) setMsg(r.json?.error ?? "Pas enregistré.");
    router.refresh();
    return r;
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {hasVideo && (
        <button type="button" className="admin-btn-ghost" disabled={busy} onClick={async () => { const r = await post({ action: "voir", id }); setUrl(r.json?.url ?? null); }}>
          Voir la vidéo
        </button>
      )}
      {hasVideo && videoStatus === "a-valider" && canValidate && (
        <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => act({ action: "valider" })}>Valider (crédit versé)</button>
      )}
      {hasVideo && videoStatus === "a-valider" && (
        <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => act({ action: "refuser" })}>À refaire</button>
      )}
      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        <input type="checkbox" checked={showOnSite} disabled={busy} onChange={(e) => act({ action: "site", show: e.target.checked })} /> Afficher sur le site
      </label>
      {msg && <span style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{msg}</span>}
      {url && (
        <div role="dialog" aria-label="Témoignage vidéo" onClick={() => setUrl(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <video src={url} controls autoPlay playsInline style={{ maxWidth: "min(480px, 100%)", maxHeight: "85vh", borderRadius: 12 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export function ReviewSettingsForm({ googleUrl, facebookUrl, creditCents }: { googleUrl: string; facebookUrl: string; creditCents: number }) {
  const router = useRouter();
  const [g, setG] = useState(googleUrl);
  const [f, setF] = useState(facebookUrl);
  const [c, setC] = useState(String(creditCents / 100));
  const [state, setState] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 10, padding: "14px 16px" }}>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Lien « Écrire un avis » de la fiche Google
        <input className="admin-input" value={g} placeholder="https://g.page/r/…/review" onChange={(e) => setG(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Page des avis Facebook
        <input className="admin-input" value={f} placeholder="https://www.facebook.com/newvalkyria/reviews" onChange={(e) => setF(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)", maxWidth: 260 }}>
        Crédit pour un témoignage vidéo validé ($)
        <input className="admin-input" type="number" min={0} value={c} onChange={(e) => setC(e.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="admin-btn-primary" onClick={async () => { const r = await post({ action: "reglages", googleUrl: g, facebookUrl: f, videoCreditCents: Math.round(Number(c) * 100) }); setState(r.ok ? "Enregistré" : r.json?.error ?? "Erreur"); router.refresh(); }}>
          Enregistrer
        </button>
        {state && <span style={{ color: "var(--adm-text-2)" }}>{state}</span>}
      </div>
    </div>
  );
}
