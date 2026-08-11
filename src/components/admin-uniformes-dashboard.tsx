"use client";

import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import type { UniformStats } from "@/lib/shop-repo";

interface SeasonStat {
  key: string;
  label: string;
  stats: UniformStats;
}

interface Props {
  seasonStats: SeasonStat[];
  unassignedCount: number;
}

function seasonHealth(s: UniformStats): { emoji: string; label: string } {
  if (s.problems > 0) return { emoji: "🔴", label: `${s.problems} problème(s) à régler` };
  if (s.incomplete > 0) return { emoji: "🟠", label: `${s.incomplete} commande(s) incomplète(s)` };
  if (s.toDistribute > 0) return { emoji: "🟡", label: `${s.toDistribute} à distribuer` };
  return { emoji: "🟢", label: "Tout est distribué" };
}

function SeasonCard({ season }: { season: SeasonStat }) {
  const health = seasonHealth(season.stats);
  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "12px", padding: "1.1rem 1.25rem", flex: "1 1 300px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", margin: 0 }}>{season.label}</p>
        <span style={{ fontSize: "0.78rem" }}>{health.emoji} {health.label}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "0.9rem" }}>
        <span style={{ fontSize: "0.75rem", color: "#7fd88f" }}>🟢 {season.stats.distributed} remise(s)</span>
        <span style={{ fontSize: "0.75rem", color: "#f0c878" }}>🟡 {season.stats.toDistribute} à remettre</span>
        <span style={{ fontSize: "0.75rem", color: "#ffb464" }}>🟠 {season.stats.incomplete} incomplète(s)</span>
        <span style={{ fontSize: "0.75rem", color: "#ff9999" }}>🔴 {season.stats.problems} problème(s)</span>
      </div>
      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0 0 0.9rem" }}>
        {season.stats.distributedItems} / {season.stats.totalItems} article(s) remis · {season.stats.totalOrders} commande(s) au total
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Link href={`/admin/uniformes/a-remettre?saison=${season.key}`} className="admin-btn-ghost" style={{ textDecoration: "none", fontSize: "0.72rem", padding: "0.4rem 0.75rem" }}>
          À remettre
        </Link>
        <Link href={`/admin/uniformes/aujourdhui?saison=${season.key}`} className="admin-btn-ghost" style={{ textDecoration: "none", fontSize: "0.72rem", padding: "0.4rem 0.75rem" }}>
          Aujourd&apos;hui
        </Link>
      </div>
    </div>
  );
}

export function AdminUniformesDashboard({ seasonStats, unassignedCount }: Props) {
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Uniformes</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Distribution des uniformes, séparée par saison — reliée directement aux commandes de la boutique.
          </p>

          {unassignedCount > 0 && (
            <Link
              href="/admin/uniformes/a-remettre"
              style={{
                display: "block", fontSize: "0.78rem", color: "#ffb464", background: "rgba(255,180,100,0.1)",
                border: "1px solid rgba(255,180,100,0.3)", borderRadius: "8px", padding: "0.6rem 0.9rem", marginBottom: "1.25rem", textDecoration: "none"
              }}
            >
              ⚠ {unassignedCount} commande(s) payée(s) pas encore classée(s) par saison — à trier →
            </Link>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {seasonStats.map((s) => <SeasonCard key={s.key} season={s} />)}
            {seasonStats.length === 0 && <p className="admin-empty-text">Aucune commande d&apos;uniforme pour le moment.</p>}
          </div>

          <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <Link href="/admin/uniformes/problemes" className="admin-btn-ghost" style={{ textDecoration: "none" }}>
              Problèmes à régler
            </Link>
            <Link href="/admin/boutique/commandes" className="admin-btn-ghost" style={{ textDecoration: "none" }}>
              Toutes les commandes boutique →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
