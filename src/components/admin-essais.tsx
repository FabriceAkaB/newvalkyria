"use client";

import { useEffect, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { TrialConfig, TrialGroup } from "@/lib/trial-dates-store";

const CATEGORIES = ["2016", "2015", "2014-2013"];

export function AdminEssais() {
  const [config, setConfig] = useState<TrialConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/essais")
      .then((r) => r.json())
      .then((data: TrialConfig) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger la configuration");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/admin/essais", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Erreur de sauvegarde");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const updateGroup = (cat: string, groupIdx: number, field: keyof TrialGroup, value: string) => {
    if (!config) return;
    const newConfig = structuredClone(config);
    const group = newConfig.groups[cat]?.[groupIdx];
    if (!group) return;

    if (field === "label") {
      group.label = value;
    } else if (field === "exception") {
      group.exception = value || undefined;
    } else if (field === "dates") {
      group.dates = value.split("\n").map((s) => s.trim()).filter(Boolean);
    } else if (field === "horaires") {
      group.horaires = value.split("\n").map((s) => s.trim()).filter(Boolean);
    }
    setConfig(newConfig);
  };

  const addGroup = (cat: string) => {
    if (!config) return;
    const newConfig = structuredClone(config);
    if (!newConfig.groups[cat]) newConfig.groups[cat] = [];
    newConfig.groups[cat].push({
      label: "Nouveau groupe",
      dates: [],
      horaires: []
    });
    setConfig(newConfig);
  };

  const removeGroup = (cat: string, groupIdx: number) => {
    if (!config) return;
    const newConfig = structuredClone(config);
    newConfig.groups[cat]?.splice(groupIdx, 1);
    setConfig(newConfig);
  };

  if (loading) {
    return (
      <>
        <AdminTopbar />
        <div className="admin-content">
          <p style={{ color: "#858489" }}>Chargement...</p>
        </div>
      </>
    );
  }

  if (!config) {
    return (
      <>
        <AdminTopbar />
        <div className="admin-content">
          <p className="admin-error">{error || "Configuration introuvable"}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p className="admin-section-title" style={{ margin: 0 }}>Dates d&apos;essai gratuit</p>
            <p style={{ fontSize: "0.75rem", color: "#545359", margin: "0.3rem 0 0" }}>
              Modifiez les dates, horaires et lieu des essais gratuits en temps réel
            </p>
          </div>
          <button onClick={handleSave} disabled={saving} className="admin-btn-primary">
            {saving ? "Sauvegarde..." : saved ? "✓ Sauvegardé" : "Sauvegarder"}
          </button>
        </div>

        {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

        {/* Lieu */}
        <div className="admin-essais-section">
          <p className="admin-essais-section-title">Lieu des essais</p>
          <input
            type="text"
            value={config.lieu}
            onChange={(e) => setConfig({ ...config, lieu: e.target.value })}
            className="admin-essais-input"
            placeholder="Ex: Terrain synthétique — Parc à Rosemère..."
          />
          <input
            type="text"
            value={config.lieuNote}
            onChange={(e) => setConfig({ ...config, lieuNote: e.target.value })}
            className="admin-essais-input"
            placeholder="Note (ex: Le terrain peut changer...)"
            style={{ marginTop: "0.5rem" }}
          />
        </div>

        {/* Groups per category */}
        {CATEGORIES.map((cat) => (
          <div key={cat} className="admin-essais-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="admin-essais-section-title">Catégorie {cat}</p>
              <button onClick={() => addGroup(cat)} className="admin-essais-add-btn">
                + Ajouter un groupe
              </button>
            </div>

            {(config.groups[cat] ?? []).map((group, gi) => (
              <div key={gi} className="admin-essais-group-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <p className="admin-essais-group-label">Groupe {gi + 1}</p>
                  <button onClick={() => removeGroup(cat, gi)} className="admin-essais-remove-btn">
                    Supprimer
                  </button>
                </div>

                <label className="admin-essais-field">
                  <span>Nom du groupe</span>
                  <input
                    type="text"
                    value={group.label}
                    onChange={(e) => updateGroup(cat, gi, "label", e.target.value)}
                    className="admin-essais-input"
                    placeholder="Ex: Groupe 1 — 2015 & 2016"
                  />
                </label>

                <label className="admin-essais-field">
                  <span>Dates (une par ligne)</span>
                  <textarea
                    value={group.dates.join("\n")}
                    onChange={(e) => updateGroup(cat, gi, "dates", e.target.value)}
                    className="admin-essais-textarea"
                    rows={3}
                    placeholder={"Mar 14 avril\nJeu 16 avril\nSam 18 avril"}
                  />
                </label>

                <label className="admin-essais-field">
                  <span>Horaires (un par ligne)</span>
                  <textarea
                    value={group.horaires.join("\n")}
                    onChange={(e) => updateGroup(cat, gi, "horaires", e.target.value)}
                    className="admin-essais-textarea"
                    rows={2}
                    placeholder={"2016 : 18h00 à 19h25\n2015 : 19h30 à 20h55"}
                  />
                </label>

                <label className="admin-essais-field">
                  <span>Exception (optionnel)</span>
                  <input
                    type="text"
                    value={group.exception ?? ""}
                    onChange={(e) => updateGroup(cat, gi, "exception", e.target.value)}
                    className="admin-essais-input"
                    placeholder="Ex: Exception — Sam 18 avril : 2016 de 13h30 à 14h55"
                  />
                </label>
              </div>
            ))}

            {(!config.groups[cat] || config.groups[cat].length === 0) && (
              <p style={{ fontSize: "0.78rem", color: "#48474d", fontStyle: "italic" }}>
                Aucun groupe configuré pour cette catégorie
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
