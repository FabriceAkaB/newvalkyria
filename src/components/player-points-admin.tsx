"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PointReward } from "@/lib/player-points-repo";

async function post(body: unknown): Promise<string | null> {
  const res = await fetch("/api/admin/coaching/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return null;
  const data = await res?.json().catch(() => ({}));
  return data?.error ?? "Pas enregistré : réessaie.";
}

/** Échanger les points d'une joueuse contre une récompense (seulement celles que son solde permet). */
export function RedeemButton({ registrationId, name, balance, rewards }: { registrationId: string; name: string; balance: number; rewards: PointReward[] }) {
  const router = useRouter();
  const options = rewards.filter((r) => r.active && r.cost <= balance);
  const [rewardId, setRewardId] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!options.length) return <span style={{ fontSize: "0.78rem", color: "var(--adm-text-3)" }}>—</span>;
  const redeem = async () => {
    const r = options.find((o) => o.id === rewardId);
    if (!r || !confirm(`Échanger ${r.cost} points de ${name} contre « ${r.name} » ?`)) return;
    const problem = await post({ action: "redeem", registrationId, rewardId });
    if (problem) return setError(problem);
    setRewardId("");
    router.refresh();
  };
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select className="admin-input" value={rewardId} onChange={(e) => setRewardId(e.target.value)} aria-label={`Récompense pour ${name}`} style={{ minWidth: 0, maxWidth: 180 }}>
        <option value="">Échanger…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.cost})</option>)}
      </select>
      {rewardId && <button type="button" className="admin-btn-primary" onClick={redeem}>OK</button>}
      {error && <span style={{ color: "var(--adm-bad)", fontSize: "0.78rem" }}>{error}</span>}
    </span>
  );
}

/** Catalogue des récompenses : nom, coût en points, produit de la boutique (facultatif). */
export function RewardsEditor({ rewards, products }: { rewards: PointReward[]; products: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [productId, setProductId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    const problem = await post({ action: "reward", name, cost: Number(cost), productId: productId || null });
    if (problem) return setError(problem);
    setName("");
    setCost("");
    setProductId("");
    setError(null);
    router.refresh();
  };
  const toggle = async (r: PointReward) => {
    await post({ action: "reward", id: r.id, name: r.name, cost: r.cost, productId: r.product_id, active: !r.active });
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rewards.length === 0 && <p className="admin-empty-text" style={{ margin: 0 }}>Aucune récompense : ajoute la première (ex. choisir le jeu de fin de pratique, un bracelet, un ballon).</p>}
      {rewards.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: r.active ? 1 : 0.5 }}>
          <span style={{ color: "var(--adm-text)" }}>
            <strong>{r.cost} points</strong> · {r.name}
            {r.product_id ? ` · ${products.find((p) => p.id === r.product_id)?.name ?? "produit"}` : ""}
          </span>
          <button type="button" className="admin-btn-ghost" onClick={() => toggle(r)}>{r.active ? "Retirer" : "Remettre"}</button>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <label className="ct-field"><span>Récompense</span><input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="ct-field"><span>Coût en points</span><input className="admin-input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="ct-field">
          <span>Produit de la boutique (facultatif)</span>
          <select className="admin-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">—</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" onClick={add} disabled={!name.trim() || !cost}>Ajouter la récompense</button>
        {error && <span style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }}>{error}</span>}
      </div>
    </div>
  );
}
