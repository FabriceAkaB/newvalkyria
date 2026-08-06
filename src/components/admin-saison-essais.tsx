"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BirthCategory, Program, Registration, Season, TimeSlotTemplate } from "@/lib/season-admin-repo";

interface Props {
  season: Season;
  categories: BirthCategory[];
  programs: Program[];
  slots: TimeSlotTemplate[];
  initialTrials: Registration[];
}

function playerName(r: Registration): string {
  const name = [r.player_first_name, r.player_last_name].filter(Boolean).join(" ");
  return name || "Sans nom";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminSaisonEssais({ season, categories, programs, slots, initialTrials }: Props) {
  const [trials, setTrials] = useState(initialTrials);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversion, setConversion] = useState<Record<string, { programId: string; categoryId: string; timeSlotTemplateId: string }>>({});

  const patch = async (id: string, body: Record<string, unknown>) => {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/season/${season.id}/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const handleFieldPatch = async (id: string, body: Record<string, unknown>, apply: (r: Registration) => Registration) => {
    const ok = await patch(id, body);
    if (ok) setTrials((prev) => prev.map((r) => (r.id === id ? apply(r) : r)));
  };

  const conversionFor = (r: Registration) =>
    conversion[r.id] ?? { programId: r.program_id ?? "", categoryId: r.category_id ?? "", timeSlotTemplateId: r.time_slot_template_id ?? "" };

  const setConversionField = (r: Registration, field: "programId" | "categoryId" | "timeSlotTemplateId", value: string) => {
    setConversion((prev) => ({ ...prev, [r.id]: { ...conversionFor(r), [field]: value } }));
  };

  const handleConvert = async (r: Registration) => {
    const c = conversionFor(r);
    if (!c.programId || !c.categoryId) {
      setError("Programme et catégorie requis pour convertir l'essai.");
      return;
    }
    const ok = await patch(r.id, {
      convertToOfficial: {
        programId: c.programId,
        categoryId: c.categoryId,
        timeSlotTemplateId: c.timeSlotTemplateId || null
      }
    });
    if (ok) setTrials((prev) => prev.filter((t) => t.id !== r.id));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = trials.filter((r) => r.trial_date && new Date(r.trial_date) >= today);
  const past = trials.filter((r) => !r.trial_date || new Date(r.trial_date) < today);

  const renderTrial = (r: Registration) => {
    const isSaving = saving === r.id;
    const c = conversionFor(r);
    const availableSlots = c.categoryId ? slots.filter((s) => s.category_ids.includes(c.categoryId)) : slots;
    return (
      <div key={r.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", opacity: isSaving ? 0.6 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.65rem" }}>
          <div>
            <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff", margin: 0 }}>{playerName(r)}</p>
            <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", margin: "0.15rem 0 0" }}>{r.parent_name} · {r.parent_email} · {r.parent_phone}</p>
          </div>
          <span style={{ fontSize: "0.6rem", color: "#88c0d0", background: "rgba(136,192,208,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>Essai</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem", marginBottom: "0.85rem" }}>
          <label className="admin-field" style={{ gap: "0.3rem" }}>
            <span style={{ fontSize: "0.6rem" }}>Date d&apos;essai</span>
            <input
              type="date"
              className="admin-input"
              min={todayISO()}
              value={r.trial_date ?? ""}
              onChange={(e) => handleFieldPatch(r.id, { trialDate: e.target.value || null }, (row) => ({ ...row, trial_date: e.target.value || null }))}
            />
          </label>
          <label className="admin-field" style={{ gap: "0.3rem" }}>
            <span style={{ fontSize: "0.6rem" }}>Groupe visé — catégorie</span>
            <select className="admin-input" value={c.categoryId} onChange={(e) => setConversionField(r, "categoryId", e.target.value)}>
              <option value="">—</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </label>
          <label className="admin-field" style={{ gap: "0.3rem" }}>
            <span style={{ fontSize: "0.6rem" }}>Groupe visé — programme</span>
            <select className="admin-input" value={c.programId} onChange={(e) => setConversionField(r, "programId", e.target.value)}>
              <option value="">—</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
          </label>
          <label className="admin-field" style={{ gap: "0.3rem" }}>
            <span style={{ fontSize: "0.6rem" }}>Plage horaire visée</span>
            <select className="admin-input" value={c.timeSlotTemplateId} onChange={(e) => setConversionField(r, "timeSlotTemplateId", e.target.value)}>
              <option value="">Non assignée</option>
              {availableSlots.map((s) => <option key={s.id} value={s.id}>{s.day} {s.start_time}–{s.end_time} · {s.location}</option>)}
            </select>
          </label>
        </div>

        <button
          onClick={() => handleConvert(r)}
          disabled={isSaving}
          className="admin-btn-primary"
          style={{ padding: "0.45rem 0.9rem", fontSize: "0.75rem" }}
        >
          Convertir en inscription officielle →
        </button>
        {(!c.programId || !c.categoryId) && (
          <p style={{ fontSize: "0.68rem", color: "#ffb464", margin: "0.4rem 0 0" }}>
            Choisissez une catégorie et un programme ci-dessus pour activer la conversion.
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Essais gratuits</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Joueuses à l&apos;essai pour {season.label} — planifiez la date, indiquez le groupe visé, puis convertissez en inscription officielle une fois le paiement reçu.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>À venir ({upcoming.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2rem" }}>
            {upcoming.length === 0 && <p className="admin-empty-text">Aucun essai à venir.</p>}
            {upcoming.map(renderTrial)}
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Sans date / passés ({past.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {past.length === 0 && <p className="admin-empty-text">Aucun essai dans cette liste.</p>}
            {past.map(renderTrial)}
          </div>
        </div>
      </div>
    </>
  );
}
