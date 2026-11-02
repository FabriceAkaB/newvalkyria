"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { ExpenseAttachments } from "@/components/admin-expense-attachments";
import type { Season } from "@/lib/season-admin-repo";
import { formatCAD } from "@/lib/season-2027";
import { GENERAL_KEY, type AccountBalance, type FinancialAlert, type FinancialDashboard, type FinancialHealth, type MonthlyBucket, type RevenueSummary, type SeasonRevenue } from "@/lib/revenue-calc";
import { EXPENSE_CATEGORIES, PAYMENT_ACCOUNTS, type RevenueExpense } from "@/lib/revenue-repo";

interface Props {
  summary: RevenueSummary;
  dashboard: FinancialDashboard;
  seasons: Season[];
}

function DefaultSeasonSetting({ seasons }: { seasons: Season[] }) {
  const active = seasons.find((s) => s.is_active);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(active?.id ?? "");
  const [current, setCurrent] = useState(active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/season-default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: value })
      });
      if (res.ok) { setCurrent(seasons.find((s) => s.id === value)); setEditing(false); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", color: "var(--adm-text-2)", marginBottom: "0.75rem" }}>
      <span>Saison par défaut (utilisée partout où aucune saison n&apos;est choisie) :</span>
      {editing ? (
        <>
          <select className="admin-input" style={{ fontSize: "0.72rem", padding: "0.25rem 0.4rem", width: "auto" }} value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={save} disabled={saving} className="admin-btn-primary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.66rem" }}>{saving ? "..." : "OK"}</button>
          <button onClick={() => setEditing(false)} className="admin-btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.66rem" }}>Annuler</button>
        </>
      ) : (
        <>
          <strong style={{ color: "var(--adm-text-2)" }}>{current?.label ?? "Aucune"}</strong>
          <button onClick={() => { setValue(current?.id ?? ""); setEditing(true); }} style={{ color: "var(--adm-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Modifier
          </button>
        </>
      )}
    </div>
  );
}

const HEALTH_LABELS: Record<FinancialHealth, { label: string; color: string; soft: string }> = {
  excellente: { label: "Situation saine", color: "var(--adm-good)", soft: "var(--adm-good-soft)" },
  "a-surveiller": { label: "À surveiller", color: "var(--adm-warn)", soft: "var(--adm-warn-soft)" },
  critique: { label: "Situation critique", color: "var(--adm-bad)", soft: "var(--adm-bad-soft)" }
};

