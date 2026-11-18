"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ouvrir un camp de jour ou un groupe parascolaire (brouillon), depuis sa section de l'admin. */
export function NewKindProgram({ kind }: { kind: "camp" | "parascolaire" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [years, setYears] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState(kind === "camp" ? "40" : "20");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" className="admin-btn-primary" onClick={() => setOpen(true)}>
        {kind === "camp" ? "Ouvrir un camp" : "Ouvrir un groupe parascolaire"}
      </button>
    );
  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/programmes/nouveau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, school, birthYears: years.split(/[\s,;-]+/).filter(Boolean), priceCents: Math.round(Number(price.replace(",", ".") || 0) * 100), capacity: Number(capacity) })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Pas créé : réessaie.");
    router.push(`/admin/programme/${data.slug}`);
  };
  return (
    <div className="mda-card" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <label className="ct-field"><span>Nom</span><input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "camp" ? "Camp d'été 2027, semaine 1" : "Parascolaire école des Bâtisseurs"} /></label>
        {kind === "parascolaire" ? <label className="ct-field"><span>École</span><input className="admin-input" value={school} onChange={(e) => setSchool(e.target.value)} /></label> : null}
        <label className="ct-field"><span>Années de naissance</span><input className="admin-input" value={years} onChange={(e) => setYears(e.target.value)} placeholder="2015 2016 2017" /></label>
        <label className="ct-field"><span>Prix ($)</span><input className="admin-input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} /></label>
        <label className="ct-field"><span>Places</span><input className="admin-input" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} /></label>
      </div>
      <p className="mda-sub" style={{ margin: 0 }}>Créé en brouillon (non publié) : ajoute ensuite les dates, la page et les paiements dans sa fiche, puis publie-le quand tout est prêt.</p>
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" disabled={busy || !name.trim()} onClick={create}>{busy ? "Création…" : "Créer le brouillon"}</button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
        {error ? <span style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{error}</span> : null}
      </div>
    </div>
  );
}
