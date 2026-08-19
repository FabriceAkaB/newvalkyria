"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { CalendarMonthGrid } from "@/components/admin-calendrier-month";
import { CalendarWeekGrid } from "@/components/admin-calendrier-week";
import type { CalendarEvent } from "@/lib/calendar-repo";
import type { Terrain } from "@/lib/terrains-repo";

function CalendarSubscription() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/calendar-feed").then((r) => r.json()).then((d) => setToken(d.token)).catch(() => setToken(null));
  }, []);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/api/calendar/${token}.ics` : null;

  const copy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const regenerate = async () => {
    if (!confirm("Régénérer le lien invalidera l'abonnement actuel — il faudra le remplacer partout où il est utilisé. Continuer ?")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/admin/calendar-feed", { method: "POST" });
      const data = await res.json();
      setToken(data.token);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", marginBottom: "1.5rem" }}>
      <p style={{ fontSize: "0.68rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.4rem" }}>Abonnement calendrier (Google Calendar, Apple Calendar, Outlook)</p>
      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.6rem" }}>
        Ajoutez ce lien comme calendrier &laquo; par URL &raquo; dans votre application préférée — les activités et essais se mettent à jour automatiquement.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input className="admin-input" readOnly value={url ?? "Chargement..."} style={{ flex: "1 1 320px", fontSize: "0.72rem", color: "#9d9da0" }} onFocus={(e) => e.target.select()} />
        <button onClick={copy} disabled={!url} className="admin-btn-ghost" style={{ fontSize: "0.72rem" }}>{copied ? "Copié !" : "Copier"}</button>
        <button onClick={regenerate} disabled={regenerating || !token} className="admin-btn-ghost" style={{ fontSize: "0.72rem", color: "#ff9999" }}>
          {regenerating ? "..." : "Régénérer"}
        </button>
      </div>
    </div>
  );
}

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

const KIND_COLORS: Record<string, string> = {
  essai: "#88c0d0",
  seance_privee: "#f0a8c0",
  sport_etudes: "#78a8f0"
};

function eventDotColor(e: CalendarEvent): string {
  if (e.kind === "activite") return ACTIVITY_COLORS[e.activityType ?? ""] ?? "#9d9da0";
  return KIND_COLORS[e.kind] ?? "#9d9da0";
}

const KIND_LABELS: Record<string, string> = {
  essai: "Essai",
  seance_privee: "Séance privée",
  sport_etudes: "Sport-Études"
};

function eventTypeLabel(e: CalendarEvent): string {
  return e.kind === "activite" ? (e.activityType ?? "Autre") : (KIND_LABELS[e.kind] ?? e.kind);
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export function AdminCalendrier({
  events,
  terrains,
  from,
  to,
  coachNames
}: {
  events: CalendarEvent[];
  terrains: Terrain[];
  from: string;
  to: string;
  coachNames: string[];
}) {
  const router = useRouter();
  const [terrainFilter, setTerrainFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [coachFilter, setCoachFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "semaine" | "mois">("list");
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  const typeOptions = useMemo(() => Array.from(new Set(events.map((e) => eventTypeLabel(e)))).sort(), [events]);
  const categoryOptions = useMemo(
    () => Array.from(new Set(events.map((e) => e.category).filter((c): c is string => Boolean(c)))).sort(),
    [events]
  );

  const filtered = events.filter((e) => {
    if (terrainFilter && e.terrainId !== terrainFilter) return false;
    if (typeFilter && eventTypeLabel(e) !== typeFilter) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (coachFilter && !(e.coachNames ?? "").includes(coachFilter)) return false;
    return true;
  });

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

          <CalendarSubscription />

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
            <input type="date" className="admin-input" value={fromInput} onChange={(e) => setFromInput(e.target.value)} style={{ width: "auto" }} />
            <span style={{ color: "#6d6b71", fontSize: "0.78rem" }}>→</span>
            <input type="date" className="admin-input" value={toInput} onChange={(e) => setToInput(e.target.value)} style={{ width: "auto" }} />
            <button onClick={navigate} className="admin-btn-ghost" style={{ fontSize: "0.78rem" }}>Appliquer</button>

            <div style={{ display: "flex", gap: "0.3rem", marginLeft: "auto" }}>
              {(["list", "semaine", "mois"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={viewMode === mode ? "admin-btn-primary" : "admin-btn-ghost"}
                  style={{ fontSize: "0.72rem", padding: "0.35rem 0.7rem" }}
                >
                  {mode === "list" ? "Liste" : mode === "semaine" ? "Semaine" : "Mois"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <select className="admin-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "auto" }}>
              <option value="">Tous les types</option>
              {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="admin-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: "auto" }}>
              <option value="">Toutes les catégories</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="admin-input" value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)} style={{ width: "auto" }}>
              <option value="">Tous les entraîneurs</option>
              {coachNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select className="admin-input" value={terrainFilter} onChange={(e) => setTerrainFilter(e.target.value)} style={{ width: "auto" }}>
              <option value="">Tous les terrains</option>
              {terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {filtered.length === 0 && <p className="admin-empty-text">Aucune activité ni essai dans cette plage de dates.</p>}

          {viewMode === "semaine" && filtered.length > 0 && (
            <CalendarWeekGrid events={filtered} terrains={terrains} anchor={from} dotColor={eventDotColor} />
          )}

          {viewMode === "mois" && filtered.length > 0 && (
            <CalendarMonthGrid events={filtered} terrains={terrains} anchor={from} dotColor={eventDotColor} />
          )}

          {viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {byDate.map(([date, dayEvents]) => (
                <div key={date}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c3a6ff", textTransform: "capitalize", marginBottom: "0.5rem" }}>
                    {formatDateHeading(date)}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {dayEvents.map((e) => (
                      <div key={`${e.kind}-${e.id}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.55rem 0.85rem" }}>
                        <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: eventDotColor(e), flexShrink: 0 }} />
                        <span style={{ fontSize: "0.75rem", color: "#9d9da0", minWidth: "5.5rem" }}>
                          {e.startTime ? `${e.startTime.slice(0, 5)}–${e.endTime?.slice(0, 5) ?? ""}` : e.kind === "essai" ? "Essai" : "Heure à confirmer"}
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#fff", flex: 1 }}>{e.title}</span>
                        {e.coachNames && <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>{e.coachNames}</span>}
                        {(terrainName(e.terrainId) || e.location) && (
                          <span style={{ fontSize: "0.72rem", color: "#6d6b71" }}>{terrainName(e.terrainId) ?? e.location}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
