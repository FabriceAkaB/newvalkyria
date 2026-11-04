import type { Metadata } from "next";

import { RefereeLinkRequest, RefereeSignup } from "@/components/referee-board";
import { isSlotId } from "@/lib/match-links";
import { MATCH_FORMAT } from "@/lib/match-slots-core";
import { dateLong, listMatches } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Match à arbitrer | New Valkyria", robots: { index: false, follow: false, nocache: true } };

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.3rem 1.2rem", border: "1px solid #e6e0ee", marginTop: "1rem" };
const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;
const hour = (t: string) => t.replace(":", " h ");

/** La page d'un match pour les arbitres (lien copié depuis l'admin) : le match, la paie, et comment le réserver. */
export default async function RefereeMatchPage({ params }: { params: Promise<{ slotId: string }> }) {
  const { slotId } = await params;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const matches = isSlotId(slotId) ? await listMatches({ from: today }) : [];
  const m = matches.find((x) => x.id === slotId);
  if (!m) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Ce match n&apos;est plus offert</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6 }}>Il est passé ou a été retiré. Inscrivez-vous ci-dessous pour recevoir les prochains matchs à arbitrer.</p>
        <RefereeSignup />
      </div>
    );
  }
  const group = m.doubleGroup ? matches.filter((x) => x.doubleGroup === m.doubleGroup).sort((a, b) => a.start.localeCompare(b.start)) : [m];
  const first = group[0];
  const last = group[group.length - 1];
  const open = group.reduce((n, x) => n + x.assignments.filter((a) => a.status === "ouvert").length, 0);
  const taken = group.reduce((n, x) => n + x.assignments.filter((a) => a.status === "reserve").length, 0);
  const teams = `${m.ourTeam ?? "New Valkyria"} contre ${m.opponent ?? "adversaire à confirmer"}`;
  return (
    <>
      <div style={card}>
        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b2a86" }}>Match à arbitrer</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.3rem 0 0", color: "#1d1730" }}>
          {dateLong(m.date)}
        </h1>
        <p style={{ margin: "0.2rem 0 0", fontSize: "1.1rem", fontWeight: 700, color: "#1d1730" }}>
          {hour(first.start)}
          {last.end ? ` à ${hour(last.end)}` : ""}
          {group.length > 1 ? " · 2 matchs de suite" : ""}
        </p>
        {m.opponentLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.opponentLogo} alt={m.opponent ?? "Club adverse"} width={56} height={56} style={{ width: 56, height: 56, objectFit: "contain", marginTop: "0.6rem", borderRadius: 10, border: "1px solid #e6e0ee", background: "#fff" }} />
        ) : null}
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.6rem 0 0" }}>
          {m.field ? `${m.field} — ` : ""}
          {m.location}
          <br />
          {teams} · {m.format || MATCH_FORMAT}
          <br />
          Arrivée 30 minutes avant le premier match.
        </p>
        <div style={{ marginTop: "0.9rem", padding: "0.8rem 0.9rem", borderRadius: 12, background: "#f4effa" }}>
          <p style={{ margin: 0, fontWeight: 800, color: "#1d1730", fontSize: "1.1rem" }}>
            {group.length > 1 ? `${money(group.reduce((n, x) => n + x.refereeFeeCents, 0))} pour les 2 matchs` : `${money(m.refereeFeeCents)} le match`}
          </p>
          <p style={{ margin: "0.2rem 0 0", color: "#5d566b", fontSize: "0.9rem" }}>
            {group.length > 1 ? `${money(m.refereeFeeCents)} par match · ` : ""}payé par virement Interac dans les 2 jours suivant le match
          </p>
        </div>
        <p style={{ margin: "0.8rem 0 0", color: open ? "#1e6b34" : "#6b6478", fontWeight: 700 }}>
          {open ? `${open} poste${open > 1 ? "s" : ""} d'arbitre ouvert${open > 1 ? "s" : ""} : premier arrivé, premier servi.` : taken ? "Tous les postes sont pris pour ce match." : "Les postes s'ouvrent dès que l'adversaire a confirmé : inscrivez-vous pour être avisé."}
        </p>
      </div>

      <div style={card}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Déjà arbitre chez nous ?</h2>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.4rem 0 0.8rem" }}>Réservez ce match avec votre lien personnel (reçu par courriel). Perdu ? Entrez votre courriel, on vous le renvoie.</p>
        <RefereeLinkRequest />
      </div>

      <div style={card}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Nouveau ? Inscrivez-vous</h2>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.4rem 0 0.8rem" }}>Une fois approuvé, vous recevez votre lien pour réserver ce match et les suivants.</p>
        <RefereeSignup />
      </div>
    </>
  );
}
