"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { OrderStatus, ShopOrderWithItems } from "@/lib/shop-repo";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  paid: "Payée",
  fulfilled: "Remise",
  cancelled: "Annulée"
};

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export function AdminBoutiqueCommandes({ initialOrders, showPrices }: { initialOrders: ShopOrderWithItems[]; showPrices: boolean }) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ShopOrderWithItems | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/boutique/commandes/${confirmDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setOrders((prev) => prev.filter((o) => o.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/boutique/commandes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(null);
    }
  };

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    paid: orders.filter((o) => o.status === "paid").length,
    fulfilled: orders.filter((o) => o.status === "fulfilled").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Commandes de la boutique</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Les commandes payées apparaissent ici automatiquement — l&apos;inventaire est déjà décrémenté.
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          <div className="admin-filters" style={{ marginBottom: "1.25rem" }}>
            {(["all", "pending", "paid", "fulfilled", "cancelled"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="admin-filter-btn" data-active={String(filter === f)}>
                {f === "all" ? "Toutes" : STATUS_LABELS[f]}
                <span className="admin-filter-count">{counts[f]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 && <p className="admin-empty-text">Aucune commande dans ce filtre.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {filtered.map((order) => (
              <div key={order.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", opacity: saving === order.id ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
                  <div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff", margin: 0 }}>{order.customer_name}</p>
                    <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", margin: "0.15rem 0 0" }}>{order.customer_email}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</p>
                    {(order.shipping_address || order.shipping_city) && (
                      <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", margin: "0.15rem 0 0" }}>
                        {[order.shipping_address, order.shipping_city, order.shipping_postal_code].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                      className="admin-input"
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      style={{ width: "auto" }}
                    >
                      {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <button
                      onClick={() => setConfirmDelete(order)}
                      style={{ fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.4rem 0.6rem", cursor: "pointer" }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "0.5rem" }}>
                  {order.items.map((item) => (
                    <p key={item.id} style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: 0 }}>
                      {item.product_name}{item.variant_label ? ` — ${item.variant_label}` : ""} × {item.quantity}{showPrices ? ` — ${formatPrice(item.unit_price_cents * item.quantity)}` : ""}
                    </p>
                  ))}
                </div>
                {showPrices && <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#9ec99e", margin: 0 }}>Total : {formatPrice(order.total_cents)}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box">
            <p className="admin-modal-title">Supprimer cette commande ?</p>
            <p className="admin-modal-body">
              La commande de <span className="admin-modal-name">{confirmDelete.customer_name}</span> sera définitivement supprimée. Cette action est irréversible.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Annuler</button>
              <button className="admin-btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Suppression..." : "Supprimer définitivement"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
