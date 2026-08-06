"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatCAD } from "@/lib/season-2027";
import type { MonthlyBucket, RevenueSummary, SeasonRevenue } from "@/lib/revenue-calc";
import { EXPENSE_CATEGORIES, type RevenueExpense } from "@/lib/revenue-repo";

interface Props {
  summary: RevenueSummary;
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
        style={{ fontSize: "0.68rem", color: "#8d76a5", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
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
  const [recurring, setRecurring] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const addExpense = async () => {
    const dollars = parseFloat(amount.replace(",", "."));
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
          recurrenceEndDate: recurring && endDate ? endDate : null
        })
      });
      if (res.ok) {
        const data = (await res.json()) as { expense: RevenueExpense };
        onExpensesChanged(card.key, [data.expense, ...card.expenses]);
        setLabel("");
        setAmount("");
        setRecurring(false);
        setEndDate("");
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

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: "0.68rem", color: "#ff9999", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
      >
        {open ? "Fermer les charges" : `Charges (${card.expenses.length})`}
      </button>

      {open && (
        <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {card.expensesByCategory.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.3rem" }}>
              {card.expensesByCategory.map((c) => (
                <div key={c.category} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#9d9da0" }}>
                  <span>{c.category}</span>
                  <span>{formatCAD(c.amountCents / 100)}</span>
                </div>
              ))}
            </div>
          )}

          {card.expenses.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", fontSize: "0.72rem", color: "#c3c2c8" }}>
              <span>
                {e.label} · {e.category} · {e.expense_date}
                {e.is_recurring && <span title="Charge récurrente"> 🔁</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ color: "#ff9999" }}>-{formatCAD(e.amount_cents / 100)}</span>
                <button
                  onClick={() => deleteExpense(e.id)}
                  disabled={deletingId === e.id}
                  style={{ background: "none", border: "none", color: "#6d6b71", cursor: "pointer", fontSize: "0.9rem", lineHeight: 1, padding: 0 }}
                  aria-label="Supprimer la charge"
                >
                  ×
                </button>
              </span>
            </div>
          ))}
          {card.expenses.length === 0 && <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: 0 }}>Aucune charge.</p>}

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
            <button onClick={addExpense} disabled={saving} className="admin-btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.68rem" }}>
              {saving ? "..." : "Ajouter"}
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "#9d9da0", cursor: "pointer" }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Charge récurrente (chaque mois)
          </label>
          {recurring && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "#9d9da0" }}>
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
  const barColor = pct === null ? "#8d76a5" : pct >= 100 ? "#7fd88f" : pct >= 60 ? "#88c0d0" : "#ffb464";

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1.1rem 1.25rem", minWidth: "240px", flex: "1 1 240px" }}>
      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{card.label}</p>
      <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>{formatCAD(card.totalCents / 100)}</p>
      <p style={{ fontSize: "0.75rem", color: card.netCents < 0 ? "#ff9999" : "#7fd88f", margin: "0 0 0.5rem" }}>
        Net : {formatCAD(card.netCents / 100)}
        {card.expenseCents > 0 && <span style={{ color: "#6d6b71" }}> (-{formatCAD(card.expenseCents / 100)} de charges)</span>}
      </p>

      {card.goalCents > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ height: "6px", borderRadius: "3px", background: "#1f1d25", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "3px" }} />
          </div>
          <p style={{ fontSize: "0.68rem", color: "#9d9da0", margin: "0.3rem 0 0" }}>
            {pct}% de l&apos;objectif de {formatCAD(card.goalCents / 100)}
          </p>
        </div>
      )}

      {card.paidCount > 0 || card.unknownCount > 0 ? (
        <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0 0 0.5rem" }}>
          {card.paidCount} payée(s)
          {card.unknownCount > 0 && <span style={{ color: "#ffb464" }}> · {card.unknownCount} montant(s) inconnu(s)</span>}
        </p>
      ) : null}

      <GoalEditor card={card} onSaved={(goalCents) => onGoalSaved(card.key, goalCents)} />
      <ExpensesPanel card={card} onExpensesChanged={onExpensesChanged} />
    </div>
  );
}

