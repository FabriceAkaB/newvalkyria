"use client";

import { useState } from "react";

import type { CalendarEvent } from "@/lib/calendar-repo";
import type { Terrain } from "@/lib/terrains-repo";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CalendarMonthGrid({
  events,
  anchor,
  dotColor
}: {
  events: CalendarEvent[];
  terrains: Terrain[];
  anchor: string;
  dotColor: (e: CalendarEvent) => string;
}) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const anchorDate = new Date(anchor + "T00:00:00");
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1; // lundi=0
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startWeekday);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.4rem", marginBottom: "0.3rem" }}>
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
          <p key={label} style={{ fontSize: "0.65rem", color: "#6d6b71", textAlign: "center", margin: 0 }}>{label}</p>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.4rem" }}>
        {days.map((d) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === month;
          const dayEvents = (byDate.get(iso) ?? []).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          const expanded = openDay === iso;
          return (
            <div
              key={iso}
              style={{
                background: "#100e17",
                border: "1px solid #1f1d25",
                borderRadius: "8px",
                padding: "0.4rem",
                minHeight: "5.5rem",
                opacity: inMonth ? 1 : 0.35
              }}
            >
              <p style={{ fontSize: "0.65rem", color: "#9d9da0", margin: "0 0 0.3rem" }}>{d.getDate()}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {(expanded ? dayEvents : visible).map((e) => (
                  <div key={`${e.kind}-${e.id}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ width: "0.35rem", height: "0.35rem", borderRadius: "50%", background: dotColor(e), flexShrink: 0 }} />
                    <span style={{ fontSize: "0.6rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                  </div>
                ))}
                {!expanded && overflow > 0 && (
                  <button
                    onClick={() => setOpenDay(iso)}
                    style={{ fontSize: "0.6rem", color: "#c3a6ff", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                  >
                    +{overflow} de plus
                  </button>
                )}
                {expanded && dayEvents.length > 3 && (
                  <button
                    onClick={() => setOpenDay(null)}
                    style={{ fontSize: "0.6rem", color: "#6d6b71", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                  >
                    Réduire
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
