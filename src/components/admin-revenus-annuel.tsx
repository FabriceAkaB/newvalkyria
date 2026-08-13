"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ExpenseAttachments } from "@/components/admin-expense-attachments";
import { AdminTopbar } from "@/components/admin-topbar";
import type { AnnualBreakdown } from "@/lib/revenue-calc";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_ACCOUNTS, type RevenueExpense, type RevenueIncome } from "@/lib/revenue-repo";
import { formatCAD } from "@/lib/season-2027";

interface SeasonOption {
  key: string;
  label: string;
}

interface Props {
  breakdown: AnnualBreakdown;
  expenses: RevenueExpense[];
  income: RevenueIncome[];
  seasonOptions: SeasonOption[];
  currentSeason: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function ExpenseDetailList({ expenses }: { expenses: RevenueExpense[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (expenses.length === 0) {
    return <p className="admin-empty-text">Aucune dépense pour cette sélection.</p>;
  }

  // Les charges "à payer" remontent en premier (les plus urgentes d'abord) —
  // pour savoir tout de suite sur quoi focuser.
  const sorted = [...expenses].sort((a, b) => {
    if (a.status !== b.status) return a.status === "due" ? -1 : 1;
    if (a.status === "due") return (a.due_date ?? "").localeCompare(b.due_date ?? "");
    return b.expense_date.localeCompare(a.expense_date);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {sorted.map((e) => {
        const expanded = expandedId === e.id;
        const due = e.status === "due";
        return (
          <div
            key={e.id}
            style={{
              background: due ? "rgba(255,200,80,0.08)" : "#100e17",
              border: due ? "1px solid rgba(255,200,80,0.35)" : "1px solid #1f1d25",
              borderRadius: "8px",
              padding: "0.6rem 0.9rem"
            }}
          >
            <button
              onClick={() => setExpandedId(expanded ? null : e.id)}
              style={{ background: "none", border: "none", color: "#c3c2c8", cursor: "pointer", padding: 0, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}
            >
              <span>
                {expanded ? "▾ " : "▸ "}{e.label} <span style={{ color: "#6d6b71" }}>· {e.category} · {e.expense_date}</span>
                {due && <span style={{ color: "#f0c878", fontWeight: 600 }}> · 🟡 À venir{e.due_date ? ` (échéance ${e.due_date})` : ""}</span>}
              </span>
              <span style={{ color: due ? "#f0c878" : "#ff9999", fontWeight: 600 }}>-{formatCAD(e.amount_cents / 100)}</span>
            </button>
            {expanded && (
              <div style={{ marginTop: "0.6rem", paddingTop: "0.6rem", borderTop: "1px solid #1a1820", display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                <div style={{ fontSize: "0.75rem", color: "#9d9da0", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  <span>Payé avec : {e.paid_with}</span>
                  {e.tax_rate > 0 && <span>Taxe : {(e.tax_rate * 100).toFixed(2)}%</span>}
                  {e.is_recurring && <span>🔁 Charge récurrente{e.recurrence_end_date ? ` jusqu'au ${e.recurrence_end_date}` : ""}</span>}
                  {e.due_date && <span>Échéance : {e.due_date}</span>}
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <ExpenseAttachments expenseId={e.id} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IncomeDetailList({ income }: { income: RevenueIncome[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (income.length === 0) {
    return <p className="admin-empty-text">Aucun revenu manuel pour cette sélection.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {income.map((i) => {
        const expanded = expandedId === i.id;
        return (
          <div key={i.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.9rem" }}>
            <button
              onClick={() => setExpandedId(expanded ? null : i.id)}
              style={{ background: "none", border: "none", color: "#c3c2c8", cursor: "pointer", padding: 0, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}
            >
              <span>{expanded ? "▾ " : "▸ "}{i.label} <span style={{ color: "#6d6b71" }}>· {i.category} · {i.income_date}</span></span>
              <span style={{ color: "#7fd88f", fontWeight: 600 }}>+{formatCAD(i.amount_cents / 100)}</span>
            </button>
            {expanded && (
              <div style={{ marginTop: "0.6rem", paddingTop: "0.6rem", borderTop: "1px solid #1a1820", fontSize: "0.75rem", color: "#9d9da0", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <span>Reçu avec : {i.paid_with}</span>
                {i.tax_rate > 0 && <span>Taxe : {(i.tax_rate * 100).toFixed(2)}%</span>}
                {i.notes && <span>Notes : {i.notes}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickAddForm({
  seasonOptions,
  defaultSeason,
  onExpenseAdded,
  onIncomeAdded
}: {
  seasonOptions: SeasonOption[];
  defaultSeason: string;
  onExpenseAdded: (e: RevenueExpense) => void;
  onIncomeAdded: (i: RevenueIncome) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [seasonKey, setSeasonKey] = useState(defaultSeason || seasonOptions[0]?.key || "");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paidWith, setPaidWith] = useState<string>(PAYMENT_ACCOUNTS[0]);
  const [status, setStatus] = useState<"paid" | "due">("paid");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeKind = (k: "expense" | "income") => {
    setKind(k);
    setCategory(k === "expense" ? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1] : INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1]);
  };

  const submit = async () => {
    const dollars = parseFloat(amount.replace(",", "."));
    if (!label.trim() || Number.isNaN(dollars) || dollars <= 0 || !seasonKey) {
      setError("Saison, description et montant sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === "expense") {
        const res = await fetch("/api/admin/revenue-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonKey,
            category,
            label: label.trim(),
            amountCents: Math.round(dollars * 100),
            expenseDate: date,
            isRecurring: false,
            recurrenceEndDate: null,
            taxRate: 0,
            paidWith,
            status,
            dueDate: status === "due" ? (dueDate || null) : null
          })
        });
        if (!res.ok) throw new Error("Erreur d'ajout de la charge");
        const data = (await res.json()) as { expense: RevenueExpense };
        onExpenseAdded(data.expense);
      } else {
        const res = await fetch("/api/admin/revenue-income", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seasonKey, category, label: label.trim(), amountCents: Math.round(dollars * 100), incomeDate: date, taxRate: 0, paidWith, notes: null })
        });
        if (!res.ok) throw new Error("Erreur d'ajout du revenu");
        const data = (await res.json()) as { income: RevenueIncome };
        onIncomeAdded(data.income);
      }
      setLabel("");
      setAmount("");
      setStatus("paid");
      setDueDate("");
      // Rafraîchit les données serveur (grilles par catégorie, KPI, cash-flow)
      // pour que le nouvel ajout s'y reflète tout de suite, pas seulement dans les listes de détail.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="admin-btn-primary" style={{ fontSize: "0.78rem", marginBottom: "1.75rem" }}>
        + Ajouter une charge ou un revenu
      </button>
    );
  }

  return (
    <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "1.1rem", marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.9rem" }}>
        <button
          onClick={() => changeKind("expense")}
          className={kind === "expense" ? "admin-btn-primary" : "admin-btn-ghost"}
          style={{ fontSize: "0.75rem" }}
        >
          Dépense / Charge
        </button>
        <button
          onClick={() => changeKind("income")}
          className={kind === "income" ? "admin-btn-primary" : "admin-btn-ghost"}
          style={{ fontSize: "0.75rem" }}
        >
          Revenu
        </button>
      </div>

      {error && <p className="admin-error" style={{ marginBottom: "0.6rem", fontSize: "0.75rem" }}>{error}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <select className="admin-input" value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} style={{ fontSize: "0.75rem" }}>
          {seasonOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="admin-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: "0.75rem" }}>
          {(kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="Description" className="admin-input" style={{ flex: "1 1 140px", fontSize: "0.75rem" }} value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input type="number" min={0} step="0.01" placeholder="Montant $" className="admin-input" style={{ width: "100px", fontSize: "0.75rem" }} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input type="date" className="admin-input" style={{ fontSize: "0.75rem" }} value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="admin-input" value={paidWith} onChange={(e) => setPaidWith(e.target.value)} style={{ fontSize: "0.75rem" }}>
          {PAYMENT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {kind === "expense" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "#9d9da0", cursor: "pointer" }}>
            <input type="radio" checked={status === "paid"} onChange={() => setStatus("paid")} /> Payée maintenant
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "#9d9da0", cursor: "pointer" }}>
            <input type="radio" checked={status === "due"} onChange={() => setStatus("due")} /> À payer plus tard (🟡 à venir)
          </label>
          {status === "due" && (
            <input type="date" className="admin-input" style={{ fontSize: "0.72rem" }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="Échéance" />
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={submit} disabled={saving} className="admin-btn-primary" style={{ fontSize: "0.78rem" }}>
          {saving ? "Ajout..." : kind === "expense" ? "Ajouter la charge" : "Ajouter le revenu"}
        </button>
        <button onClick={() => setOpen(false)} className="admin-btn-ghost" style={{ fontSize: "0.78rem" }}>Annuler</button>
      </div>
    </div>
  );
}

function CategoryGrid({ title, rows, totalByMonth, monthLabels, color }: {
  title: string;
  rows: { category: string; monthlyCents: number[]; totalCents: number }[];
  totalByMonth: number[];
  monthLabels: string[];
  color: string;
}) {
  const grandTotal = totalByMonth.reduce((a, b) => a + b, 0);
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>{title}</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Catégorie</th>
              {monthLabels.map((m) => <th key={m} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{m}</th>)}
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <td>{r.category}</td>
                {r.monthlyCents.map((c, i) => (
                  <td key={i} style={{ textAlign: "right", color: c > 0 ? color : "#3c3a41" }}>{c > 0 ? formatCAD(c / 100) : "—"}</td>
                ))}
                <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCAD(r.totalCents / 100)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700, color: "#fff" }}>Total</td>
              {totalByMonth.map((c, i) => <td key={i} style={{ textAlign: "right", fontWeight: 700, color: "#fff" }}>{formatCAD(c / 100)}</td>)}
              <td style={{ textAlign: "right", fontWeight: 700, color: "#fff" }}>{formatCAD(grandTotal / 100)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminRevenusAnnuel({ breakdown, expenses: initialExpenses, income: initialIncome, seasonOptions, currentSeason }: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const [expenses, setExpenses] = useState(initialExpenses);
  const [income, setIncome] = useState(initialIncome);
  // Resynchronise l'état local quand une nouvelle sélection année/saison
  // recharge les props côté serveur (pattern React recommandé : ajuster
  // pendant le rendu plutôt que dans un effet, pour éviter un rendu en trop).
  const [syncedExpenses, setSyncedExpenses] = useState(initialExpenses);
  if (initialExpenses !== syncedExpenses) {
    setSyncedExpenses(initialExpenses);
    setExpenses(initialExpenses);
  }
  const [syncedIncome, setSyncedIncome] = useState(initialIncome);
  if (initialIncome !== syncedIncome) {
    setSyncedIncome(initialIncome);
    setIncome(initialIncome);
  }

  const navigate = (year: number, season: string) => {
    const params = new URLSearchParams();
    params.set("annee", String(year));
    // "" (Toutes les saisons) doit être un choix explicite, sinon l'absence
    // de paramètre serait réinterprétée comme "utiliser la saison par défaut".
    params.set("saison", season || "all");
    router.push(`/admin/revenus/annuel?${params.toString()}`);
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Vue annuelle</p>
            <Link href="/admin/revenus" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Revenus</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Revenus et dépenses par catégorie, mois par mois — pour voir d&apos;un coup d&apos;œil que tout fonctionne bien.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <select
              className="admin-input"
              value={breakdown.year}
              onChange={(e) => navigate(parseInt(e.target.value, 10), currentSeason)}
              style={{ width: "auto" }}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              className="admin-input"
              value={currentSeason}
              onChange={(e) => navigate(breakdown.year, e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="">Toutes les saisons</option>
              {seasonOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.75rem" }}>
            <div style={{ flex: "1 1 200px", background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
              <p style={{ fontSize: "0.65rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Revenus {breakdown.year}</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", margin: 0 }}>{formatCAD(breakdown.annualIncomeCents / 100)}</p>
            </div>
            <div style={{ flex: "1 1 200px", background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
              <p style={{ fontSize: "0.65rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Dépenses {breakdown.year}</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ff9999", margin: 0 }}>{formatCAD(breakdown.annualExpenseCents / 100)}</p>
            </div>
            <div style={{ flex: "1 1 200px", background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
              <p style={{ fontSize: "0.65rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Bénéfice engendré {breakdown.year}</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: breakdown.annualProfitCents < 0 ? "#ff9999" : "#7fd88f", margin: 0 }}>{formatCAD(breakdown.annualProfitCents / 100)}</p>
            </div>
            {breakdown.annualGoalCents > 0 && (
              <div style={{ flex: "1 1 200px", background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
                <p style={{ fontSize: "0.65rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.3rem" }}>% de l&apos;objectif annuel</p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#c3a6ff", margin: 0 }}>
                  {Math.round((breakdown.annualProfitCents / breakdown.annualGoalCents) * 100)}%
                  <span style={{ fontSize: "0.7rem", color: "#6d6b71", fontWeight: 400 }}> de {formatCAD(breakdown.annualGoalCents / 100)}</span>
                </p>
              </div>
            )}
          </div>

          <CategoryGrid title="Revenus par catégorie" rows={breakdown.income} totalByMonth={breakdown.incomeTotalByMonth} monthLabels={breakdown.monthLabels} color="#7fd88f" />
          <CategoryGrid title="Dépenses par catégorie" rows={breakdown.expense} totalByMonth={breakdown.expenseTotalByMonth} monthLabels={breakdown.monthLabels} color="#ff9999" />

          <QuickAddForm
            seasonOptions={seasonOptions}
            defaultSeason={currentSeason}
            onExpenseAdded={(e) => setExpenses((prev) => [e, ...prev])}
            onIncomeAdded={(i) => setIncome((prev) => [i, ...prev])}
          />

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>Détail des dépenses ({expenses.length})</p>
          <p style={{ fontSize: "0.72rem", color: "#6d6b71", marginBottom: "0.75rem" }}>
            Cliquez sur une dépense pour voir ses détails et ses pièces jointes (factures, reçus, photos). Les charges 🟡 à venir remontent en premier.
          </p>
          <div style={{ marginBottom: "1.75rem" }}>
            <ExpenseDetailList expenses={expenses} />
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.4rem" }}>Détail des revenus ({income.length})</p>
          <p style={{ fontSize: "0.72rem", color: "#6d6b71", marginBottom: "0.75rem" }}>
            Commandites, subventions, dons, camps et autres revenus saisis manuellement.
          </p>
          <div style={{ marginBottom: "1.75rem" }}>
            <IncomeDetailList income={income} />
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Cash-flow mois par mois</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  {breakdown.monthLabels.map((m) => <th key={m} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Revenu net</td>
                  {breakdown.cashFlow.map((c) => <td key={c.month} style={{ textAlign: "right" }}>{formatCAD(c.incomeCents / 100)}</td>)}
                </tr>
                <tr>
                  <td>Dépenses totales</td>
                  {breakdown.cashFlow.map((c) => <td key={c.month} style={{ textAlign: "right", color: c.expenseCents > 0 ? "#ff9999" : undefined }}>{formatCAD(c.expenseCents / 100)}</td>)}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "#fff" }}>Profit du mois</td>
                  {breakdown.cashFlow.map((c) => <td key={c.month} style={{ textAlign: "right", fontWeight: 600, color: c.profitCents < 0 ? "#ff9999" : "#7fd88f" }}>{formatCAD(c.profitCents / 100)}</td>)}
                </tr>
                <tr>
                  <td>Objectif du mois</td>
                  {breakdown.cashFlow.map((c) => <td key={c.month} style={{ textAlign: "right", color: "#9d9da0" }}>{c.goalCents > 0 ? formatCAD(c.goalCents / 100) : "—"}</td>)}
                </tr>
                <tr>
                  <td>% objectif atteint</td>
                  {breakdown.cashFlow.map((c) => (
                    <td key={c.month} style={{ textAlign: "right", color: c.goalProgressPct === null ? "#3c3a41" : c.goalProgressPct >= 100 ? "#7fd88f" : "#f0c878" }}>
                      {c.goalProgressPct === null ? "—" : `${c.goalProgressPct}%`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: "#fff" }}>Profit cumulé (YTD)</td>
                  {breakdown.cashFlow.map((c) => <td key={c.month} style={{ textAlign: "right", fontWeight: 600, color: c.ytdProfitCents < 0 ? "#ff9999" : "#7fd88f" }}>{formatCAD(c.ytdProfitCents / 100)}</td>)}
                </tr>
                <tr>
                  <td>% objectif annuel cumulé</td>
                  {breakdown.cashFlow.map((c) => (
                    <td key={c.month} style={{ textAlign: "right", color: c.yearGoalProgressPct === null ? "#3c3a41" : c.yearGoalProgressPct >= 100 ? "#7fd88f" : "#f0c878" }}>
                      {c.yearGoalProgressPct === null ? "—" : `${c.yearGoalProgressPct}%`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
