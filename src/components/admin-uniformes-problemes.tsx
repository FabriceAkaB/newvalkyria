"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { PROBLEM_TYPE_LABELS, type ProblemWithOrder } from "@/lib/shop-repo";

interface Props {
  problems: ProblemWithOrder[];
  seasonLabelByKey: Record<string, string>;
}

export function AdminUniformesProblemes({ problems: initialProblems, seasonLabelByKey }: Props) {
  const [problems, setProblems] = useState(initialProblems);
  const [resolving, setResolving] = useState<string | null>(null);

  const resolve = async (id: string) => {
    setResolving(id);
    try {
      const res = await fetch(`/api/admin/boutique/problemes/${id}`, { method: "PATCH" });
      if (res.ok) setProblems((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.3rem" }}>
            <p className="admin-section-title" style={{ margin: 0 }}>Problèmes à régler ({problems.length})</p>
            <Link href="/admin/uniformes" className="admin-btn-ghost" style={{ textDecoration: "none" }}>← Uniformes</Link>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Toutes saisons confondues — mauvaise taille, article manquant, échange demandé, etc.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {problems.map((p) => (
              <div key={p.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "0.9rem 1.1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>
                    🔴 {PROBLEM_TYPE_LABELS[p.problem_type]}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9d9da0", margin: 0 }}>
                    {p.order.customer_name}{p.order.season_key ? ` · ${seasonLabelByKey[p.order.season_key] ?? p.order.season_key}` : ""}
                    {p.description ? ` — ${p.description}` : ""}
                  </p>
                  <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: "0.2rem 0 0" }}>
                    Signalé le {new Date(p.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <Link href={`/admin/uniformes/commande/${p.order.id}`} className="admin-btn-ghost" style={{ textDecoration: "none", fontSize: "0.72rem" }}>
                    Voir la commande
                  </Link>
                  <button onClick={() => resolve(p.id)} disabled={resolving === p.id} className="admin-btn-primary" style={{ fontSize: "0.72rem" }}>
                    {resolving === p.id ? "..." : "Marquer résolu"}
                  </button>
                </div>
              </div>
            ))}
            {problems.length === 0 && <p className="admin-empty-text">Aucun problème ouvert — tout va bien.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
