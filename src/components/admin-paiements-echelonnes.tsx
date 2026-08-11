"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { PaymentPlanOverview } from "@/lib/season-admin-repo";
import { formatCAD } from "@/lib/season-2027";

interface Props {
  plans: PaymentPlanOverview[];
  seasonLabelById: Record<string, string>;
  programNameById: Record<string, string>;
}

function planStatus(plan: PaymentPlanOverview): { label: string; className: string } {
  if (plan.installments.some((i) => i.status === "failed_final")) return { label: "Échec définitif", className: "admin-badge-pending" };
  if (plan.installments.some((i) => i.status === "failed")) return { label: "Échec — réessai en cours", className: "admin-badge-pending" };
  if (plan.installments.every((i) => i.status === "paid")) return { label: "Complété", className: "admin-badge-paid" };
  return { label: "En cours", className: "admin-badge-paid" };
}

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échec (réessai)",
  failed_final: "Échec définitif"
};

export function AdminPaiementsEchelonnes({ plans, seasonLabelById, programNameById }: Props) {
  const [seasonFilter, setSeasonFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "en-cours" | "complete" | "probleme">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const seasons = useMemo(() => Array.from(new Set(plans.map((p) => p.seasonId))), [plans]);

  const filtered = plans.filter((p) => {
    if (seasonFilter && p.seasonId !== seasonFilter) return false;
    if (statusFilter === "all") return true;
    const status = planStatus(p);
    if (statusFilter === "probleme") return status.label.startsWith("Échec");
    if (statusFilter === "complete") return status.label === "Complété";
    return status.label === "En cours";
  });

  const totalToCollect = filtered.reduce((sum, p) => {
    const collected = p.installments.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);
    return sum + (p.totalAmountCents - collected);
  }, 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Paiements échelonnés</p>
            <Link href="/admin/revenus" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Revenus</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Familles ayant choisi de payer en plusieurs versements — {plans.length} plan(s) au total, {formatCAD(totalToCollect / 100)} encore à recevoir sur la sélection actuelle.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <select className="admin-input" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
              <option value="">Toutes les saisons</option>
              {seasons.map((s) => <option key={s} value={s}>{seasonLabelById[s] ?? s}</option>)}
            </select>
            <select className="admin-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">Tous les statuts</option>
              <option value="en-cours">En cours</option>
              <option value="complete">Complétés</option>
              <option value="probleme">Avec problème de prélèvement</option>
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>Joueuse</th>
                  <th>Saison / Programme</th>
                  <th>Total</th>
                  <th>Versements</th>
                  <th>Solde restant</th>
                  <th>Prochain versement</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status = planStatus(p);
                  const collected = p.installments.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);
                  const remaining = p.totalAmountCents - collected;
                  const paidCount = p.installments.filter((i) => i.status === "paid").length;
                  const next = p.installments.find((i) => i.status === "pending" || i.status === "failed");
                  const expanded = expandedId === p.planId;
                  return (
                    <Fragment key={p.planId}>
                      <tr onClick={() => setExpandedId(expanded ? null : p.planId)} style={{ cursor: "pointer" }}>
                        <td>{p.parentName}</td>
                        <td>{p.playerFirstName} {p.playerLastName}</td>
                        <td>{seasonLabelById[p.seasonId] ?? p.seasonId}{p.programId ? ` — ${programNameById[p.programId] ?? p.programId}` : ""}</td>
                        <td>{formatCAD(p.totalAmountCents / 100)}</td>
                        <td>{paidCount}/{p.installmentCount}</td>
                        <td style={{ color: remaining > 0 ? "#ffb464" : "#7fd88f" }}>{formatCAD(remaining / 100)}</td>
                        <td>{next ? `${formatCAD(next.amountCents / 100)} — ${new Date(next.dueDate + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}` : "—"}</td>
                        <td><span className={`admin-badge ${status.className}`}>{status.label}</span></td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={8} style={{ background: "#100e17", padding: "0.75rem 1rem" }}>
                            <p style={{ fontSize: "0.7rem", color: "#6d6b71", textTransform: "uppercase", margin: "0 0 0.5rem" }}>{p.parentEmail}</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                              {p.installments.map((i) => (
                                <div key={i.sequenceNo} style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "8px", padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                                  <p style={{ margin: 0, color: "#fff" }}>Versement {i.sequenceNo}/{p.installmentCount} — {formatCAD(i.amountCents / 100)}</p>
                                  <p style={{ margin: "0.2rem 0 0", color: "#9d9da0" }}>
                                    Dû le {new Date(i.dueDate + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}
                                    {" · "}{INSTALLMENT_STATUS_LABELS[i.status] ?? i.status}
                                    {i.paidAt && ` (${new Date(i.paidAt).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })})`}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="admin-empty-text">Aucun plan de paiement échelonné pour cette sélection.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
