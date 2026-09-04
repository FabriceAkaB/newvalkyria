"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";

interface TrialSlot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  location: string;
  max_places: number;
  eligible_birth_years: string[];
  eligible_levels: string[] | null;
  active: boolean;
  taken: number;
  remaining: number;
  isFull: boolean;
}

const LEVEL_OPTIONS = ["Débutante", "D3", "D2", "D1"];

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const emptyForm = {
  slotDate: "",
  startTime: "18:00",
  endTime: "19:30",
  location: "",
  maxPlaces: 5,
  eligibleBirthYears: "",
  eligibleLevels: [] as string[],
  allLevels: true
};

export function AdminEssaisDates({ initialSlots }: { initialSlots: TrialSlot[] }) {
  const [slots, setSlots] = useState(initialSlots);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/admin/essais-dates");
    const data = await res.json();
    setSlots(data.slots ?? []);
  };

  const createSlot = async () => {
    const years = form.eligibleBirthYears.split(",").map((y) => y.trim()).filter(Boolean);
    if (!form.slotDate || !form.startTime || !form.endTime || !form.location || years.length === 0) {
      setError("Date, heures, lieu et au moins une année de naissance sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/essais-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotDate: form.slotDate,
          startTime: form.startTime,
          endTime: form.endTime,
          location: form.location,
          maxPlaces: form.maxPlaces,
          eligibleBirthYears: years,
          eligibleLevels: form.allLevels || form.eligibleLevels.length === 0 ? null : form.eligibleLevels
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur");
      setForm(emptyForm);
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (slot: TrialSlot) => {
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, active: !s.active } : s)));
    await fetch(`/api/admin/essais-dates/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !slot.active })
    });
  };

  const updateMaxPlaces = async (slot: TrialSlot, maxPlaces: number) => {
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, max_places: maxPlaces } : s)));
    await fetch(`/api/admin/essais-dates/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPlaces })
    });
  };

  const removeSlot = async (slot: TrialSlot) => {
    if (!window.confirm(`Retirer définitivement la date du ${formatDate(slot.slot_date)} ?`)) return;
    const res = await fetch(`/api/admin/essais-dates/${slot.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      alert(data?.error ?? "Erreur lors de la suppression.");
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== slot.id));
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Dates d&apos;essai gratuit</p>
            <button className="admin-btn-primary" onClick={() => setShowForm((v) => !v)} style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}>
              {showForm ? "Annuler" : "+ Ajouter une date"}
            </button>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Les dates proposées aux familles dans le formulaire d&apos;essai gratuit (Automne/Hiver), selon l&apos;année
            de naissance et le niveau. Ajoute ou retire des dates ici pour ajuster les transitions entre périodes.
          </p>

          {showForm && (
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <label className="admin-field" style={{ gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "#7a7982" }}>Date</span>
                  <input type="date" className="admin-input" value={form.slotDate} onChange={(e) => setForm({ ...form, slotDate: e.target.value })} />
                </label>
                <label className="admin-field" style={{ gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "#7a7982" }}>Heure début</span>
                  <input className="admin-input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} style={{ width: "6rem" }} />
                </label>
                <label className="admin-field" style={{ gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "#7a7982" }}>Heure fin</span>
                  <input className="admin-input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} style={{ width: "6rem" }} />
                </label>
                <label className="admin-field" style={{ gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.68rem", color: "#7a7982" }}>Places max</span>
                  <input type="number" min={1} className="admin-input" value={form.maxPlaces} onChange={(e) => setForm({ ...form, maxPlaces: Number(e.target.value) })} style={{ width: "5rem" }} />
                </label>
              </div>
              <label className="admin-field" style={{ gap: "0.25rem" }}>
                <span style={{ fontSize: "0.68rem", color: "#7a7982" }}>Lieu</span>
                <input className="admin-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="École Hubert-Maisonneuve, Rosemère" />
              </label>
              <label className="admin-field" style={{ gap: "0.25rem" }}>
                <span style={{ fontSize: "0.68rem", color: "#7a7982" }}>Années de naissance admissibles (séparées par une virgule)</span>
                <input className="admin-input" value={form.eligibleBirthYears} onChange={(e) => setForm({ ...form, eligibleBirthYears: e.target.value })} placeholder="2016, 2017" />
              </label>
              <div>
                <span style={{ fontSize: "0.68rem", color: "#7a7982", display: "block", marginBottom: "0.4rem" }}>Niveaux admissibles</span>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "#fff", marginRight: "1rem" }}>
                  <input type="checkbox" checked={form.allLevels} onChange={(e) => setForm({ ...form, allLevels: e.target.checked })} />
                  Tous niveaux
                </label>
                {!form.allLevels && LEVEL_OPTIONS.map((lvl) => (
                  <label key={lvl} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "#fff", marginRight: "1rem" }}>
                    <input
                      type="checkbox"
                      checked={form.eligibleLevels.includes(lvl)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          eligibleLevels: e.target.checked ? [...form.eligibleLevels, lvl] : form.eligibleLevels.filter((l) => l !== lvl)
                        })
                      }
                    />
                    {lvl}
                  </label>
                ))}
              </div>
              {error && <p className="admin-error-text">{error}</p>}
              <button className="admin-btn-primary" onClick={createSlot} disabled={saving} style={{ alignSelf: "flex-start", fontSize: "0.78rem" }}>
                {saving ? "..." : "Créer la date"}
              </button>
            </div>
          )}

          {slots.length === 0 && <p className="admin-empty-text">Aucune date d&apos;essai pour l&apos;instant.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {slots.map((s) => (
              <div key={s.id} style={{ background: "#100e17", border: `1px solid ${s.active ? "#251f30" : "#1a1a1a"}`, borderRadius: "8px", padding: "0.7rem 1rem", opacity: s.active ? 1 : 0.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <p style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, margin: 0, textTransform: "capitalize" }}>
                      {formatDate(s.slot_date)} · {s.start_time}–{s.end_time}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: "0.2rem 0 0" }}>
                      {s.location} · Années {s.eligible_birth_years.join(", ")} · Niveaux {s.eligible_levels ? s.eligible_levels.join(", ") : "tous"}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "0.75rem", color: s.isFull ? "#f0c878" : "#8fce9f" }}>{s.taken}/{s.max_places} places</span>
                    <input
                      type="number"
                      min={s.taken}
                      className="admin-input"
                      value={s.max_places}
                      onChange={(e) => updateMaxPlaces(s, Number(e.target.value))}
                      style={{ width: "4rem", fontSize: "0.72rem" }}
                      title="Places maximum"
                    />
                    <button className="admin-btn-ghost" onClick={() => toggleActive(s)} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>
                      {s.active ? "Désactiver" : "Activer"}
                    </button>
                    <button className="admin-btn-ghost" onClick={() => removeSlot(s)} style={{ fontSize: "0.7rem", padding: "0.3rem 0.6rem" }}>
                      Retirer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
