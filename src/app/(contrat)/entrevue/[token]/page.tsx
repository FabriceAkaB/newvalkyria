import type { Metadata } from "next";

import { InterviewSlotPicker } from "@/components/content-admin";
import { slotLabel } from "@/lib/content-format";
import { getInterviewByToken } from "@/lib/content-repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrevue filmée | New Valkyria",
  robots: { index: false, follow: false, nocache: true }
};

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.4rem 1.3rem", border: "1px solid #e6e0ee", marginTop: "1rem" };

/** Invitation à l'entrevue filmée : la famille choisit son moment parmi les journées d'entrevues (lien personnel). */
export default async function EntrevuePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = /^[A-Za-z0-9_-]{10,40}$/.test(token) ? await getInterviewByToken(token) : null;
  if (!found) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Lien introuvable</h1>
        <p style={{ color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com.</p>
      </div>
    );
  }
  const { interviews, slots } = found;
  const names = interviews.map((i) => i.player_name.split(" ")[0]).join(" et ");
  const first = (interviews[0].parent_name ?? "").trim().split(/\s+/)[0];
  return (
    <>
      <div style={card}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>L&apos;entrevue de {names}</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.6rem 0 0" }}>
          {first ? `Bonjour ${first}, ` : ""}
          nous filmons une courte entrevue (environ 5 minutes) : ce que {names} aime au soccer, ce qu&apos;elle veut apprendre et, en fin de saison, le chemin parcouru.
          {interviews[0].with_parent ? " Si vous le voulez bien, nous aimerions aussi vous poser 2 ou 3 questions sur votre expérience." : ""}
        </p>
      </div>
      <div style={card}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.8rem", color: "#1d1730" }}>Choisissez votre moment</h2>
        {slots.length ? (
          <InterviewSlotPicker token={token} slots={slots.map((s) => ({ id: s.id, label: slotLabel(s), remaining: s.remaining }))} current={interviews[0].slot_id} />
        ) : (
          <p style={{ color: "#5d566b", margin: 0 }}>Les prochaines journées d&apos;entrevues seront annoncées bientôt. Merci de votre patience !</p>
        )}
      </div>
    </>
  );
}
