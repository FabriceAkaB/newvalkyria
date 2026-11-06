import type { Metadata } from "next";

import { RefereeBoard } from "@/components/referee-board";
import { canTake, dateLong, getRefereeByToken, listMatches } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Arbitres | New Valkyria", robots: { index: false, follow: false, nocache: true } };

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.3rem 1.2rem", border: "1px solid #e6e0ee", marginTop: "1rem" };

/** Page personnelle de l'arbitre : ses matchs réservés et les postes ouverts. */
export default async function RefereePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const referee = /^[A-Za-z0-9_-]{10,40}$/.test(token) ? await getRefereeByToken(token) : null;
  if (!referee || referee.status === "inactif") {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Lien introuvable</h1>
        <p style={{ color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com.</p>
      </div>
    );
  }
  if (referee.status === "en_attente") {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Inscription reçue</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6 }}>Merci {referee.first_name} ! Votre inscription sera approuvée sous peu ; vous recevrez alors ce lien par courriel pour réserver des matchs.</p>
      </div>
    );
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const matches = await listMatches({ from: today });
  const mine = matches.flatMap((m) => m.assignments.filter((a) => a.referee_id === referee.id && a.status === "reserve").map((a) => ({ id: a.id, fee: a.fee_cents, date: m.date, label: dateLong(m.date), start: m.start, end: m.end, place: `${m.field ?? ""}${m.field ? " — " : ""}${m.location}`, teams: `${m.ourTeam ?? "New Valkyria"}${m.opponent ? ` contre ${m.opponent}` : ""}`, format: m.format })));
  const open = matches
    .filter((m) => !m.assignments.some((a) => a.referee_id === referee.id && a.status === "reserve"))
    .flatMap((m) => {
      const a = m.assignments.find((x) => canTake(x, referee));
      return a ? [{ id: a.id, fee: a.fee_cents, date: m.date, label: dateLong(m.date), start: m.start, end: m.end, place: `${m.field ?? ""}${m.field ? " — " : ""}${m.location}`, teams: `${m.ourTeam ?? "New Valkyria"}${m.opponent ? ` contre ${m.opponent}` : ""}`, format: m.format, left: m.assignments.filter((x) => canTake(x, referee)).length, doubleFee: m.doubleGroup ? matches.filter((x) => x.doubleGroup === m.doubleGroup).reduce((n, x) => n + x.refereeFeeCents, 0) : null }] : [];
    });
  return (
    <>
      <div style={card}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Bonjour {referee.first_name} !</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.5rem 0 0" }}>
          Réservez les matchs que vous voulez arbitrer : premier arrivé, premier servi. Arrivée 30 minutes avant le match. 50 $ par match, 100 $ pour une double plage (2 matchs de suite), par virement Interac dans les 2 jours suivant chaque match.
        </p>
      </div>
      <RefereeBoard token={token} mine={mine} open={open} />
    </>
  );
}
