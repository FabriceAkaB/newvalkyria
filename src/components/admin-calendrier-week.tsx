"use client";

import type { CalendarEvent } from "@/lib/calendar-repo";
import type { Terrain } from "@/lib/terrains-repo";

function startOfWeek(iso: string): Date {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0=dimanche
  const diff = day === 0 ? -6 : 1 - day; // lundi comme premier jour
  d.setDate(d.getDate() + diff);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CalendarWeekGrid({
  events,
  terrains,
  anchor,
  dotColor
}: {
  events: CalendarEvent[];
  terrains: Terrain[];
  anchor: string;
  dotColor: (e: CalendarEvent) => string;
}) {
  const monday = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  const terrainName = (id: string | null) => terrains.find((t) => t.id === id)?.name ?? null;
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(9rem, 1fr))", gap: "0.6rem", overflowX: "auto" }}>
      {days.map((d) => {
        const iso = isoDate(d);
        const dayEvents = (byDate.get(iso) ?? []).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
        return (
          <div key={iso} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem", minHeight: "8rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#c3a6ff", textTransform: "capitalize", marginBottom: "0.5rem" }}>
              {d.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric" })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {dayEvents.map((e) => (
                <div key={`${e.kind}-${e.id}`} style={{ display: "flex", alignItems: "flex-start", gap: "0.35rem" }}>
                  <span style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: dotColor(e), flexShrink: 0, marginTop: "0.25rem" }} />
                  <div>
                    <p style={{ fontSize: "0.68rem", color: "#fff", margin: 0, lineHeight: 1.3 }}>{e.title}</p>
                    <p style={{ fontSize: "0.62rem", color: "#6d6b71", margin: 0 }}>
                      {e.startTime ? `${e.startTime.slice(0, 5)}–${e.endTime?.slice(0, 5) ?? ""}` : "Essai"}
                      {(terrainName(e.terrainId) || e.location) ? ` · ${terrainName(e.terrainId) ?? e.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {dayEvents.length === 0 && <p style={{ fontSize: "0.65rem", color: "#3d3b42", margin: 0 }}>—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
