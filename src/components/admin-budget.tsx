"use client";

import { useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { BudgetVsActual } from "@/lib/revenue-calc";
import { EXPENSE_CATEGORIES } from "@/lib/revenue-repo";
import { formatCAD } from "@/lib/season-2027";

interface Props {
  initialRows: BudgetVsActual[];
}

function BudgetRow({ row, onSaved }: { row: BudgetVsActual; onSaved: (category: string, budgetCents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.budgetCents / 100));
  const [saving, setSaving] = useState(false);

  const pct = row.budgetCents > 0 ? Math.round((row.actualCents / row.budgetCents) * 100) : null;
  const barColor = pct === null ? "var(--adm-accent)" : pct > 100 ? "var(--adm-bad)" : pct >= 80 ? "var(--adm-warn)" : "var(--adm-good)";

  const save = async () => {
    const dollars = parseFloat(value.replace(",", "."));
    if (Number.isNaN(dollars) || dollars < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue-budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: row.category, amountCents: Math.round(dollars * 100) })
      });
      if (res.ok) { onSaved(row.category, Math.round(dollars * 100)); setEditing(false); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: 0 }}>{row.category}</p>
        {editing ? (
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="number" min={0} step="0.01" className="admin-input"
              style={{ width: "100px", fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
              value={value} onChange={(e) => setValue(e.target.value)} autoFocus
            />
            <button onClick={save} disabled={saving} className="admin-btn-primary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}>{saving ? "..." : "OK"}</button>
            <button onClick={() => setEditing(false)} className="admin-btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}>Annuler</button>
          </span>
        ) : (
          <span style={{ fontSize: "0.75rem", color: "var(--adm-text-2)" }}>
            Budget : <strong style={{ color: "var(--adm-text-2)" }}>{formatCAD(row.budgetCents / 100)}</strong>
            <button onClick={() => { setValue(String(row.budgetCents / 100)); setEditing(true); }} style={{ marginLeft: "0.5rem", color: "var(--adm-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              {row.budgetCents > 0 ? "modifier" : "fixer"}
            </button>
          </span>
        )}
      </div>

      <div style={{ height: "6px", borderRadius: "3px", background: "var(--adm-line)", overflow: "hidden", marginBottom: "0.4rem" }}>
        <div style={{ height: "100%", width: `${pct === null ? 0 : Math.min(100, pct)}%`, background: barColor, borderRadius: "3px" }} />
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--adm-text-2)", margin: 0 }}>
        Dépensé : {formatCAD(row.actualCents / 100)}
        {pct !== null && <span style={{ color: barColor }}> ({pct}% du budget)</span>}
        {pct !== null && pct > 100 && <span style={{ color: "var(--adm-bad)" }}> — dépassé de {formatCAD((row.actualCents - row.budgetCents) / 100)}</span>}
      </p>
    </div>
  );
}

export function AdminBudget({ initialRows }: Props) {
  const [rows, setRows] = useState(() => {
    const byCategory = new Map(initialRows.map((r) => [r.category, r] as const));
    const allCategories = new Set<string>([...EXPENSE_CATEGORIES, ...initialRows.map((r) => r.category)]);
    return Array.from(allCategories).map((category) => byCategory.get(category) ?? { category, budgetCents: 0, actualCents: 0 });
  });

  const handleSaved = (category: string, budgetCents: number) => {
    setRows((prev) => prev.map((r) => (r.category === category ? { ...r, budgetCents } : r)));
  };

  const totalBudget = useMemo(() => rows.reduce((s, r) => s + r.budgetCents, 0), [rows]);
  const totalActual = useMemo(() => rows.reduce((s, r) => s + r.actualCents, 0), [rows]);
  const totalPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : null;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Budget annuel</p>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", marginBottom: "1.5rem" }}>
            Fixez un budget annuel par catégorie de charge — comparé automatiquement aux dépenses réelles (payées et à payer), toutes saisons confondues.
          </p>

          <div style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--adm-text-2)", margin: "0 0 0.3rem", textTransform: "uppercase" }}>Total</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>
              {formatCAD(totalActual / 100)} {totalBudget > 0 && <span style={{ fontSize: "0.9rem", color: "var(--adm-text-2)" }}>/ {formatCAD(totalBudget / 100)}</span>}
            </p>
            {totalPct !== null && (
              <p style={{ fontSize: "0.78rem", color: totalPct > 100 ? "var(--adm-bad)" : "var(--adm-good)", margin: 0 }}>{totalPct}% du budget annuel utilisé</p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {rows.map((r) => <BudgetRow key={r.category} row={r} onSaved={handleSaved} />)}
          </div>
        </div>
      </div>
    </>
  );
}
