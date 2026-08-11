"use client";

import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import type { CashMovement, FinancialDashboard, UpcomingMovements } from "@/lib/revenue-calc";
import { formatCAD } from "@/lib/season-2027";

interface Props {
  dashboard: FinancialDashboard;
  movements: UpcomingMovements;
}

function MovementList({ title, items, color }: { title: string; items: CashMovement[]; color: string }) {
  return (
    <div style={{ flex: "1 1 320px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1.1rem 1.25rem" }}>
      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>{title} ({items.length})</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "360px", overflowY: "auto" }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "#c3c2c8" }}>
            <span>{new Date(m.date + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} — {m.description}</span>
            <span style={{ color, fontWeight: 600, whiteSpace: "nowrap", marginLeft: "0.5rem" }}>{formatCAD(m.amountCents / 100)}</span>
          </div>
        ))}
        {items.length === 0 && <p style={{ fontSize: "0.75rem", color: "#3c3a41", fontStyle: "italic", margin: 0 }}>Rien à venir.</p>}
      </div>
    </div>
  );
}

export function AdminTresorerie({ dashboard, movements }: Props) {
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Trésorerie</p>
            <Link href="/admin/revenus" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Revenus</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Encaisse actuelle et projection selon les versements de parents attendus et les factures à payer déjà enregistrées.
          </p>

          <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "12px", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: "0 0 0.4rem", textTransform: "uppercase" }}>Encaisse actuelle</p>
            <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "#fff", margin: "0 0 1rem" }}>{formatCAD(dashboard.cashAvailableCents / 100)}</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {dashboard.cashFlow.map((c) => (
                <div key={c.horizonDays} style={{ flex: "1 1 200px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem" }}>
                  <p style={{ fontSize: "0.68rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.4rem" }}>Solde prévu dans {c.horizonDays} jours</p>
                  <p style={{ fontSize: "1.25rem", fontWeight: 700, color: c.projectedBalanceCents < 0 ? "#ff9999" : "#fff", margin: "0 0 0.3rem" }}>
                    {formatCAD(c.projectedBalanceCents / 100)}
                  </p>
                  <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: 0 }}>
                    <span style={{ color: "#7fd88f" }}>+{formatCAD(c.incomingCents / 100)}</span>
                    {" · "}
                    <span style={{ color: "#ff9999" }}>-{formatCAD(c.outgoingCents / 100)}</span>
                  </p>
                </div>
              ))}
            </div>
            {dashboard.projectedRemainingCents < 0 && (
              <p style={{ fontSize: "0.78rem", color: "#ff9999", margin: "1rem 0 0" }}>
                ⚠ Risque de liquidités : le solde prévu devient négatif une fois les obligations connues déduites.
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <MovementList title="Argent qui entrera prochainement" items={movements.incoming} color="#7fd88f" />
            <MovementList title="Argent qui sortira prochainement" items={movements.outgoing} color="#ff9999" />
          </div>
        </div>
      </div>
    </>
  );
}
