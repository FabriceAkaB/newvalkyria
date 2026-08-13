"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { computeHours, formatHours } from "@/lib/coach-payroll";
import { ACTIVITY_TYPES, type CoachActivity } from "@/lib/coaches-repo";
import type { Terrain } from "@/lib/terrains-repo";

interface Props {
  activities: CoachActivity[];
  terrains: Terrain[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function NewActivityForm({ terrains, onCreated }: { terrains: Terrain[]; onCreated: (activity: CoachActivity) => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("19:25");
  const [type, setType] = useState<string>(ACTIVITY_TYPES[0]);
  const [location, setLocation] = useState("");
  const [terrainId, setTerrainId] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coach-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityDate: date,
          startTime: start,
          endTime: end,
          activityType: type,
          location: location.trim() || null,
          terrainId: terrainId || null,
          category: category.trim() || null,
          title: title.trim() || null
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erreur"); }
      const data = await res.json();
      onCreated({
        id: data.id, activity_date: date, start_time: start, end_time: end, activity_type: type,
        location: location.trim() || null, terrain_id: terrainId || null, category: category.trim() || null, title: title.trim() || null,
        notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      window.location.href = `/admin/entraineurs/activites/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSaving(false);
    }
  };

  if (!open) return <button className="admin-btn-primary" onClick={() => setOpen(true)}>+ Nouvelle activité</button>;

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="admin-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input className="admin-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <select className="admin-input" value={type} onChange={(e) => setType(e.target.value)}>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <input className="admin-input" placeholder="Lieu (texte libre)" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: "1 1 140px" }} />
        <select className="admin-input" value={terrainId} onChange={(e) => setTerrainId(e.target.value)} style={{ flex: "1 1 160px" }}>
          <option value="">Terrain (pour vérifier les conflits)</option>
          {terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="admin-input" placeholder="Catégorie (ex. 2016)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: "1 1 140px" }} />
        <input className="admin-input" placeholder="Titre (optionnel)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: "1 1 180px" }} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="admin-btn-primary" onClick={create} disabled={saving}>{saving ? "..." : "Créer et assigner des entraîneurs"}</button>
        <button className="admin-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
      </div>
      {error && <p className="admin-error">{error}</p>}
    </div>
  );
}

export function AdminCoachActivites({ activities: initial, terrains }: Props) {
  const [activities, setActivities] = useState(initial);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Activités</p>
            <Link href="/admin/entraineurs" className="admin-btn-ghost" style={{ textDecoration: "none" }}>
              ← Entraîneurs
            </Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Pratiques, matchs, tournois, camps et toute autre activité — assignez les entraîneurs présents sur chacune.
          </p>

          <NewActivityForm terrains={terrains} onCreated={(a) => setActivities((prev) => [a, ...prev])} />

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Durée</th>
                  <th>Type</th>
                  <th>Catégorie</th>
                  <th>Lieu</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="admin-tr-clickable" onClick={() => { window.location.href = `/admin/entraineurs/activites/${a.id}`; }}>
                    <td>{new Date(a.activity_date + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>{a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}</td>
                    <td>{formatHours(computeHours(a.start_time, a.end_time))}</td>
                    <td>{a.title ? `${a.activity_type} — ${a.title}` : a.activity_type}</td>
                    <td>{a.category ?? "—"}</td>
                    <td>{a.location ?? "—"}</td>
                  </tr>
                ))}
                {activities.length === 0 && (
                  <tr><td colSpan={6} className="admin-empty-text">Aucune activité pour le moment.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
