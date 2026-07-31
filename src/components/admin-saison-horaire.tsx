"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BirthCategory, Program, Season, TimeSlotDate, TimeSlotTemplate } from "@/lib/season-admin-repo";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface Props {
  season: Season;
  categories: BirthCategory[];
  programs: Program[];
  initialSlots: TimeSlotTemplate[];
  initialDatesBySlot: Record<string, TimeSlotDate[]>;
}

interface NewSlotForm {
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  maxPlaces: number;
  recommendedForAdvanced: boolean;
  advancedOnly: boolean;
  categoryIds: string[];
  programIds: string[];
}

const EMPTY_FORM: NewSlotForm = {
  day: "Lundi",
  startTime: "18:00",
  endTime: "19:25",
  location: "",
  maxPlaces: 8,
  recommendedForAdvanced: false,
  advancedOnly: false,
  categoryIds: [],
  programIds: []
};

export function AdminSaisonHoraire({ season, categories, programs, initialSlots, initialDatesBySlot }: Props) {
  const [slots, setSlots] = useState(initialSlots);
  const [datesBySlot, setDatesBySlot] = useState(initialDatesBySlot);
  const [expandedDates, setExpandedDates] = useState<string | null>(null);
  const [newDateInput, setNewDateInput] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewSlotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id) ? prev.categoryIds.filter((c) => c !== id) : [...prev.categoryIds, id]
    }));
  };

  const toggleProgram = (id: string) => {
    setForm((prev) => ({
      ...prev,
      programIds: prev.programIds.includes(id) ? prev.programIds.filter((p) => p !== id) : [...prev.programIds, id]
    }));
  };

  const handleCreateSlot = async () => {
    if (!form.location.trim() || form.categoryIds.length === 0 || form.programIds.length === 0) {
      setError("Lieu, au moins une catégorie et au moins un programme sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${season.id}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Erreur de création");
      const data = (await res.json()) as { id: string };
      setSlots((prev) => [
        ...prev,
        {
          id: data.id,
          season_id: season.id,
          day: form.day,
          start_time: form.startTime,
          end_time: form.endTime,
          location: form.location,
          max_places: form.maxPlaces,
          recommended_for_advanced: form.recommendedForAdvanced,
          advanced_only: form.advancedOnly,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category_ids: form.categoryIds,
          program_ids: form.programIds
        }
      ]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Supprimer cette plage horaire ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/admin/season/${season.id}/slots/${slotId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleMaxPlacesChange = async (slotId: string, maxPlaces: number) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, max_places: maxPlaces } : s)));
    try {
      await fetch(`/api/admin/season/${season.id}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "slot", slotId, maxPlaces })
      });
    } catch {
      setError("Erreur de sauvegarde de la capacité");
    }
  };

  const handleAddDate = async (slotId: string) => {
    const date = newDateInput[slotId];
    if (!date) return;
    try {
      const res = await fetch(`/api/admin/season/${season.id}/slots/${slotId}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [date] })
      });
      if (!res.ok) throw new Error("Erreur d'ajout");
      const existing = datesBySlot[slotId] ?? [];
      setDatesBySlot((prev) => ({
        ...prev,
        [slotId]: [...existing, { id: `temp-${Date.now()}`, time_slot_template_id: slotId, occurs_on: date, cancelled: false, note: null }].sort(
          (a, b) => a.occurs_on.localeCompare(b.occurs_on)
        )
      }));
      setNewDateInput((prev) => ({ ...prev, [slotId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleRemoveDate = async (slotId: string, dateId: string) => {
    try {
      if (!dateId.startsWith("temp-")) {
        await fetch(`/api/admin/season/${season.id}/slots/${slotId}/dates/${dateId}`, { method: "DELETE" });
      }
      setDatesBySlot((prev) => ({ ...prev, [slotId]: (prev[slotId] ?? []).filter((d) => d.id !== dateId) }));
    } catch {
      setError("Erreur de suppression de date");
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Construction de l&apos;horaire</p>
            <button onClick={() => setShowForm((v) => !v)} className="admin-btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.78rem" }}>
              {showForm ? "Annuler" : "+ Nouvelle plage"}
            </button>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Créez les plages hebdomadaires (lieu, heure, catégorie, places) puis ajoutez les dates réelles du calendrier pour chacune.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          {/* New slot form */}
          {showForm && (
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
                <label className="admin-field">
                  <span>Jour</span>
                  <select className="admin-input" value={form.day} onChange={(e) => setForm((p) => ({ ...p, day: e.target.value }))}>
                    {DAYS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Début</span>
                  <input type="time" className="admin-input" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Fin</span>
                  <input type="time" className="admin-input" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Places max</span>
                  <input type="number" min={1} className="admin-input" value={form.maxPlaces} onChange={(e) => setForm((p) => ({ ...p, maxPlaces: parseInt(e.target.value) || 1 }))} />
                </label>
              </div>
              <label className="admin-field">
                <span>Lieu</span>
                <input type="text" className="admin-input" placeholder="Ex. Sainte-Thérèse" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
              </label>

              <div>
                <p style={{ fontSize: "0.68rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Catégories desservies</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      style={{
                        fontSize: "0.78rem",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "999px",
                        border: form.categoryIds.includes(c.id) ? "1px solid rgba(196,164,228,0.7)" : "1px solid rgba(255,255,255,0.12)",
                        background: form.categoryIds.includes(c.id) ? "rgba(196,164,228,0.15)" : "transparent",
                        color: form.categoryIds.includes(c.id) ? "#fff" : "#9d9da0",
                        cursor: "pointer"
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: "0.68rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Programmes desservis</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {programs.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProgram(p.id)}
                      style={{
                        fontSize: "0.78rem",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "999px",
                        border: form.programIds.includes(p.id) ? "1px solid rgba(196,164,228,0.7)" : "1px solid rgba(255,255,255,0.12)",
                        background: form.programIds.includes(p.id) ? "rgba(196,164,228,0.15)" : "transparent",
                        color: form.programIds.includes(p.id) ? "#fff" : "#9d9da0",
                        cursor: "pointer"
                      }}
                    >
                      {p.id}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "1.25rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#c3c2c8", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.recommendedForAdvanced} onChange={(e) => setForm((p) => ({ ...p, recommendedForAdvanced: e.target.checked }))} />
                  ⭐ Recommandée pour avancées
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#c3c2c8", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.advancedOnly} onChange={(e) => setForm((p) => ({ ...p, advancedOnly: e.target.checked }))} />
                  Réservée aux groupes avancés (cachée du public)
                </label>
              </div>

              <button onClick={handleCreateSlot} disabled={saving} className="admin-btn-primary" style={{ alignSelf: "flex-start" }}>
                {saving ? "Création…" : "Créer la plage"}
              </button>
            </div>
          )}

          {/* Existing slots */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {slots.map((slot) => {
              const dates = datesBySlot[slot.id] ?? [];
              const isExpanded = expandedDates === slot.id;
              return (
                <div key={slot.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1rem 1.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "#fff", margin: 0 }}>
                        {slot.day} {slot.start_time} – {slot.end_time}
                        {slot.recommended_for_advanced && <span style={{ color: "#f0c878", marginLeft: "0.4rem" }}>⭐</span>}
                        {slot.advanced_only && <span style={{ fontSize: "0.6rem", color: "#f0c878", background: "rgba(240,200,120,0.1)", padding: "0.1rem 0.4rem", borderRadius: "4px", marginLeft: "0.5rem" }}>Avancé uniquement</span>}
                      </p>
                      <p style={{ fontSize: "0.78rem", color: "#9f85ba", margin: "0.2rem 0 0" }}>{slot.location}</p>
                      <p style={{ fontSize: "0.68rem", color: "#605f65", margin: "0.2rem 0 0" }}>
                        {slot.category_ids.join(", ")} · {slot.program_ids.join(", ")}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span style={{ fontSize: "0.62rem", color: "#605f65", textTransform: "uppercase" }}>Places</span>
                        <input
                          type="number"
                          min={1}
                          value={slot.max_places}
                          onChange={(e) => handleMaxPlacesChange(slot.id, parseInt(e.target.value) || 1)}
                          style={{ width: "3.2rem", padding: "0.25rem 0.4rem", fontSize: "0.8rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "4px", color: "#fff", textAlign: "center" }}
                        />
                      </label>
                      <button onClick={() => setExpandedDates(isExpanded ? null : slot.id)} className="admin-btn-ghost" style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem" }}>
                        {dates.length} date{dates.length !== 1 ? "s" : ""} {isExpanded ? "▲" : "▼"}
                      </button>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="admin-btn-danger" style={{ padding: "0.4rem 0.75rem", fontSize: "0.72rem" }}>
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #1a1820" }}>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                        <input
                          type="date"
                          value={newDateInput[slot.id] ?? ""}
                          onChange={(e) => setNewDateInput((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                          style={{ padding: "0.4rem 0.6rem", fontSize: "0.78rem", background: "#17151e", border: "1px solid #302e36", borderRadius: "6px", color: "#fff" }}
                        />
                        <button onClick={() => handleAddDate(slot.id)} className="admin-btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: "0.75rem" }}>
                          Ajouter la date
                        </button>
                      </div>
                      {dates.length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#3c3a41", fontStyle: "italic" }}>Aucune date ajoutée pour cette plage.</p>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {dates.map((d) => (
                            <span
                              key={d.id}
                              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c3c2c8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "999px", padding: "0.3rem 0.6rem" }}
                            >
                              {new Date(d.occurs_on + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                              <button onClick={() => handleRemoveDate(slot.id, d.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.6)", cursor: "pointer", fontSize: "0.85rem", padding: 0, lineHeight: 1 }}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {slots.length === 0 && <p className="admin-empty-text">Aucune plage horaire créée pour l&apos;instant.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
