"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DEFAULT_RULES, REWARD_KINDS, RULE_LABELS, type PointsRules, type RewardKind } from "@/lib/player-points";
import type { PointReward } from "@/lib/player-points-repo";

async function post(body: unknown): Promise<string | null> {
  const res = await fetch("/api/admin/coaching/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return null;
  const data = await res?.json().catch(() => ({}));
  return data?.error ?? "Pas enregistré : réessaie.";
}

const money = (c: number | null) => (c ? (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) : "");

/** Remettre une récompense tout de suite (à la pratique, par l'admin) : les points sont retirés du solde. */
export function RedeemButton({ registrationId, name, balance, rewards }: { registrationId: string; name: string; balance: number; rewards: PointReward[] }) {
  const router = useRouter();
  const options = rewards.filter((r) => r.active && r.cost <= balance);
  const [rewardId, setRewardId] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!options.length) return <span style={{ fontSize: "0.78rem", color: "var(--adm-text-3)" }}>—</span>;
  const redeem = async () => {
    const r = options.find((o) => o.id === rewardId);
    if (!r || !confirm(`Remettre « ${r.name} » à ${name} ? ${r.cost} points seront retirés de son solde.`)) return;
    const problem = await post({ action: "redeem", registrationId, rewardId });
    if (problem) return setError(problem);
    setRewardId("");
    router.refresh();
  };
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select className="admin-input" value={rewardId} onChange={(e) => setRewardId(e.target.value)} aria-label={`Récompense pour ${name}`} style={{ minWidth: 0, maxWidth: 180 }}>
        <option value="">Remettre…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.cost})</option>)}
      </select>
      {rewardId && <button type="button" className="admin-btn-primary" onClick={redeem}>OK</button>}
      {error && <span style={{ color: "var(--adm-bad)", fontSize: "0.78rem" }}>{error}</span>}
    </span>
  );
}

/** Une demande de récompense à remettre : « Remise » coche la tâche, « Annuler » rend les points. */
export function RedemptionActions({ id, name, reward }: { id: string; name: string; reward: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (status: "remise" | "annulee") => {
    if (status === "annulee" && !confirm(`Annuler « ${reward} » pour ${name} ? Ses points lui sont rendus.`)) return;
    setBusy(true);
    const problem = await post({ action: "redemption", id, status });
    setBusy(false);
    if (problem) return alert(problem);
    router.refresh();
  };
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => act("remise")}>Remise</button>
      <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => act("annulee")}>Annuler</button>
    </span>
  );
}

/** Retirer une publication du fil des familles (les points restent), ou la remettre. */
export function HidePostButton({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="admin-btn-ghost"
      onClick={async () => {
        const problem = await post({ action: "hide-post", id, hidden: !hidden });
        if (problem) return alert(problem);
        router.refresh();
      }}
    >
      {hidden ? "Remettre au fil" : "Retirer du fil"}
    </button>
  );
}

/** Le barème : combien vaut chaque chose. Présence et bienvenue se recalculent pour toutes les joueuses. */
export function RulesEditor({ rules, canEdit }: { rules: PointsRules; canEdit: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, String(v)])));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keys = Object.keys(DEFAULT_RULES) as (keyof PointsRules)[];
  const save = async () => {
    const problem = await post({ action: "rules", rules: Object.fromEntries(keys.map((k) => [k, Number(values[k])])) });
    if (problem) return setError(problem);
    setError(null);
    setSaved(true);
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {keys.map((k) => (
          <label key={k} className="ct-field">
            <span>{RULE_LABELS[k]}</span>
            <input
              className="admin-input"
              inputMode="numeric"
              disabled={!canEdit}
              value={values[k]}
              onChange={(e) => {
                setSaved(false);
                setValues({ ...values, [k]: e.target.value.replace(/\D/g, "") });
              }}
              style={{ fontVariantNumeric: "tabular-nums" }}
            />
          </label>
        ))}
      </div>
      {canEdit ? (
        <div className="cm-actions" style={{ marginTop: 0 }}>
          <button type="button" className="admin-btn-primary" onClick={save}>Enregistrer le barème</button>
          {saved && <span style={{ color: "var(--adm-good)", fontSize: "0.85rem" }}>Enregistré : les soldes sont recalculés.</span>}
          {error && <span style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{error}</span>}
        </div>
      ) : (
        <p className="admin-empty-text" style={{ margin: 0 }}>Seul l&apos;admin change le barème.</p>
      )}
    </div>
  );
}

/** Catalogue des récompenses : un cadeau, un rabais en boutique ou un crédit sur la prochaine saison, son prix en
 *  points, et le cadeau par défaut de fin de saison. */
