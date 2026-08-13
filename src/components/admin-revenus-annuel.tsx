"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import type { AnnualBreakdown } from "@/lib/revenue-calc";
import { formatCAD } from "@/lib/season-2027";

interface Props {
  breakdown: AnnualBreakdown;
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

export function AdminRevenusAnnuel({ breakdown }: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

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

          <select
            className="admin-input"
            value={breakdown.year}
            onChange={(e) => router.push(`/admin/revenus/annuel?annee=${e.target.value}`)}
            style={{ marginBottom: "1.25rem", width: "auto" }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

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
