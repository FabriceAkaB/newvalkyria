"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import type { OrderWithDistribution } from "@/lib/shop-repo";

interface Props {
  orders: OrderWithDistribution[];
  seasonKeys: string[];
  seasonLabelByKey: Record<string, string>;
  currentSeason: string;
}

function groupLabel(order: OrderWithDistribution): string {
  if (!order.registration) return "Non reliées";
  return `${order.registration.categoryId ?? "?"}${order.registration.advancedGroup ? " Avancé" : ""}`;
}

export function AdminUniformesAujourdhui({ orders, seasonKeys, seasonLabelByKey, currentSeason }: Props) {
  const router = useRouter();

  const groups = new Map<string, OrderWithDistribution[]>();
  for (const o of orders) {
    const key = groupLabel(o);
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Distribution aujourd&apos;hui</p>
            <Link href="/admin/uniformes" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Uniformes</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Commandes prêtes à remettre ou partiellement remises, groupées par groupe — total : <strong style={{ color: "#fff" }}>{orders.length}</strong>.
          </p>

          <select
            className="admin-input"
            value={currentSeason}
            onChange={(e) => router.push(`/admin/uniformes/aujourdhui?saison=${e.target.value || "all"}`)}
            style={{ marginBottom: "1.25rem" }}
          >
            <option value="">Toutes les saisons</option>
            {seasonKeys.map((k) => <option key={k} value={k}>{seasonLabelByKey[k] ?? k}</option>)}
          </select>

          {sortedGroups.length === 0 && <p className="admin-empty-text">Rien de prêt à remettre pour le moment.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {sortedGroups.map(([group, list]) => (
              <div key={group}>
                <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
                  {group} <span style={{ color: "#9d9da0", fontWeight: 400 }}>({list.length} joueuse{list.length > 1 ? "s" : ""})</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {list.map((o) => (
                    <Link
                      key={o.id}
                      href={`/admin/uniformes/commande/${o.id}`}
                      style={{ display: "flex", justifyContent: "space-between", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.9rem", textDecoration: "none", color: "#c3c2c8", fontSize: "0.8rem" }}
                    >
                      <span>{o.registration ? `${o.registration.playerFirstName ?? ""} ${o.registration.playerLastName ?? ""}`.trim() : o.customer_name}</span>
                      <span style={{ color: o.distribution_status === "partiellement_remis" ? "#ffb464" : "#7fd88f" }}>
                        {o.distribution_status === "partiellement_remis" ? "Partiel" : "Prêt"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
