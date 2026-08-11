"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { Season } from "@/lib/season-admin-repo";
import {
  DISTRIBUTION_STATUS_LABELS,
  PROBLEM_TYPE_LABELS,
  type DistributionStatus,
  type OrderWithDistribution,
  type ProblemType,
  type ShopOrderEvent,
  type ShopOrderProblem
} from "@/lib/shop-repo";

interface Props {
  order: OrderWithDistribution;
  events: ShopOrderEvent[];
  seasons: Season[];
  problems: ShopOrderProblem[];
}

interface RegistrationSearchResult {
  id: string;
  player_first_name: string | null;
  player_last_name: string | null;
  parent_name: string;
  category_id: string | null;
  season_id: string;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

/** Le nom "remis par" est déduit du compte connecté — jamais saisi à la
 *  main, pour que ce soit toujours fiable. */
const DELIVERED_BY_LABEL: Record<"admin" | "gerante", string> = {
  admin: "JP",
  gerante: "Gérante"
};

function RegistrationLinker({ order, onLinked }: { order: OrderWithDistribution; onLinked: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistrationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/registrations-search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as { registrations: RegistrationSearchResult[] };
          setResults(data.registrations);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const link = async (registrationId: string) => {
    setLinking(registrationId);
    try {
      const res = await fetch(`/api/admin/boutique/commandes/${order.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId })
      });
      if (res.ok) onLinked();
    } finally {
      setLinking(null);
    }
  };

  return (
    <div>
      <input
        className="admin-input"
        placeholder="Rechercher une joueuse ou un parent..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: "0.5rem" }}
      />
      {searching && <p style={{ fontSize: "0.72rem", color: "#6d6b71" }}>Recherche...</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => link(r.id)}
            disabled={linking === r.id}
            style={{ textAlign: "left", background: "#17151e", border: "1px solid #302e36", borderRadius: "6px", padding: "0.5rem 0.7rem", fontSize: "0.78rem", color: "#c3c2c8", cursor: "pointer" }}
          >
            {r.player_first_name} {r.player_last_name} ({r.category_id}) — parent : {r.parent_name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminUniformeCommandeDetail({ order: initialOrder, events, seasons, problems: initialProblems }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [problems, setProblems] = useState(initialProblems);
  const [role, setRole] = useState<"admin" | "gerante" | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deliverQuantities, setDeliverQuantities] = useState<Record<string, number>>(
    () => Object.fromEntries(initialOrder.items.map((i) => [i.id, i.quantity - i.delivered_quantity]))
  );
  const [parentConfirmed, setParentConfirmed] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [problemType, setProblemType] = useState<ProblemType>("mauvaise_taille");
  const [problemDescription, setProblemDescription] = useState("");
  const [addingProblem, setAddingProblem] = useState(false);
  const [seasonSelect, setSeasonSelect] = useState(order.season_key ?? "");

  useEffect(() => {
    fetch("/api/admin/session").then((r) => r.json()).then((d: { role: "admin" | "gerante" | null }) => setRole(d.role)).catch(() => setRole(null));
  }, []);
  const showPrices = role === "admin";
  const deliveredByName = role ? DELIVERED_BY_LABEL[role] : null;

  const changeStatus = async (status: DistributionStatus) => {
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/admin/boutique/commandes/${order.id}/distribution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) setOrder((o) => ({ ...o, distribution_status: status }));
    } finally {
      setStatusSaving(false);
    }
  };

  const confirmDelivery = async () => {
    if (!deliveredByName) return;
    setDelivering(true);
    try {
      const deliveries = order.items.map((i) => ({ itemId: i.id, deliveredQuantity: Math.max(i.delivered_quantity, deliverQuantities[i.id] ?? i.delivered_quantity) }));
      const res = await fetch(`/api/admin/boutique/commandes/${order.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveries, deliveredBy: deliveredByName, parentConfirmed })
      });
      if (res.ok) window.location.reload();
    } finally {
      setDelivering(false);
    }
  };

