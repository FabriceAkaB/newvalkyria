"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { CalendarEvent } from "@/lib/calendar-repo";
import type { Terrain } from "@/lib/terrains-repo";

const ACTIVITY_COLORS: Record<string, string> = {
  Pratique: "#7fd88f",
  Match: "#ff9999",
  Tournoi: "#f0c878",
  Camp: "#88c0d0",
  Évaluation: "#c3a6ff",
  "Activité privée": "#e0b0d8",
  Réunion: "#9d9da0",
  Autre: "#9d9da0"
};

function formatDateHeading(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export function AdminCalendrier({ events, terrains, from, to }: { events: CalendarEvent[]; terrains: Terrain[]; from: string; to: string }) {
  const router = useRouter();
  const [terrainFilter, setTerrainFilter] = useState<string>("");
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  const filtered = terrainFilter ? events.filter((e) => e.terrainId === terrainFilter) : events;

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const navigate = () => {
    router.push(`/admin/calendrier?from=${fromInput}&to=${toInput}`);
  };

  const terrainName = (id: string | null) => terrains.find((t) => t.id === id)?.name ?? null;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Calendrier</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Toutes les activités (pratiques, matchs, tournois...) et tous les essais, saisons confondues, en un seul endroit.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "center" }}>
            <input type="date" className="admin-input" value={fromInput} onChange={(e) => setFromInput(e.target.value)} style={{ width: "auto" }} />
            <span style={{ color: "#6d6b71", fontSize: "0.78rem" }}>→</span>
            <input type="date" className="admin-input" value={toInput} onChange={(e) => setToInput(e.target.value)} style={{ width: "auto" }} />
            <button onClick={navigate} className="admin-btn-ghost" style={{ fontSize: "0.78rem" }}>Appliquer</button>

            <select className="admin-input" value={terrainFilter} onChange={(e) => setTerrainFilter(e.target.value)} style={{ width: "auto", marginLeft: "auto" }}>
              <option value="">Tous les terrains</option>
              {terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {byDate.length === 0 && <p className="admin-empty-text">Aucune activité ni essai dans cette plage de dates.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {byDate.map(([date, dayEvents]) => (
              <div key={date}>
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c3a6ff", textTransform: "capitalize", marginBottom: "0.5rem" }}>
                  {formatDateHeading(date)}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {dayEvents.map((e) => (
                    <div key={`${e.kind}-${e.id}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.55rem 0.85rem" }}>
                      <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: e.kind === "essai" ? "#88c0d0" : (ACTIVITY_COLORS[e.activityType ?? ""] ?? "#9d9da0"), flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", color: "#9d9da0", minWidth: "5.5rem" }}>
                        {e.startTime ? `${e.startTime.slice(0, 5)}–${e.endTime?.slice(0, 5) ?? ""}` : "Essai"}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: "#fff", flex: 1 }}>{e.title}</span>
                      {(terrainName(e.terrainId) || e.location) && (
                        <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>{terrainName(e.terrainId) ?? e.location}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
