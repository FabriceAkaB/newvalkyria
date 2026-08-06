"use client";

import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatCAD } from "@/lib/season-2027";

interface Props {
  payrollWeekCents: number;
  payrollMonthCents: number;
  payrollTotalCents: number;
  totalActivities: number;
  activityCountByType: [string, number][];
  costByCategory: [string, number][];
  avgCostPerActivityCents: number;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", flex: "1 1 200px" }}>
      <p style={{ fontSize: "0.65rem", color: "#6d6b71", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.3rem" }}>{label}</p>
      <p style={{ fontSize: "1.3rem", fontWeight: 700, color: color ?? "#fff", margin: 0 }}>{value}</p>
    </div>
  );
}

export function AdminEntraineursStatistiques({
  payrollWeekCents,
  payrollMonthCents,
  payrollTotalCents,
  totalActivities,
  activityCountByType,
  costByCategory,
  avgCostPerActivityCents
}: Props) {
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Statistiques</p>
            <Link href="/admin/entraineurs" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Entraîneurs</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Masse salariale, nombre d&apos;activités et coûts — toutes activités confondues.
          </p>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Masse salariale</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <StatCard label="Cette semaine" value={formatCAD(payrollWeekCents / 100)} />
            <StatCard label="Ce mois-ci" value={formatCAD(payrollMonthCents / 100)} />
            <StatCard label="Total (toutes activités)" value={formatCAD(payrollTotalCents / 100)} />
            <StatCard label="Coût moyen par activité" value={formatCAD(avgCostPerActivityCents / 100)} />
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Activités ({totalActivities})</p>
          <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
            <table className="admin-table">
              <thead><tr><th>Type d&apos;activité</th><th>Nombre</th></tr></thead>
              <tbody>
                {activityCountByType.map(([type, count]) => (
                  <tr key={type}><td>{type}</td><td>{count}</td></tr>
                ))}
                {activityCountByType.length === 0 && <tr><td colSpan={2} className="admin-empty-text">Aucune activité.</td></tr>}
              </tbody>
            </table>
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Coût par catégorie</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Catégorie</th><th>Coût total</th></tr></thead>
              <tbody>
                {costByCategory.map(([category, cents]) => (
                  <tr key={category}><td>{category}</td><td>{formatCAD(cents / 100)}</td></tr>
                ))}
                {costByCategory.length === 0 && <tr><td colSpan={2} className="admin-empty-text">Aucune donnée.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
