"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { Season } from "@/lib/season-admin-repo";
import { mondayOfWeek, type SeasonTheme } from "@/lib/season-themes-repo";

function nextMondays(count: number): string[] {
  const dates: string[] = [];
  let d = new Date(mondayOfWeek(new Date()));
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return dates;
}

export function AdminThemes({ seasons, currentSeason, themes: initialThemes }: { seasons: Season[]; currentSeason: string; themes: SeasonTheme[] }) {
  const router = useRouter();
  const [themes, setThemes] = useState(initialThemes);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const themeByWeek = new Map(themes.map((t) => [t.week_start_date, t]));
  const weeks = nextMondays(16);

  const save = async (weekStartDate: string) => {
    const theme = (drafts[weekStartDate] ?? "").trim();
    if (!theme) return;
    setSaving(weekStartDate);
    try {
      const res = await fetch("/api/admin/season-themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: currentSeason, weekStartDate, theme })
      });
      if (!res.ok) return;
      setThemes((prev) => {
        const existing = prev.find((t) => t.week_start_date === weekStartDate);
        if (existing) return prev.map((t) => (t.week_start_date === weekStartDate ? { ...t, theme } : t));
        return [...prev, { id: crypto.randomUUID(), season_id: currentSeason, week_start_date: weekStartDate, theme, notes: null, created_at: new Date().toISOString() }];
      });
      setDrafts((prev) => ({ ...prev, [weekStartDate]: "" }));
    } finally {
      setSaving(null);
    }
  };

  const remove = async (id: string) => {
    setThemes((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/admin/season-themes/${id}`, { method: "DELETE" });
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Thèmes saisonniers</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Planifiez le thème pédagogique de chaque semaine — les entraîneurs le voient sur leur tableau de bord.
          </p>

          <select
            className="admin-input"
            value={currentSeason}
            onChange={(e) => router.push(`/admin/themes?saison=${e.target.value}`)}
            style={{ width: "auto", marginBottom: "1.5rem" }}
          >
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {weeks.map((week) => {
              const existing = themeByWeek.get(week);
              const weekLabel = new Date(week + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
              return (
                <div key={week} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.9rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#6d6b71", minWidth: "7rem" }}>Sem. du {weekLabel}</span>
                  {existing ? (
                    <>
                      <span style={{ fontSize: "0.85rem", color: "#fff", flex: 1 }}>{existing.theme}</span>
                      <button onClick={() => remove(existing.id)} style={{ fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer" }}>×</button>
                    </>
                  ) : (
                    <>
                      <input
                        className="admin-input"
                        placeholder="Thème (ex. Contrôle, 1v1...)"
                        value={drafts[week] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [week]: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                      <button onClick={() => save(week)} disabled={saving === week} className="admin-btn-ghost" style={{ fontSize: "0.72rem" }}>
                        {saving === week ? "..." : "Enregistrer"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
