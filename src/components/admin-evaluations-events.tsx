"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { TryoutEvent, TryoutEventStatus } from "@/lib/tryout-repo";

const STATUS_LABELS: Record<TryoutEventStatus, string> = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  termine: "Terminé",
  archive: "Archivé"
};

const STATUS_COLORS: Record<TryoutEventStatus, string> = {
  brouillon: "#9d9da0",
  en_cours: "#8fce9f",
  termine: "#78a8f0",
  archive: "#6d6b71"
};

export function AdminEvaluationsEvents({
  initialEvents,
  participantCounts
}: {
  initialEvents: TryoutEvent[];
  participantCounts: Record<string, number>;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [counts, setCounts] = useState(participantCounts);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/admin/evaluations/events");
    const data = await res.json();
    setEvents(data.events ?? []);
  };

  const createEvent = async () => {
    if (!name.trim() || !eventDate) {
      setError("Nom et date requis");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/evaluations/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, eventDate, location: location || undefined, ageCategory: ageCategory || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erreur");
      setName("");
      setLocation("");
      setAgeCategory("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const duplicateEvent = async (id: string, sourceName: string) => {
    const newName = window.prompt("Nom du nouvel événement", `${sourceName} (copie)`);
    if (!newName) return;
    const newDate = window.prompt("Date (AAAA-MM-JJ)", new Date().toISOString().slice(0, 10));
    if (!newDate) return;
    const res = await fetch(`/api/admin/evaluations/events/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, eventDate: newDate })
    });
    if (res.ok) await refresh();
  };

  const archiveEvent = async (id: string) => {
    if (!window.confirm("Archiver cet événement ?")) return;
    await fetch(`/api/admin/evaluations/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archive" })
    });
    await refresh();
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Journées d&apos;évaluation</p>
            <button className="admin-btn-primary" onClick={() => setShowCreate((v) => !v)} style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}>
              {showCreate ? "Annuler" : "+ Nouvel événement"}
            </button>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Chaque événement est isolé : ses athlètes, ses notes, ses équipes ne se mélangent jamais avec un autre événement.
          </p>

          {showCreate && (
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <input className="admin-input" placeholder="Nom de l'événement" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 2, minWidth: "200px" }} />
                <input type="date" className="admin-input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={{ width: "auto" }} />
              </div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <input className="admin-input" placeholder="Lieu" value={location} onChange={(e) => setLocation(e.target.value)} style={{ flex: 1, minWidth: "160px" }} />
                <input className="admin-input" placeholder="Catégorie / groupe d'âge" value={ageCategory} onChange={(e) => setAgeCategory(e.target.value)} style={{ flex: 1, minWidth: "160px" }} />
              </div>
              {error && <p className="admin-error-text">{error}</p>}
              <button className="admin-btn-primary" onClick={createEvent} disabled={saving} style={{ alignSelf: "flex-start", fontSize: "0.78rem" }}>
                {saving ? "..." : "Créer l'événement"}
              </button>
            </div>
          )}

          {events.length === 0 && <p className="admin-empty-text">Aucun événement.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: STATUS_COLORS[ev.status], display: "inline-block" }} />
                    <Link href={`/admin/evaluations/${ev.id}`} style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", textDecoration: "none" }}>{ev.name}</Link>
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: "0.3rem 0 0" }}>
                    {new Date(ev.event_date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {ev.location ? ` · ${ev.location}` : ""} · {STATUS_LABELS[ev.status]} · {counts[ev.id] ?? 0} athlète{(counts[ev.id] ?? 0) > 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <Link href={`/admin/evaluations/${ev.id}`} className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem", textDecoration: "none" }}>Gérer</Link>
                  <Link href={`/admin/evaluations/${ev.id}/terrain`} className="admin-btn-primary" style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem", textDecoration: "none" }}>Terrain</Link>
                  <button className="admin-btn-ghost" onClick={() => duplicateEvent(ev.id, ev.name)} style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>Dupliquer</button>
                  {ev.status !== "archive" && (
                    <button className="admin-btn-ghost" onClick={() => archiveEvent(ev.id)} style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}>Archiver</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
