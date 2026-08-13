"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { Terrain } from "@/lib/terrains-repo";

export function AdminTerrains({ initialTerrains }: { initialTerrains: Terrain[] }) {
  const [terrains, setTerrains] = useState(initialTerrains);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTerrain = async () => {
    if (!name.trim()) {
      setError("Le nom du terrain est requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/terrains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), address: address.trim() || null })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'ajout");
      setTerrains((prev) => [...prev, { id: data.id, name: name.trim(), address: address.trim() || null, active: true, created_at: new Date().toISOString() }].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t: Terrain) => {
    setTerrains((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/admin/terrains/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active })
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce terrain ? Les activités déjà planifiées y resteront affichées avec leur adresse texte, mais ne seront plus reliées à un terrain structuré.")) return;
    setTerrains((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/admin/terrains/${id}`, { method: "DELETE" });
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Terrains</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Configurez les terrains utilisés par l&apos;académie — une activité reliée à un terrain est vérifiée automatiquement pour éviter les doubles réservations.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <input className="admin-input" placeholder="Nom du terrain" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: "1 1 200px" }} />
            <input className="admin-input" placeholder="Adresse (facultatif)" value={address} onChange={(e) => setAddress(e.target.value)} style={{ flex: "1 1 260px" }} />
            <button onClick={addTerrain} disabled={saving} className="admin-btn-primary" style={{ fontSize: "0.78rem" }}>
              {saving ? "..." : "+ Ajouter"}
            </button>
          </div>

          {terrains.length === 0 && <p className="admin-empty-text">Aucun terrain configuré.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {terrains.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.7rem 0.9rem", opacity: t.active ? 1 : 0.5 }}>
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: 0 }}>{t.name}</p>
                  {t.address && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.15rem 0 0" }}>{t.address}</p>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <button onClick={() => toggleActive(t)} className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}>
                    {t.active ? "Désactiver" : "Réactiver"}
                  </button>
                  <button onClick={() => remove(t.id)} style={{ fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.35rem 0.7rem", cursor: "pointer" }}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