  const saveNotes = async () => {
    await fetch(`/api/admin/boutique/commandes/${order.id}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes })
    });
  };

  const saveSeason = async () => {
    if (!seasonSelect) return;
    const res = await fetch(`/api/admin/boutique/commandes/${order.id}/saison`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seasonKey: seasonSelect })
    });
    if (res.ok) setOrder((o) => ({ ...o, season_key: seasonSelect }));
  };

  const addProblem = async () => {
    setAddingProblem(true);
    try {
      const res = await fetch(`/api/admin/boutique/commandes/${order.id}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemType, description: problemDescription.trim() || null })
      });
      if (res.ok) {
        setProblems((prev) => [{ id: crypto.randomUUID(), order_id: order.id, problem_type: problemType, description: problemDescription.trim() || null, status: "ouvert", created_at: new Date().toISOString(), resolved_at: null }, ...prev]);
        setProblemDescription("");
      }
    } finally {
      setAddingProblem(false);
    }
  };

  const resolveProblem = async (problemId: string) => {
    const res = await fetch(`/api/admin/boutique/problemes/${problemId}`, { method: "PATCH" });
    if (res.ok) setProblems((prev) => prev.map((p) => (p.id === problemId ? { ...p, status: "resolu", resolved_at: new Date().toISOString() } : p)));
  };

  const seasonLabel = order.registration ? seasons.find((s) => s.id === order.registration!.seasonId)?.label : seasons.find((s) => s.id === order.season_key)?.label;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <Link href="/admin/uniformes/a-remettre" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>← Uniformes à remettre</Link>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div>
              <p className="admin-section-title" style={{ margin: 0, fontSize: "1.1rem", textTransform: "none", letterSpacing: 0, color: "#fff" }}>Commande #{order.id.slice(0, 8)}</p>
              <p style={{ fontSize: "0.78rem", color: "#6d6b71", margin: "0.2rem 0 0" }}>
                {new Date(order.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                {seasonLabel && ` · ${seasonLabel}`}
              </p>
            </div>
            <select
              className="admin-input"
              value={order.distribution_status}
              onChange={(e) => changeStatus(e.target.value as DistributionStatus)}
              disabled={statusSaving}
              style={{ width: "auto" }}
            >
              {(Object.keys(DISTRIBUTION_STATUS_LABELS) as DistributionStatus[]).map((s) => <option key={s} value={s}>{DISTRIBUTION_STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ flex: "1 1 320px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
              <p className="admin-drawer-section-title">Joueuse</p>
              {order.registration ? (
                <div>
                  <p style={{ fontSize: "0.9rem", color: "#fff", margin: "0 0 0.2rem" }}>
                    {order.registration.playerFirstName} {order.registration.playerLastName}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9d9da0", margin: 0 }}>
                    {order.registration.categoryId}{order.registration.advancedGroup ? " · Avancé" : ""}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9d9da0", margin: "0.4rem 0 0" }}>
                    Parent : {order.registration.parentName} · {order.registration.parentPhone}
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "0.78rem", color: "#c3c2c8", margin: "0 0 0.5rem" }}>{order.customer_name} · {order.customer_email}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</p>
                  <RegistrationLinker order={order} onLinked={() => window.location.reload()} />
                </div>
              )}
            </div>

            {!order.registration && (
              <div style={{ flex: "1 1 220px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
                <p className="admin-drawer-section-title">Saison</p>
                <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.5rem" }}>Commande sans joueuse reliée — assignez sa saison manuellement.</p>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <select className="admin-input" value={seasonSelect} onChange={(e) => setSeasonSelect(e.target.value)}>
                    <option value="">—</option>
                    {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <button onClick={saveSeason} className="admin-btn-ghost" style={{ fontSize: "0.75rem" }}>OK</button>
                </div>
              </div>
            )}
          </div>

          <div className="admin-table-wrap" style={{ marginBottom: "1.5rem" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Taille</th>
                  <th>Quantité</th>
                  <th>Remis</th>
                  {showPrices && <th>Prix</th>}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.variant_label ?? "—"}</td>
                    <td>{item.quantity}</td>
                    <td style={{ color: item.delivered_quantity >= item.quantity ? "#7fd88f" : item.delivered_quantity > 0 ? "#ffb464" : "#6d6b71" }}>
                      {item.delivered_quantity}/{item.quantity}
                    </td>
                    {showPrices && <td>{formatPrice(item.unit_price_cents * item.quantity)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showPrices && (
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#9ec99e", marginBottom: "1.5rem" }}>Total : {formatPrice(order.total_cents)}</p>
          )}

          {order.distribution_status !== "remis" && (
            <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem", marginBottom: "1.5rem" }}>
              <p className="admin-drawer-section-title">Confirmer la remise</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                {order.items.map((item) => (
                  <label key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#c3c2c8" }}>
                    <span>{item.product_name}{item.variant_label ? ` — ${item.variant_label}` : ""}</span>
                    <input
                      type="number" min={0} max={item.quantity}
                      className="admin-input"
                      style={{ width: "70px" }}
                      value={deliverQuantities[item.id] ?? 0}
                      onChange={(e) => setDeliverQuantities((prev) => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)) }))}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "#9d9da0", cursor: "pointer" }}>
                  <input type="checkbox" checked={parentConfirmed} onChange={(e) => setParentConfirmed(e.target.checked)} />
                  Parent a confirmé la réception
                </label>
                <button onClick={confirmDelivery} disabled={delivering || !deliveredByName} className="admin-btn-primary" style={{ fontSize: "0.78rem" }}>
                  {delivering ? "..." : deliveredByName ? `Uniforme remis (${deliveredByName})` : "Uniforme remis"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ flex: "1 1 320px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
              <p className="admin-drawer-section-title">Problèmes ({problems.filter((p) => p.status === "ouvert").length} ouvert(s))</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                {problems.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: p.status === "resolu" ? "#6d6b71" : "#c3c2c8" }}>
                    <span>{p.status === "resolu" ? "✓ " : "🔴 "}{PROBLEM_TYPE_LABELS[p.problem_type]}{p.description ? ` — ${p.description}` : ""}</span>
                    {p.status === "ouvert" && (
                      <button onClick={() => resolveProblem(p.id)} style={{ background: "none", border: "none", color: "#7fd88f", cursor: "pointer", fontSize: "0.7rem", textDecoration: "underline" }}>Résoudre</button>
                    )}
                  </div>
                ))}
                {problems.length === 0 && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: 0 }}>Aucun problème signalé.</p>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <select className="admin-input" value={problemType} onChange={(e) => setProblemType(e.target.value as ProblemType)} style={{ fontSize: "0.72rem" }}>
                  {(Object.keys(PROBLEM_TYPE_LABELS) as ProblemType[]).map((t) => <option key={t} value={t}>{PROBLEM_TYPE_LABELS[t]}</option>)}
                </select>
                <input className="admin-input" placeholder="Détails (optionnel)" value={problemDescription} onChange={(e) => setProblemDescription(e.target.value)} style={{ flex: "1 1 140px", fontSize: "0.72rem" }} />
                <button onClick={addProblem} disabled={addingProblem} className="admin-btn-ghost" style={{ fontSize: "0.7rem" }}>Signaler</button>
              </div>
            </div>

            <div style={{ flex: "1 1 220px", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1.1rem" }}>
              <p className="admin-drawer-section-title">Notes</p>
              <textarea className="admin-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} />
            </div>
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Historique</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {events.map((e) => (
              <p key={e.id} style={{ fontSize: "0.75rem", color: "#9d9da0", margin: 0 }}>
                {new Date(e.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} — {e.detail ?? e.event}
                {e.performed_by && <span style={{ color: "#6d6b71" }}> (par {e.performed_by})</span>}
              </p>
            ))}
            {events.length === 0 && <p style={{ fontSize: "0.75rem", color: "#6d6b71" }}>Aucun historique pour le moment.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
