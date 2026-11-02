"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PlanRow {
  weekStart: string;
  closed: boolean;
  theme: string | null;
  notes: string | null;
  blockLabel: string | null;
  testWeek: boolean;
  byCategory: Record<string, string>;
  practices: number;
  ready: number;
  matches: number;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const weekLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${SHORT[d.getUTCMonth()]}`;
};

/** Plan de l'année semaine par semaine : bloc, thème (et thème propre à une catégorie), semaine de tests. */
export function SeasonPlanEditor({ seasonId, rows, categories, currentWeek }: { seasonId: string; rows: PlanRow[]; categories: string[]; currentWeek: string }) {
  const allMonths = [...new Set(rows.map((r) => r.weekStart.slice(0, 7)))];
  const pastMonths = allMonths.filter((m) => m < currentWeek.slice(0, 7));
  const [showPast, setShowPast] = useState(false);
  const months = showPast ? allMonths : allMonths.filter((m) => m >= currentWeek.slice(0, 7));
  const blocks = [...new Set(rows.map((r) => r.blockLabel).filter((b): b is string => Boolean(b)))];
  const [openWeek, setOpenWeek] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <datalist id="plan-blocks">{blocks.map((b) => <option key={b} value={b} />)}</datalist>
      {pastMonths.length > 0 && (
        <button type="button" className="admin-btn-ghost" onClick={() => setShowPast(!showPast)} style={{ justifySelf: "start" }}>
          {showPast ? "Cacher les mois passés" : `Voir les ${pastMonths.length} mois passés`}
        </button>
      )}
      {months.map((m) => {
        const [y, mo] = m.split("-").map(Number);
        return (
          <section key={m} className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2" style={{ textTransform: "capitalize" }}>{MONTHS[mo - 1]} {y}</h2>
            </div>
            <ul className="sp-weeks">
              {rows
                .filter((r) => r.weekStart.slice(0, 7) === m)
                .map((r) =>
                  r.closed ? (
                    <li key={r.weekStart} className="sp-week" data-closed="true">
                      <span className="sp-date">Sem. du {weekLabel(r.weekStart)}</span>
                      <span className="sp-meta">Fermé (pas de séance)</span>
                    </li>
                  ) : (
                    <WeekRow key={r.weekStart} seasonId={seasonId} row={r} categories={categories} current={r.weekStart === currentWeek} open={openWeek === r.weekStart} onToggle={() => setOpenWeek(openWeek === r.weekStart ? null : r.weekStart)} />
                  )
                )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function WeekRow({ seasonId, row, categories, current, open, onToggle }: { seasonId: string; row: PlanRow; categories: string[]; current: boolean; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [theme, setTheme] = useState(row.theme ?? "");
  const [block, setBlock] = useState(row.blockLabel ?? "");
  const [testWeek, setTestWeek] = useState(row.testWeek);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [byCat, setByCat] = useState<Record<string, string>>(row.byCategory ?? {});
  const [state, setState] = useState<{ kind: "idle" | "saving" | "error"; message?: string }>({ kind: "idle" });
  const overrides = Object.entries(row.byCategory ?? {}).filter(([, v]) => v);

  const save = async () => {
    if (!theme.trim()) return setState({ kind: "error", message: "Écris le thème de la semaine." });
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/season-themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seasonId, weekStartDate: row.weekStart, theme, notes: notes || null, blockLabel: block || null, testWeek, byCategory: byCat })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "Pas enregistré : réessaie." });
    setState({ kind: "idle" });
    onToggle();
    router.refresh();
  };

  return (
    <li className="sp-week" data-current={String(current)}>
      <button type="button" className="sp-head" onClick={onToggle} aria-expanded={open}>
        <span className="sp-date">Sem. du {weekLabel(row.weekStart)}{current ? " · cette semaine" : ""}</span>
        <span className="sp-theme">
          {row.blockLabel && <span className="sp-block">{row.blockLabel}</span>}
          {row.theme ?? <span style={{ color: "var(--adm-warn)" }}>Thème à choisir</span>}
          {overrides.length > 0 && <span className="sp-meta"> · {overrides.map(([c, t]) => `${c} : ${t}`).join(" · ")}</span>}
        </span>
        <span className="sp-meta">
          {row.testWeek && <span className="mda-pill" data-tone="accent">Tests du mois</span>}
          {row.practices > 0 && <span>{row.ready}/{row.practices} pratiques prêtes</span>}
          {row.matches > 0 && <span>{row.matches} match{row.matches > 1 ? "s" : ""}</span>}
        </span>
      </button>
      {open && (
        <div className="sp-form">
          <label className="ct-field"><span>Thème de la semaine</span><input className="admin-input" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex. Conduite tête levée" /></label>
          <label className="ct-field"><span>Bloc (4 à 6 semaines)</span><input className="admin-input" list="plan-blocks" value={block} onChange={(e) => setBlock(e.target.value)} placeholder="Ex. Bloc 2 : conduite et protection" /></label>
          <label className="sp-check">
            <input type="checkbox" checked={testWeek} onChange={(e) => setTestWeek(e.target.checked)} />
            Semaine du test du mois (passeport)
          </label>
          {categories.length > 0 && (
            <div className="ct-field">
              <span>Thème différent pour une catégorie (laisser vide = même thème)</span>
              <div className="sp-cats">
                {categories.map((c) => (
                  <label key={c} className="ct-field">
                    <span>{c}</span>
                    <input className="admin-input" value={byCat[c] ?? ""} onChange={(e) => setByCat((prev) => ({ ...prev, [c]: e.target.value }))} />
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="ct-field"><span>Notes pour les éducateurs</span><textarea className="admin-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="cm-actions">
            <button type="button" className="admin-btn-primary" onClick={save} disabled={state.kind === "saving"}>{state.kind === "saving" ? "Enregistrement…" : "Enregistrer la semaine"}</button>
            {state.kind === "error" && <span style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }} role="alert">{state.message}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
