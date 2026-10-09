"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ShareProgramButtons, type ShareProgram } from "@/components/share-program-buttons";
import { formatMoney } from "@/lib/private-programs";

interface Summary {
  code: string;
  referralsCount: number;
  validatedCount: number;
  rewardsConfirmed: number;
  rewardsPending: number;
  creditBalanceCents: number;
  items: { id: string; programSlug: string; playerLabel: string; status: string; rewardStatus: string; rewardChoice: string | null; createdAt: string }[];
}

interface Data {
  summary: Summary;
  ledger: { id: string; deltaCents: number; kind: string; note: string | null; createdAt: string }[];
  origin: string;
  programs: ShareProgram[];
}

const STATUS_LABELS: Record<string, string> = {
  a_verifier: "À vérifier",
  confirme: "Confirmée — en attente du paiement",
  valide: "Validée",
  rejete: "Refusée",
  annule: "Annulée"
};
const REWARD_LABELS: Record<string, string> = {
  aucune: "—",
  a_choisir: "À choisir",
  sac_a_remettre: "Sac — à remettre",
  sac_remis: "Sac — remis",
  credit_accorde: "Crédit de 50 $ accordé",
  annulee: "Annulée"
};

export function ParentRecommandations() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/compte/recommandations");
    if (res.status === 401) {
      window.location.href = "/compte";
      return;
    }
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Erreur");
    else setData(json);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async (referralId: string, choice: "sac" | "credit") => {
    setBusy(referralId + choice);
    setError(null);
    try {
      const res = await fetch("/api/compte/recommandations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referralId, choice }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) return <p style={{ color: "#ff9999" }}>{error}</p>;
  if (!data) return <p style={{ color: "#9d9da0" }}>Chargement…</p>;
  const s = data.summary;
  const pending = s.items.filter((i) => i.rewardStatus === "a_choisir");

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.1rem" };
  const stat: React.CSSProperties = { ...card, marginBottom: 0, textAlign: "center", padding: "0.8rem 0.5rem" };

  return (
    <div>
      <div style={card}>
        <p style={{ fontSize: "0.72rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Mon code</p>
        <p style={{ fontSize: "1.8rem", fontWeight: 800, color: "#c4a4e4", letterSpacing: "0.12em", margin: 0 }}>{s.code}</p>
        <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0.4rem 0 0" }}>
          Quand une famille s&apos;inscrit avec votre lien, elle reçoit un rabais de 50 $ et vous choisissez une récompense : un sac New Valkyria ou un crédit de 50 $.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem", marginBottom: "1.1rem" }}>
        <div style={stat}><p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0 }}>{s.referralsCount}</p><p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>Recommandations</p></div>
        <div style={stat}><p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0 }}>{s.validatedCount}</p><p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>Validées</p></div>
        <div style={stat}><p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#8fce9f", margin: 0 }}>{s.rewardsConfirmed}</p><p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>Récompenses confirmées</p></div>
        <div style={stat}><p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f0c878", margin: 0 }}>{s.rewardsPending}</p><p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>Récompenses en attente</p></div>
        <div style={stat}><p style={{ fontSize: "1.4rem", fontWeight: 800, color: "#c4a4e4", margin: 0 }}>{formatMoney(s.creditBalanceCents)}</p><p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>Crédit disponible</p></div>
      </div>

      {error && <p style={{ color: "#ff9999", fontSize: "0.82rem" }}>{error}</p>}

      {pending.length > 0 && (
        <div style={{ ...card, borderColor: "#f0c878" }}>
          <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>🎁 Choisissez votre récompense</p>
          {pending.map((p) => (
            <div key={p.id} style={{ marginBottom: "0.8rem" }}>
              <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: "0 0 0.4rem" }}>Recommandation validée : {p.playerLabel}</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button disabled={busy !== null} onClick={() => choose(p.id, "sac")} className="nv27-btn-primary" style={{ padding: "0.55rem 0.9rem", fontSize: "0.82rem" }}>
                  {busy === p.id + "sac" ? "..." : "Recevoir un sac New Valkyria"}
                </button>
                <button disabled={busy !== null} onClick={() => choose(p.id, "credit")} className="nv27-btn-primary" style={{ padding: "0.55rem 0.9rem", fontSize: "0.82rem" }}>
                  {busy === p.id + "credit" ? "..." : "Recevoir 50 $ de crédit"}
                </button>
              </div>
            </div>
          ))}
          <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: 0 }}>Une seule récompense par nouvelle inscription. Le choix est définitif.</p>
        </div>
      )}

      <div style={card}>
        <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.8rem" }}>Mes liens à partager</p>
        {data.programs.map((p) => (
          <div key={p.slug} style={{ marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: "0 0 0.4rem" }}>Programme {p.shortName.toLowerCase()} — {formatMoney(p.priceCents)}</p>
            <ShareProgramButtons program={p} refCode={s.code} origin={data.origin} />
          </div>
        ))}
      </div>

      {s.items.length > 0 && (
        <div style={card}>
          <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Mes recommandations</p>
          {s.items.map((i) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", padding: "0.4rem 0", borderBottom: "1px solid #1f1d25", fontSize: "0.8rem" }}>
              <span style={{ color: "#fff" }}>{i.playerLabel}</span>
              <span style={{ color: "#9d9da0" }}>{STATUS_LABELS[i.status] ?? i.status} · {REWARD_LABELS[i.rewardStatus] ?? i.rewardStatus}</span>
            </div>
          ))}
        </div>
      )}

      {data.ledger.length > 0 && (
        <div style={card}>
          <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Historique de mon crédit</p>
          {data.ledger.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.78rem", padding: "0.3rem 0", borderBottom: "1px solid #1f1d25" }}>
              <span style={{ color: "#c3c2c8" }}>{new Date(e.createdAt).toLocaleDateString("fr-CA")} · {e.note ?? e.kind}</span>
              <span style={{ color: e.deltaCents >= 0 ? "#8fce9f" : "#ffb464", fontWeight: 700 }}>{e.deltaCents >= 0 ? "+" : "−"} {formatMoney(Math.abs(e.deltaCents))}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: "0.75rem", color: "#6d6b71" }}>
        <Link href="/compte/espace" style={{ color: "#c4a4e4" }}>← Retour à mon espace</Link>
      </p>
    </div>
  );
}
