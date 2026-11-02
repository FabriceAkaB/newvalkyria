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
  /** Activités passées dont les heures sont retenues (présence ou rapport manquant), à régler avant de payer. */
  missing: (PayrollRow & { detail: string })[];
}

const shortDate = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });

function MissingBeforePayroll({ missing }: { missing: Props["missing"] }) {
  if (missing.length === 0) {
    return (
      <div className="admin-stat-card" style={{ marginBottom: "1.25rem" }}>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-good)" }}>Prêt pour la paie</p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>Chaque éducateur a confirmé sa présence et rempli ses rapports.</p>
      </div>
    );
  }
  const heldCents = missing.reduce((s, r) => s + r.heldPayCents, 0);
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ margin: "0 0 0.25rem", fontWeight: 600, fontSize: "1rem", color: "var(--adm-text)" }}>
        Avant de payer : {missing.length} présence{missing.length > 1 ? "s" : ""} ou rapport{missing.length > 1 ? "s" : ""} manquant{missing.length > 1 ? "s" : ""}
      </p>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>
        {formatCAD(heldCents / 100)} retenus : ces heures comptent dès que l&apos;éducateur confirme sa présence et complète son rapport dans son portail. Relance automatique 24 h après l&apos;activité.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Éducateur</th>
              <th>Activité</th>
              <th>Ce qui manque</th>
              <th>Relance</th>
              <th style={{ textAlign: "right" }}>Retenu</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((r) => (
              <tr key={r.assignmentId}>
                <td>{r.coachName}</td>
                <td>
                  <Link href={`/admin/entraineurs/activites/${r.activityId}`}>{shortDate(r.activityDate)} · {r.activityStart}</Link>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{r.activityLabel}</span>
                </td>
                <td style={{ color: "var(--adm-warn)" }}>{r.detail}</td>
                <td style={{ fontSize: "0.78rem", color: "var(--adm-text-3)" }}>
                  {r.reminderSentAt ? `Envoyée ${shortDate(r.reminderSentAt)}` : r.coachHasEmail ? "À venir" : "Pas de courriel : appeler"}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatCAD(r.heldPayCents / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminEntraineursPaie({ rows, coaches, missing }: Props) {
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
          <p style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", marginBottom: "1.25rem" }}>
            Heures × taux de chaque éducateur. Les heures d’une activité comptent quand l’éducateur a confirmé sa présence et rempli son rapport (présences et évaluations des joueuses).
          </p>

          <MissingBeforePayroll missing={missing} />

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
                  <th>Retenu</th>
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
                    <td style={{ color: r.remainingCents > 0 ? "var(--adm-warn)" : "var(--adm-good)", fontWeight: 600 }}>{formatCAD(r.remainingCents / 100)}</td>
                    <td style={{ color: r.heldPayCents > 0 ? "var(--adm-warn)" : "var(--adm-text-3)" }}>
                      {r.heldPayCents > 0 ? `${formatHours(r.heldHours)} · ${formatCAD(r.heldPayCents / 100)}` : "—"}
                    </td>
                  </tr>
                ))}
                {payrollRows.length === 0 && (
                  <tr><td colSpan={7} className="admin-empty-text">Aucun résultat pour ces filtres.</td></tr>
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
                    <td style={{ color: totalRemaining > 0 ? "var(--adm-warn)" : "var(--adm-good)" }}>{formatCAD(totalRemaining / 100)}</td>
                    <td>{formatCAD(payrollRows.reduce((s, r) => s + r.heldPayCents, 0) / 100)}</td>
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