function MonthlyTable({ months }: { months: MonthlyBucket[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? months : months.slice(0, 6);

  if (months.length === 0) return null;

  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1.1rem 1.25rem", marginBottom: "1.5rem" }}>
      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>Vue par mois</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", fontSize: "0.65rem", color: "#6d6b71", textTransform: "uppercase" }}>
          <span>Mois</span><span>Revenus</span><span>Charges</span><span>Net</span>
        </div>
        {visible.map((m) => (
          <div key={m.month} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", fontSize: "0.78rem", color: "#c3c2c8" }}>
            <span>{m.month}</span>
            <span>{formatCAD(m.revenueCents / 100)}</span>
            <span style={{ color: m.expenseCents > 0 ? "#ff9999" : "#6d6b71" }}>{m.expenseCents > 0 ? `-${formatCAD(m.expenseCents / 100)}` : "—"}</span>
            <span style={{ color: m.netCents < 0 ? "#ff9999" : "#7fd88f", fontWeight: 600 }}>{formatCAD(m.netCents / 100)}</span>
          </div>
        ))}
      </div>
      {months.length > 6 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ marginTop: "0.75rem", fontSize: "0.68rem", color: "#8d76a5", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
        >
          {expanded ? "Réduire" : `Voir tous les mois (${months.length})`}
        </button>
      )}
    </div>
  );
}

export function AdminRevenus({ summary }: Props) {
  const [cards, setCards] = useState<SeasonRevenue[]>(summary.seasons);
  const [boutique, setBoutique] = useState<SeasonRevenue>(summary.boutique);
  const [general, setGeneral] = useState<SeasonRevenue>(summary.general);

  const updateCard = (key: string, patch: Partial<SeasonRevenue>) => {
    const apply = (c: SeasonRevenue) => (c.key === key ? { ...c, ...patch, netCents: c.totalCents - (patch.expenseCents ?? c.expenseCents) } : c);
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
            <p className="admin-section-title" style={{ margin: 0 }}>Revenus</p>
            <a href="/api/admin/revenue-export" className="admin-btn-ghost" style={{ padding: "0.4rem 0.8rem", fontSize: "0.72rem", textDecoration: "none" }}>
              ↓ Exporter en CSV
            </a>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Revenu réellement encaissé par saison (versements comptés seulement une fois prélevés), avec vos objectifs financiers et vos charges.
          </p>

          {hasUnknown && (
            <p style={{ fontSize: "0.75rem", color: "#ffb464", background: "rgba(255,180,100,0.1)", border: "1px solid rgba(255,180,100,0.3)", borderRadius: "8px", padding: "0.6rem 0.9rem", marginBottom: "1.25rem" }}>
              Certaines inscriptions Été marquées &quot;payé&quot; n&apos;ont pas de paiement Stripe associé (marquées payées manuellement) — leur montant n&apos;est pas inclus dans le total, qui est donc légèrement sous-estimé.
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            {cards.map((card) => (
              <RevenueCard key={card.key} card={card} onGoalSaved={handleGoalSaved} onExpensesChanged={handleExpensesChanged} />
            ))}
            <RevenueCard card={boutique} onGoalSaved={handleGoalSaved} onExpensesChanged={handleExpensesChanged} />
            <RevenueCard card={general} onGoalSaved={handleGoalSaved} onExpensesChanged={handleExpensesChanged} />
          </div>

          <MonthlyTable months={summary.months} />

          <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
            <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: "0 0 0.3rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>Total — toutes saisons et boutique</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>{formatCAD(grandTotalCents / 100)}</p>
            <p style={{ fontSize: "0.85rem", color: grandNetCents < 0 ? "#ff9999" : "#7fd88f", margin: "0 0 0.4rem" }}>
              Net : {formatCAD(grandNetCents / 100)}
              {grandExpenseCents > 0 && <span style={{ color: "#9d9da0" }}> (-{formatCAD(grandExpenseCents / 100)} de charges)</span>}
            </p>
            {grandGoalCents > 0 && (
              <p style={{ fontSize: "0.75rem", color: "#c3c2c8", margin: 0 }}>
                {Math.min(100, Math.round((grandTotalCents / grandGoalCents) * 100))}% de l&apos;objectif combiné de {formatCAD(grandGoalCents / 100)}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
