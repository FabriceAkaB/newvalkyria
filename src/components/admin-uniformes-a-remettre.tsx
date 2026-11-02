"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { DISTRIBUTION_STATUS_LABELS, type OrderWithDistribution } from "@/lib/shop-repo";

interface Props {
  orders: OrderWithDistribution[];
  unassignedOrders: OrderWithDistribution[];
  seasonKeys: string[];
  seasonLabelByKey: Record<string, string>;
  currentSeason: string;
}

const STATUS_COLORS: Record<string, string> = {
  a_commander: "var(--adm-text-2)",
  en_production: "var(--adm-info)",
  recu: "var(--adm-warn)",
  pret_a_remettre: "var(--adm-good)",
  partiellement_remis: "var(--adm-warn)",
  remis: "var(--adm-good)"
};

function OrderRow({ order }: { order: OrderWithDistribution }) {
  const reg = order.registration;
  return (
    <Link
      href={`/admin/uniformes/commande/${order.id}`}
      style={{ display: "block", background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: "10px", padding: "0.9rem 1.1rem", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div>
          <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            {reg ? `${reg.playerFirstName ?? ""} ${reg.playerLastName ?? ""}`.trim() : order.customer_name}
            {reg && <span style={{ fontSize: "0.72rem", color: "var(--adm-text-2)", fontWeight: 400 }}> — {reg.categoryId}{reg.advancedGroup ? " Avancé" : ""}</span>}
          </p>
          <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", margin: "0.15rem 0 0" }}>
            {reg ? reg.parentName : order.customer_name} · {reg?.parentPhone ?? order.customer_phone ?? "—"}
          </p>
          {!reg && <p style={{ fontSize: "0.68rem", color: "var(--adm-warn)", margin: "0.2rem 0 0" }}>⚠ Pas reliée à une joueuse</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {order.openProblemCount > 0 && <span style={{ fontSize: "0.68rem", color: "var(--adm-bad)" }}>🔴 {order.openProblemCount} problème(s)</span>}
          <span style={{ fontSize: "0.7rem", color: STATUS_COLORS[order.distribution_status], fontWeight: 600 }}>
            {DISTRIBUTION_STATUS_LABELS[order.distribution_status]}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", marginBottom: "0.4rem" }}>
        {order.items.map((item) => (
          <p key={item.id} style={{ fontSize: "0.75rem", color: "var(--adm-text-2)", margin: 0 }}>
            {item.product_name}{item.variant_label ? ` — ${item.variant_label}` : ""} × {item.quantity}
            {item.delivered_quantity > 0 && item.delivered_quantity < item.quantity && (
              <span style={{ color: "var(--adm-warn)" }}> (remis {item.delivered_quantity}/{item.quantity})</span>
            )}
          </p>
        ))}
      </div>
      <p style={{ fontSize: "0.68rem", color: "var(--adm-text-3)", margin: 0 }}>
        Commande #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}
      </p>
    </Link>
  );
}

export function AdminUniformesARemettre({ orders, unassignedOrders, seasonKeys, seasonLabelByKey, currentSeason }: Props) {
  const router = useRouter();

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Uniformes à remettre</p>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--adm-text-3)", marginBottom: "1.25rem" }}>
            Triées par priorité : problèmes ouverts, puis prêtes à remettre, puis les plus anciennes.
          </p>

          <select
            className="admin-input"
            value={currentSeason}
            onChange={(e) => router.push(`/admin/uniformes/a-remettre?saison=${e.target.value || "all"}`)}
            style={{ marginBottom: "1.25rem" }}
          >
            <option value="">Toutes les saisons</option>
            {seasonKeys.map((k) => <option key={k} value={k}>{seasonLabelByKey[k] ?? k}</option>)}
          </select>

          {unassignedOrders.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--adm-warn)", marginBottom: "0.6rem" }}>
                ⚠ {unassignedOrders.length} commande(s) payée(s) pas encore classée(s) par saison
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {unassignedOrders.map((o) => <OrderRow key={o.id} order={o} />)}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {orders.map((o) => <OrderRow key={o.id} order={o} />)}
            {orders.length === 0 && unassignedOrders.length === 0 && <p className="admin-empty-text">Rien à remettre — tout est distribué.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
