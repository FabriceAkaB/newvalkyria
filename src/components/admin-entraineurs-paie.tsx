"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatHours, startOfWeek } from "@/lib/coach-payroll";
import { filterPayrollRows, groupPayrollByCoach, type PayrollRow } from "@/lib/coach-payroll-data";
import { ACTIVITY_TYPES, type Coach } from "@/lib/coaches-repo";
import { formatCAD } from "@/lib/season-2027";

interface Props {
  rows: PayrollRow[];
  coaches: Coach[];
}

export function AdminEntraineursPaie({ rows, coaches }: Props) {
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");
  const [activityType, setActivityType] = useState("");
  const [coachId, setCoachId] = useState("");
  const [paidStatus, setPaidStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [weekOnly, setWeekOnly] = useState(false);

  const months = useMemo(() => Array.from(new Set(rows.map((r) => r.activityDate.slice(0, 7)))).sort().reverse(), [rows]);
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.activityCategory).filter(Boolean))).sort() as string[], [rows]);

  const weekStart = startOfWeek(new Date());
  const weekStartISO = weekStart.toISOString().slice(0, 10);

  const filtered = filterPayrollRows(rows, {
    month: month || undefined,
    category: category || undefined,
    activityType: activityType || undefined,
    coachId: coachId || undefined,
    paid: paidStatus === "all" ? undefined : paidStatus,
    weekStartISO: weekOnly ? weekStartISO : undefined
  });

  const payrollRows = groupPayrollByCoach(filtered);

  const exportUrl = (format: "csv" | "xlsx" | "pdf") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (month) params.set("month", month);
    if (category) params.set("category", category);
    if (activityType) params.set("type", activityType);
    if (coachId) params.set("coachId", coachId);
    if (paidStatus !== "all") params.set("paid", paidStatus);
    if (weekOnly) params.set("weekOnly", "1");
    return `/api/admin/coach-payroll-export?${params.toString()}`;
  };

  const totalHours = payrollRows.reduce((s, r) => s + r.hours, 0);
  const totalPay = payrollRows.reduce((s, r) => s + r.payCents, 0);
  const totalPaid = payrollRows.reduce((s, r) => s + r.paidCents, 0);
  const totalRemaining = payrollRows.reduce((s, r) => s + r.remainingCents, 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Paie</p>
            <Link href="/admin/entraineurs" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Entraîneurs</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Tableau de paie filtrable — heures, taux, salaire, payé et reste à payer par entraîneur.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <select className="admin-input" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Tous les mois</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="admin-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="admin-input" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              <option value="">Toutes les activités</option>
              {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="admin-input" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
              <option value="">Tous les entraîneurs</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
            <select className="admin-input" value={paidStatus} onChange={(e) => setPaidStatus(e.target.value as "all" | "paid" | "unpaid")}>
              <option value="all">Payé et non payé</option>
              <option value="paid">Payé seulement</option>
              <option value="unpaid">Non payé seulement</option>
            </select>
            <button
              className="admin-btn-ghost"
              data-active={String(weekOnly)}
              onClick={() => setWeekOnly((w) => !w)}
              style={weekOnly ? { color: "#b295cf", borderColor: "#7a6690" } : undefined}
            >
              Cette semaine seulement
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.25rem" }}>
            <a href={exportUrl("csv")} className="admin-btn-ghost" style={{ textDecoration: "none" }}>↓ CSV</a>
            <a href={exportUrl("xlsx")} className="admin-btn-ghost" style={{ textDecoration: "none" }}>↓ Excel</a>
            <a href={exportUrl("pdf")} className="admin-btn-ghost" style={{ textDecoration: "none" }}>↓ PDF</a>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Entraîneur</th>
                  <th>Heures</th>
                  <th>Taux</th>
                  <th>Salaire</th>
                  <th>Payé</th>
                  <th>Reste</th>
                </tr>
              </thead>
              <tbody>
                {payrollRows.map((r) => (
                  <tr key={r.coachId}>
                    <td>{r.name}</td>
                    <td>{formatHours(r.hours)}</td>
                    <td>{formatCAD(r.avgRateCents / 100)}</td>
                    <td>{formatCAD(r.payCents / 100)}</td>
                    <td>{formatCAD(r.paidCents / 100)}</td>
                    <td style={{ color: r.remainingCents > 0 ? "#ffb464" : "#7fd88f", fontWeight: 600 }}>{formatCAD(r.remainingCents / 100)}</td>
                  </tr>
                ))}
                {payrollRows.length === 0 && (
                  <tr><td colSpan={6} className="admin-empty-text">Aucun résultat pour ces filtres.</td></tr>
                )}
              </tbody>
              {payrollRows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td>{formatHours(totalHours)}</td>
                    <td>—</td>
                    <td>{formatCAD(totalPay / 100)}</td>
                    <td>{formatCAD(totalPaid / 100)}</td>
                    <td style={{ color: totalRemaining > 0 ? "#ffb464" : "#7fd88f" }}>{formatCAD(totalRemaining / 100)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
