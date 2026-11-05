import type { Metadata } from "next";

import { RefereeLinkRequest, RefereeSignup } from "@/components/referee-board";
import { MATCH_FORMAT, placeName } from "@/lib/match-slots-core";
import { dateLong, listMatches, type MatchRow } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matchs à arbitrer | New Valkyria", robots: { index: false, follow: false, nocache: true } };

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.2rem 1.1rem", border: "1px solid #e6e0ee", marginTop: "1rem" };
const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;
const hour = (t: string) => t.replace(":", " h ");

/** Le lien à donner aux arbitres : tous les matchs à venir, où, quand et combien on paie (sans le nom des adversaires),
 *  avec l'inscription pour les nouveaux et le lien personnel pour réserver. */
export default async function RefereeMatchesPage() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const matches = await listMatches({ from: today });
  // Une double cédule (2 matchs de suite) est montrée en un seul bloc.
  const units: MatchRow[][] = [];
  for (const m of matches) {
    const unit = m.doubleGroup ? units.find((u) => u[0].doubleGroup === m.doubleGroup) : null;
    if (unit) unit.push(m);
    else units.push([m]);
  }
  const byMonth = new Map<string, MatchRow[][]>();
  for (const u of units) byMonth.set(u[0].date.slice(0, 7), [...(byMonth.get(u[0].date.slice(0, 7)) ?? []), u]);
  const monthLabel = (k: string) => {
    const s = new Date(`${k}-15T12:00:00Z`).toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const fee = matches[0]?.refereeFeeCents ?? 5000;

  return (
    <>
      <div style={card}>
        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b2a86" }}>Arbitres recherchés</p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.3rem 0 0", color: "#1d1730" }}>Les matchs à arbitrer</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.5rem 0 0" }}>
          Soccer jeunesse à 7 contre 7, à Terrebonne et à Rosemère. <strong>{money(fee)} par match, {money(fee * 2)} pour une double plage</strong> (2 matchs de suite), payé par virement Interac dans les 2 jours suivant le match. Arrivée 30 minutes avant.
        </p>
      </div>

      {units.length === 0 ? (
        <p style={{ ...card, color: "#5d566b" }}>Aucun match à venir pour l&apos;instant. Inscrivez-vous plus bas pour être avisé.</p>
      ) : (
        [...byMonth].map(([k, list]) => (
          <div key={k}>
            <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: "1.4rem 0 0", color: "#5b2a86" }}>{monthLabel(k)}</h2>
            {list.map((u) => {
              const first = u[0];
              const last = u[u.length - 1];
              const open = u.reduce((n, x) => n + x.assignments.filter((a) => a.status === "ouvert").length, 0);
              const taken = u.reduce((n, x) => n + x.assignments.filter((a) => a.status === "reserve").length, 0);
              const pay = u.reduce((n, x) => n + x.refereeFeeCents, 0);
              return (
                <div key={first.id} style={{ ...card, marginTop: "0.6rem" }}>
                  <p style={{ margin: 0, fontWeight: 800, color: "#1d1730" }}>
                    {dateLong(first.date)} · {hour(first.start)}
                    {last.end ? ` à ${hour(last.end)}` : ""}
                    {u.length > 1 ? " · 2 matchs de suite" : ""}
                  </p>
                  <p style={{ margin: "0.3rem 0 0", color: "#5d566b", lineHeight: 1.5 }}>
                    <strong style={{ color: "#1d1730" }}>{placeName(first.location)}</strong>
                    {first.field ? ` · ${first.field}` : ""}
                    <br />
                    <span style={{ fontSize: "0.88rem" }}>{first.location.replace(/\s+—\s+terrain voisin$/, "")}</span>
                    <br />
                    {first.format || MATCH_FORMAT} · <strong style={{ color: "#1d1730" }}>{money(pay)}</strong>
                    {u.length > 1 ? ` (${money(first.refereeFeeCents)} par match)` : ""}
                  </p>
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.88rem", fontWeight: 700, color: open ? "#1e6b34" : "#6b6478" }}>
                    {open ? `${open} poste${open > 1 ? "s" : ""} d'arbitre ouvert${open > 1 ? "s" : ""}` : taken ? "Arbitres trouvés" : "Postes ouverts dès que le match est confirmé"}
                  </p>
                </div>
              );
            })}
          </div>
        ))
      )}

      <div style={card}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Déjà arbitre chez nous ?</h2>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.4rem 0 0.8rem" }}>Réservez vos matchs avec votre lien personnel (reçu par courriel). Perdu ? Entrez votre courriel, on vous le renvoie.</p>
        <RefereeLinkRequest />
      </div>
      <div style={card}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Nouveau ? Inscrivez-vous</h2>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.4rem 0 0.8rem" }}>Une fois approuvé, vous recevez votre lien pour réserver les matchs qui vous conviennent.</p>
        <RefereeSignup />
      </div>
    </>
  );
}