export function RewardsEditor({ rewards, products }: { rewards: PointReward[]; products: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [kind, setKind] = useState<RewardKind>("cadeau");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [productId, setProductId] = useState("");
  const [stock, setStock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const base = (r: PointReward) => ({ id: r.id, name: r.name, cost: r.cost, kind: r.kind, valueCents: r.value_cents, description: r.description, isDefault: r.is_default, productId: r.product_id, active: r.active, stock: r.stock });
  const add = async () => {
    const problem = await post({ action: "reward", name, cost: Number(cost), kind, valueCents: value ? Math.round(Number(value.replace(",", ".")) * 100) : null, description, isDefault, productId: productId || null, stock: stock ? Number(stock) : null });
    if (problem) return setError(problem);
    setName("");
    setCost("");
    setValue("");
    setDescription("");
    setIsDefault(false);
    setProductId("");
    setError(null);
    router.refresh();
  };
  const update = async (r: PointReward, patch: Partial<ReturnType<typeof base>>) => {
    const problem = await post({ action: "reward", ...base(r), ...patch });
    if (problem) return alert(problem);
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rewards.length === 0 && <p className="admin-empty-text" style={{ margin: 0 }}>Aucune récompense : ajoute la première (ex. un bracelet, choisir le jeu de fin, 10 $ en boutique, 25 $ sur la prochaine saison) et choisis le cadeau par défaut de fin de saison.</p>}
      {rewards.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", opacity: r.active ? 1 : 0.5 }}>
          <span style={{ color: "var(--adm-text)" }}>
            {REWARD_KINDS[r.kind].emoji} <strong>{r.cost} points</strong> · {r.name}
            {r.value_cents ? ` · ${money(r.value_cents)}` : ""}
            {r.product_id ? ` · ${products.find((p) => p.id === r.product_id)?.name ?? "produit"}` : ""}
            {r.is_default ? <span style={{ marginLeft: 6, fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999, background: "var(--adm-accent-soft)" }}>Cadeau de fin de saison</span> : null}
            {r.stock !== null ? <span style={{ marginLeft: 6, fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999, background: "var(--adm-surface-3)" }}>{r.stock === 1 ? "Prix unique" : `${r.stock} exemplaires`} · {r.left === 0 ? "déjà gagné" : `${r.left} à gagner`}</span> : null}
            {r.product_id ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>aussi en boutique</span> : <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>seulement en le méritant</span>}
          </span>
          <span style={{ display: "inline-flex", gap: 6 }}>
            {!r.is_default && r.kind === "cadeau" && r.active ? <button type="button" className="admin-btn-ghost" onClick={() => update(r, { isDefault: true })}>Cadeau par défaut</button> : null}
            <button type="button" className="admin-btn-ghost" onClick={() => update(r, { active: !r.active })}>{r.active ? "Retirer" : "Remettre"}</button>
          </span>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <label className="ct-field"><span>Récompense</span><input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Bracelet Valkyria" /></label>
        <label className="ct-field">
          <span>Type</span>
          <select className="admin-input" value={kind} onChange={(e) => setKind(e.target.value as RewardKind)}>
            {(Object.keys(REWARD_KINDS) as RewardKind[]).map((k) => <option key={k} value={k}>{REWARD_KINDS[k].label}</option>)}
          </select>
        </label>
        <label className="ct-field"><span>Prix en points</span><input className="admin-input" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} /></label>
        {kind !== "cadeau" && (
          <label className="ct-field"><span>Valeur en $</span><input className="admin-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Ex. 10" /></label>
        )}
        <label style={{ display: "grid", gap: 4, fontSize: "0.8125rem" }}>
          Combien à gagner (vide = autant qu&apos;on veut, 1 = prix unique)
          <input className="admin-input" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))} placeholder="ex. 1 pour la grosse peluche" />
        </label>
        <label className="ct-field">
          <span>Produit de la boutique (facultatif)</span>
          <select className="admin-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">—</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="ct-field" style={{ gridColumn: "1 / -1" }}><span>Ce que la famille voit (facultatif)</span><input className="admin-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. Remis à la fin d'une pratique, au choix de couleur" /></label>
      </div>
      {kind === "cadeau" && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--adm-text-2)", fontSize: "0.88rem" }}>
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Cadeau par défaut : remis à la fin de la saison à celles qui n&apos;ont pas tout dépensé
        </label>
      )}
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" onClick={add} disabled={!name.trim() || !cost || (kind !== "cadeau" && !value)}>Ajouter la récompense</button>
        {error && <span style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }}>{error}</span>}
      </div>
    </div>
  );
}