function KpiTile({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  return (
    <div style={{ flex: "1 1 180px", minWidth: 0, background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: 12, padding: "1rem 1.1rem" }}>
      <p style={{ fontSize: "0.82rem", color: "var(--adm-text-2)", margin: "0 0 0.35rem" }}>{label}</p>
      <p style={{ fontSize: "1.45rem", fontWeight: 600, letterSpacing: "-0.01em", color: valueColor ?? "var(--adm-text)", margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub && <p style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", margin: "0.3rem 0 0", lineHeight: 1.35 }}>{sub}</p>}
    </div>
  );
}

function AlertsList({ alerts }: { alerts: FinancialAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", margin: "1rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
      {alerts.map((a, i) => (
        <li key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.86rem", color: "var(--adm-text)" }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0, background: a.level === "critical" ? "var(--adm-bad)" : "var(--adm-warn)" }} />
          {a.message}
        </li>
      ))}
    </ul>
  );
}

/** Vue d'ensemble financière : une réponse principale (combien la saison a rapporté, vers quel objectif),
 *  puis les 4 questions de JP (disponible, à encaisser, à payer, marge), le reste replié. */
function FinancialDashboardPanel({ dashboard, seasonGoalCents }: { dashboard: FinancialDashboard; seasonGoalCents: number }) {
  const health = HEALTH_LABELS[dashboard.health];
  const cash7 = dashboard.cashFlow.find((c) => c.horizonDays === 7);
  const seasonLabel = dashboard.activeSeasonLabel ?? "la saison";
  const pct = seasonGoalCents > 0 ? Math.min(100, Math.round((dashboard.revenueSeasonCents / seasonGoalCents) * 100)) : null;
  const toPayCents = dashboard.payrollDueCents + dashboard.billsDueCents;
  const periodRows: [string, number, number][] = [
    ["Aujourd'hui", dashboard.revenueTodayCents, dashboard.expenseTodayCents],
    ["Cette semaine", dashboard.revenueWeekCents, 0],
    ["Ce mois-ci", dashboard.revenueMonthCents, dashboard.expenseMonthCents],
    [seasonLabel, dashboard.revenueSeasonCents, dashboard.expenseSeasonCents]
  ];

  return (
    <section style={{ marginBottom: "1.75rem" }}>
      {/* Héros */}
      <div style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: 16, padding: "1.4rem 1.5rem", marginBottom: "0.9rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "0.9rem", color: "var(--adm-text-2)", margin: 0 }}>Encaissé · {seasonLabel}</p>
            <p style={{ fontSize: "2.6rem", fontWeight: 700, letterSpacing: "-0.03em", margin: "0.15rem 0 0", fontVariantNumeric: "tabular-nums" }}>
              {formatCAD(dashboard.revenueSeasonCents / 100)}
            </p>
            <p style={{ fontSize: "0.9rem", color: dashboard.netProfitSeasonCents < 0 ? "var(--adm-bad)" : "var(--adm-good)", margin: "0.25rem 0 0" }}>
              Profit de la saison : {formatCAD(dashboard.netProfitSeasonCents / 100)}
              <span style={{ color: "var(--adm-text-3)" }}> · {formatCAD(dashboard.expenseSeasonCents / 100)} de dépenses</span>
            </p>
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: health.color, background: health.soft, padding: "0.3rem 0.7rem", borderRadius: 999 }}>{health.label}</span>
        </div>
        {pct !== null && (
          <div style={{ marginTop: "1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--adm-text-2)", marginBottom: "0.4rem" }}>
              <span>Objectif de la saison : {formatCAD(seasonGoalCents / 100)}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--adm-text)" }}>{pct} %</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--adm-accent)" }} />
            </div>
          </div>
        )}
        <AlertsList alerts={dashboard.alerts} />
      </div>

      {/* Les 4 questions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <KpiTile label="Argent disponible" value={formatCAD(dashboard.cashAvailableCents / 100)} sub="Encaissé moins les dépenses déjà payées" />
        <KpiTile label="Reste à encaisser" value={formatCAD(dashboard.parentPaymentsDueCents / 100)} sub="Versements de parents à venir" />
        <KpiTile label="Reste à payer" value={formatCAD(toPayCents / 100)} valueColor={toPayCents > 0 ? "var(--adm-warn)" : undefined} sub={`Paie ${formatCAD(dashboard.payrollDueCents / 100)} · factures ${formatCAD(dashboard.billsDueCents / 100)}`} />
        <KpiTile
          label="Dans 7 jours"
          value={cash7 ? formatCAD(cash7.projectedBalanceCents / 100) : "—"}
          valueColor={cash7 && cash7.projectedBalanceCents < 0 ? "var(--adm-bad)" : undefined}
          sub="Argent disponible prévu"
        />
      </div>

      {/* Détail par période, replié */}
      <details style={{ marginTop: "0.9rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.86rem", color: "var(--adm-text-2)" }}>Détail par période</summary>
        <div className="admin-table-wrap" style={{ marginTop: "0.6rem" }}>
          <table className="admin-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Période</th><th style={{ textAlign: "right" }}>Revenus</th><th style={{ textAlign: "right" }}>Dépenses</th></tr>
            </thead>
            <tbody>
              {periodRows.map(([label, rev, exp]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td style={{ textAlign: "right" }}>{formatCAD(rev / 100)}</td>
                  <td style={{ textAlign: "right", color: exp > 0 ? "var(--adm-text)" : "var(--adm-text-3)" }}>{exp > 0 ? formatCAD(exp / 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", margin: "0.5rem 0 0" }}>Le solde bancaire n&apos;est pas encore relié : l&apos;argent disponible est calculé à partir des paiements et des dépenses enregistrés.</p>
      </details>
    </section>
  );
}

function GoalEditor({ card, onSaved }: { card: SeasonRevenue; onSaved: (goalCents: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(card.goalCents / 100));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const dollars = parseFloat(value.replace(",", "."));
    if (Number.isNaN(dollars) || dollars < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonKey: card.key, seasonLabel: card.label, goalCents: Math.round(dollars * 100) })
      });
      if (res.ok) { onSaved(Math.round(dollars * 100)); setEditing(false); }
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(card.goalCents / 100)); setEditing(true); }}
        style={{ fontSize: "0.68rem", color: "var(--adm-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
      >
        {card.goalCents > 0 ? "Modifier l'objectif" : "Fixer un objectif"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <input
        type="number"
        min={0}
        step="0.01"
        className="admin-input"
        style={{ width: "100px", fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button onClick={save} disabled={saving} className="admin-btn-primary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}>
        {saving ? "..." : "OK"}
      </button>
      <button onClick={() => setEditing(false)} className="admin-btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}>
        Annuler
      </button>
    </div>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function ExpensesPanel({
  card,
  onExpensesChanged
}: {
  card: SeasonRevenue;
  onExpensesChanged: (key: string, expenses: RevenueExpense[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]);
  const [taxRate, setTaxRate] = useState("0");
  const [paidWith, setPaidWith] = useState<string>(PAYMENT_ACCOUNTS[0]);
  const [recurring, setRecurring] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"paid" | "due">("paid");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addExpense = async () => {
    const dollars = parseFloat(amount.replace(",", "."));
    const taxPct = parseFloat(taxRate.replace(",", ".")) || 0;
    if (!label.trim() || Number.isNaN(dollars) || dollars <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonKey: card.key,
          category,
          label: label.trim(),
          amountCents: Math.round(dollars * 100),
          expenseDate: date,
          isRecurring: recurring,
          recurrenceEndDate: recurring && endDate ? endDate : null,
          taxRate: taxPct / 100,
          paidWith,
          status,
          dueDate: status === "due" ? (dueDate || null) : null
        })
      });
      if (res.ok) {
        const data = (await res.json()) as { expense: RevenueExpense };
        onExpensesChanged(card.key, [data.expense, ...card.expenses]);
        setLabel("");
        setAmount("");
        setTaxRate("0");
        setRecurring(false);
        setEndDate("");
        setStatus("paid");
        setDueDate("");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/revenue-expenses/${id}`, { method: "DELETE" });
      if (res.ok) onExpensesChanged(card.key, card.expenses.filter((e) => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const markPaid = async (id: string) => {
    setMarkingPaidId(id);
    try {
      const res = await fetch(`/api/admin/revenue-expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" })
      });
      if (res.ok) onExpensesChanged(card.key, card.expenses.map((e) => (e.id === id ? { ...e, status: "paid" as const } : e)));
    } finally {
      setMarkingPaidId(null);
    }
  };

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: "0.68rem", color: "var(--adm-bad)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
      >
        {open ? "Fermer les charges" : `Charges (${card.expenses.length})`}
      </button>

      {open && (
        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {card.expensesByCategory.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.3rem" }}>
              {card.expensesByCategory.map((c) => (
                <div key={c.category} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--adm-text-2)" }}>
                  <span>{c.category}</span>
                  <span>{formatCAD(c.amountCents / 100)}</span>
                </div>
              ))}
            </div>
          )}

          {card.expenses.map((e) => {
            const expanded = expandedId === e.id;
            return (
              <div key={e.id} style={{ background: expanded ? "var(--adm-surface)" : undefined, borderRadius: expanded ? "8px" : undefined, padding: expanded ? "0.5rem" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "var(--adm-text-2)" }}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : e.id)}
                    style={{ background: "none", border: "none", color: "var(--adm-text-2)", cursor: "pointer", padding: 0, textAlign: "left" }}
                  >
                    {expanded ? "▾ " : "▸ "}{e.label} · {e.category} · {e.expense_date} · {e.paid_with}
                    {e.tax_rate > 0 && ` · tx ${(e.tax_rate * 100).toFixed(2)}%`}
                    {e.is_recurring && <span title="Charge récurrente"> 🔁</span>}
                    {e.status === "due" && (
                      <span style={{ color: "var(--adm-warn)" }}> · À payer{e.due_date ? ` (échéance ${e.due_date})` : ""}</span>
                    )}
                  </button>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ color: "var(--adm-bad)" }}>-{formatCAD(e.amount_cents / 100)}</span>
                    {e.status === "due" && (
                      <button
                        onClick={() => markPaid(e.id)}
                        disabled={markingPaidId === e.id}
                        style={{ background: "none", border: "none", color: "var(--adm-good)", cursor: "pointer", fontSize: "0.68rem", padding: 0, textDecoration: "underline" }}
                      >
                        {markingPaidId === e.id ? "..." : "Marquer payée"}
                      </button>
                    )}
                    <button
                      onClick={() => deleteExpense(e.id)}
                      disabled={deletingId === e.id}
                      style={{ background: "none", border: "none", color: "var(--adm-text-3)", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1, padding: 0 }}
                      aria-label="Supprimer la charge"
                    >
                      ×
                    </button>
                  </span>
                </div>
                {expanded && (
                  <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--adm-surface-2)" }}>
                    <ExpenseAttachments expenseId={e.id} />
                  </div>
                )}
              </div>
            );
          })}
          {card.expenses.length === 0 && <p style={{ fontSize: "0.7rem", color: "var(--adm-text-3)", margin: 0 }}>Aucune charge.</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.3rem" }}>
            <input
              type="text"
              placeholder="Description"
              className="admin-input"
              style={{ flex: "1 1 110px", fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              className="admin-input"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Montant"
              className="admin-input"
              style={{ width: "75px", fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="date"
              className="admin-input"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", color: "var(--adm-text-2)" }}>
              Taxe %
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="admin-input"
                style={{ width: "60px", fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </label>
            <select
              className="admin-input"
              style={{ fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
              value={paidWith}
              onChange={(e) => setPaidWith(e.target.value)}
            >
              {PAYMENT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={addExpense} disabled={saving} className="admin-btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}>
              {saving ? "..." : "Ajouter"}
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "var(--adm-text-2)", cursor: "pointer" }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Charge récurrente (chaque mois)
          </label>
          {recurring && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "var(--adm-text-2)" }}>
              Jusqu&apos;au (optionnel)
              <input
                type="date"
                className="admin-input"
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", color: "var(--adm-text-2)", cursor: "pointer" }}>
              <input type="radio" name={`status-${card.key}`} checked={status === "paid"} onChange={() => setStatus("paid")} />
              Payée maintenant
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.68rem", color: "var(--adm-text-2)", cursor: "pointer" }}>
              <input type="radio" name={`status-${card.key}`} checked={status === "due"} onChange={() => setStatus("due")} />
              À payer plus tard (facture)
            </label>
            {status === "due" && (
              <input
                type="date"
                className="admin-input"
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.5rem" }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Échéance"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueCard({
  card,
  onGoalSaved,
  onExpensesChanged
}: {
  card: SeasonRevenue;
  onGoalSaved: (key: string, goalCents: number) => void;
  onExpensesChanged: (key: string, expenses: RevenueExpense[]) => void;
}) {
  const pct = card.goalCents > 0 ? Math.min(100, Math.round((card.totalCents / card.goalCents) * 100)) : null;
  const barColor = pct === null ? "var(--adm-accent)" : pct >= 100 ? "var(--adm-good)" : pct >= 60 ? "var(--adm-info)" : "var(--adm-warn)";

  return (
    <div style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: "12px", padding: "1.1rem 1.25rem", minWidth: "240px", flex: "1 1 240px" }}>
      <p style={{ fontSize: "0.72rem", color: "var(--adm-text-3)", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
      <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>{formatCAD(card.totalCents / 100)}</p>
      {card.taxCents > 0 && (
        <p style={{ fontSize: "0.68rem", color: "var(--adm-text-3)", margin: "0 0 0.2rem" }}>
          Net avant taxe : {formatCAD(card.netCents / 100)} · Taxe : {formatCAD(card.taxCents / 100)}
        </p>
      )}
      <p style={{ fontSize: "0.75rem", color: card.profitCents < 0 ? "var(--adm-bad)" : "var(--adm-good)", margin: "0 0 0.5rem" }}>
        Profit : {formatCAD(card.profitCents / 100)}
        {card.expenseCents > 0 && <span style={{ color: "var(--adm-text-3)" }}> (-{formatCAD(card.expenseCents / 100)} de charges)</span>}
      </p>

      {card.key === GENERAL_KEY && (
        <p style={{ margin: "0 0 0.5rem" }}>
          <Link href="/admin/entraineurs/paie" style={{ fontSize: "0.68rem", color: "var(--adm-accent)", textDecoration: "underline" }}>
            Inclut les salaires payés — voir le détail →
          </Link>
        </p>
      )}

      {card.goalCents > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ height: "6px", borderRadius: "3px", background: "var(--adm-line)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "3px" }} />
          </div>
          <p style={{ fontSize: "0.68rem", color: "var(--adm-text-2)", margin: "0.3rem 0 0" }}>
            {pct}% de l&apos;objectif de {formatCAD(card.goalCents / 100)}
          </p>
        </div>
      )}

      {card.paidCount > 0 || card.unknownCount > 0 ? (
        <p style={{ fontSize: "0.7rem", color: "var(--adm-text-3)", margin: "0 0 0.5rem" }}>
          {card.paidCount} payée(s)
          {card.unknownCount > 0 && <span style={{ color: "var(--adm-warn)" }}> · {card.unknownCount} montant(s) inconnu(s)</span>}
        </p>
      ) : null}

      <GoalEditor card={card} onSaved={(goalCents) => onGoalSaved(card.key, goalCents)} />
      <ExpensesPanel card={card} onExpensesChanged={onExpensesChanged} />
    </div>
  );
}

function RevenueTaxSetting({ initialRate }: { initialRate: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(initialRate * 100));
  const [rate, setRate] = useState(initialRate);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const pct = parseFloat(value.replace(",", "."));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueTaxRate: pct / 100 })
      });
      if (res.ok) { setRate(pct / 100); setEditing(false); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", color: "var(--adm-text-2)", marginBottom: "1.25rem" }}>
      <span>Taux de taxe appliqué aux revenus :</span>
      {editing ? (
        <>
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className="admin-input"
            style={{ width: "70px", fontSize: "0.72rem", padding: "0.25rem 0.4rem" }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <span>%</span>
          <button onClick={save} disabled={saving} className="admin-btn-primary" style={{ padding: "0.25rem 0.5rem", fontSize: "0.66rem" }}>
            {saving ? "..." : "OK"}
          </button>
          <button onClick={() => setEditing(false)} className="admin-btn-ghost" style={{ padding: "0.25rem 0.5rem", fontSize: "0.66rem" }}>
            Annuler
          </button>
        </>
      ) : (
        <>
          <strong style={{ color: "var(--adm-text-2)" }}>{(rate * 100).toFixed(2)}%</strong>
          <button
            onClick={() => { setValue(String(rate * 100)); setEditing(true); }}
            style={{ color: "var(--adm-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            Modifier
          </button>
        </>
      )}
    </div>
  );
}

function MonthlyTable({ months: initialMonths }: { months: MonthlyBucket[] }) {
  const [months, setMonths] = useState(initialMonths);
  const [expanded, setExpanded] = useState(false);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [goalValue, setGoalValue] = useState("");
  const [saving, setSaving] = useState(false);

  const saveGoal = async (month: string) => {
    const dollars = parseFloat(goalValue.replace(",", "."));
    if (Number.isNaN(dollars) || dollars < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue-monthly-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, goalCents: Math.round(dollars * 100) })
      });
      if (res.ok) {
        setMonths((prev) => prev.map((m) => (m.month === month ? { ...m, goalCents: Math.round(dollars * 100) } : m)));
        setEditingMonth(null);
      }
    } finally {
      setSaving(false);
    }
  };

  if (months.length === 0) return null;
  const visible = expanded ? months : months.slice(0, 6);

  return (
    <div style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
      <p style={{ fontSize: "0.72rem", color: "var(--adm-text-3)", margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>Vue par mois</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 1fr 1fr 1.3fr", gap: "0.5rem", fontSize: "0.65rem", color: "var(--adm-text-3)", textTransform: "uppercase" }}>
          <span>Mois</span><span>Revenus</span><span>Charges</span><span>Net</span><span>Objectif</span>
        </div>
        {visible.map((m) => {
          const pct = m.goalCents > 0 ? Math.min(100, Math.round((m.revenueCents / m.goalCents) * 100)) : null;
          return (
            <div key={m.month} style={{ display: "grid", gridTemplateColumns: "0.8fr 1fr 1fr 1fr 1.3fr", gap: "0.5rem", fontSize: "0.78rem", color: "var(--adm-text-2)", alignItems: "center" }}>
              <span>{m.month}</span>
              <span>{formatCAD(m.revenueCents / 100)}</span>
              <span style={{ color: m.expenseCents > 0 ? "var(--adm-bad)" : "var(--adm-text-3)" }}>{m.expenseCents > 0 ? `-${formatCAD(m.expenseCents / 100)}` : "—"}</span>
              <span style={{ color: m.netCents < 0 ? "var(--adm-bad)" : "var(--adm-good)", fontWeight: 600 }}>{formatCAD(m.netCents / 100)}</span>
              {editingMonth === m.month ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="admin-input"
                    style={{ width: "70px", fontSize: "0.7rem", padding: "0.2rem 0.4rem" }}
                    value={goalValue}
                    onChange={(e) => setGoalValue(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => saveGoal(m.month)} disabled={saving} className="admin-btn-primary" style={{ padding: "0.2rem 0.4rem", fontSize: "0.64rem" }}>OK</button>
                </span>
              ) : (
                <span style={{ fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  {m.goalCents > 0 ? `${pct}% de ${formatCAD(m.goalCents / 100)}` : "—"}
                  <button
                    onClick={() => { setGoalValue(String(m.goalCents / 100)); setEditingMonth(m.month); }}
                    style={{ color: "var(--adm-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    {m.goalCents > 0 ? "modifier" : "fixer"}
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {months.length > 6 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ marginTop: "0.75rem", fontSize: "0.68rem", color: "var(--adm-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
        >
          {expanded ? "Réduire" : `Voir tous les mois (${months.length})`}
        </button>
      )}
    </div>
  );
}

function AccountsPanel({ accounts }: { accounts: AccountBalance[] }) {
  return (
    <div style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
      <p style={{ fontSize: "0.72rem", color: "var(--adm-text-3)", margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>Comptes</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        {accounts.map((a) => (
          <div key={a.account} style={{ flex: "1 1 180px", minWidth: "180px" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--adm-text-2)", margin: "0 0 0.2rem", fontWeight: 600 }}>{a.account}</p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: a.balanceCents < 0 ? "var(--adm-bad)" : "#fff", margin: "0 0 0.2rem" }}>{formatCAD(a.balanceCents / 100)}</p>
            <p style={{ fontSize: "0.68rem", color: "var(--adm-text-3)", margin: 0 }}>
              Revenus {formatCAD(a.revenueCents / 100)} · Charges {formatCAD(a.expenseCents / 100)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminRevenus({ summary, dashboard, seasons }: Props) {
  const [cards, setCards] = useState<SeasonRevenue[]>(summary.seasons);
  const [boutique, setBoutique] = useState<SeasonRevenue>(summary.boutique);
  const [general, setGeneral] = useState<SeasonRevenue>(summary.general);

  const updateCard = (key: string, patch: Partial<SeasonRevenue>) => {
    const apply = (c: SeasonRevenue) => (c.key === key ? { ...c, ...patch, profitCents: c.totalCents - (patch.expenseCents ?? c.expenseCents) } : c);
    if (key === boutique.key) { setBoutique((b) => apply(b)); return; }
    if (key === general.key) { setGeneral((g) => apply(g)); return; }
    setCards((prev) => prev.map(apply));
  };

  const handleGoalSaved = (key: string, goalCents: number) => updateCard(key, { goalCents });
  const handleExpensesChanged = (key: string, expenses: RevenueExpense[]) => {
    const expenseCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
    updateCard(key, { expenses, expenseCents });
  };

  const allCards = [...cards, boutique, general];
  const grandTotalCents = allCards.reduce((s, c) => s + c.totalCents, 0);
  const grandGoalCents = allCards.reduce((s, c) => s + c.goalCents, 0);
  const grandExpenseCents = allCards.reduce((s, c) => s + c.expenseCents, 0);
  const grandNetCents = grandTotalCents - grandExpenseCents;
  const hasUnknown = cards.some((c) => c.unknownCount > 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Vue d&apos;ensemble</p>
            <a href="/api/admin/revenue-export" className="admin-btn-ghost" style={{ padding: "0.4rem 0.8rem", fontSize: "0.72rem", textDecoration: "none" }}>
              ↓ Exporter en CSV
            </a>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", marginBottom: "0.75rem" }}>
            Revenu réellement encaissé par saison (versements comptés seulement une fois prélevés), avec vos objectifs financiers, vos charges et vos taxes.
          </p>

          <FinancialDashboardPanel dashboard={dashboard} seasonGoalCents={cards.find((c) => c.label === dashboard.activeSeasonLabel)?.goalCents ?? 0} />

          <DefaultSeasonSetting seasons={seasons} />
          <RevenueTaxSetting initialRate={summary.revenueTaxRate} />

          {hasUnknown && (
            <p style={{ fontSize: "0.75rem", color: "var(--adm-warn)", background: "var(--adm-warn-soft)", border: "1px solid rgba(255,180,100,0.3)", borderRadius: "8px", padding: "0.6rem 0.9rem", marginBottom: "1.25rem" }}>
              Certaines inscriptions payées n&apos;ont pas de prix de programme associé — leur montant n&apos;est pas inclus dans le total, qui est donc légèrement sous-estimé.
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            {cards.map((card) => (
              <RevenueCard key={card.key} card={card} onGoalSaved={handleGoalSaved} onExpensesChanged={handleExpensesChanged} />
            ))}
            <RevenueCard card={boutique} onGoalSaved={handleGoalSaved} onExpensesChanged={handleExpensesChanged} />
            <RevenueCard card={general} onGoalSaved={handleGoalSaved} onExpensesChanged={handleExpensesChanged} />
          </div>

          <AccountsPanel accounts={summary.accounts} />

          <MonthlyTable months={summary.months} />

          <div style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <p style={{ fontSize: "0.72rem", color: "var(--adm-text-2)", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>Total — toutes saisons et boutique</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>{formatCAD(grandTotalCents / 100)}</p>
            <p style={{ fontSize: "0.85rem", color: grandNetCents < 0 ? "var(--adm-bad)" : "var(--adm-good)", margin: "0 0 0.4rem" }}>
              Profit : {formatCAD(grandNetCents / 100)}
              {grandExpenseCents > 0 && <span style={{ color: "var(--adm-text-2)" }}> (-{formatCAD(grandExpenseCents / 100)} de charges)</span>}
            </p>
            {grandGoalCents > 0 && (
              <p style={{ fontSize: "0.75rem", color: "var(--adm-text-2)", margin: 0 }}>
                {Math.min(100, Math.round((grandTotalCents / grandGoalCents) * 100))}% de l&apos;objectif combiné de {formatCAD(grandGoalCents / 100)}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
