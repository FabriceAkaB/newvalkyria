import type { Metadata } from "next";

import { InviteAnswer } from "@/components/invite-answer";
import { getInviteByToken } from "@/lib/practice-invites-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitation à l'avancé | New Valkyria", robots: { index: false, follow: false, nocache: true } };

const card = { background: "#fff", borderRadius: 16, padding: "1.4rem", border: "1px solid #e6e0ee", display: "grid", gap: 14 } as const;
const frDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const frTime = (t: string) => t.slice(0, 5).replace(":", " h ");

/** Page du lien envoyé au parent : la pratique de l'avancé où sa fille est invitée, et « Oui » / « Non ». */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await getInviteByToken(token);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  if (!r || r.status === "proposee" || r.status === "annulee") {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Invitation introuvable</h1>
        <p style={{ margin: 0, color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com.</p>
      </div>
    );
  }
  const girl = r.player_name.split(" ")[0];
  const past = r.practice_date < today || r.status === "expiree";
  return (
    <div style={card}>
      <p style={{ margin: 0, color: "#5d566b" }}>Invitation · groupe avancé</p>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>{girl} est invitée à la pratique de l&apos;avancé</h1>
      <p style={{ margin: 0, fontSize: "1.05rem", textTransform: "capitalize" }}>
        <strong>{frDate(r.practice_date)}</strong>, {frTime(r.start_time)}{r.end_time ? ` à ${frTime(r.end_time)}` : ""}
      </p>
      {r.location && <p style={{ margin: 0, color: "#3d3650" }}>{r.location}</p>}
      <p style={{ margin: 0, color: "#3d3650" }}>
        Des places se libèrent dans le groupe avancé. Nous invitons les filles du groupe intermédiaire à venir s&apos;y entraîner pour progresser. C&apos;est sans frais.
      </p>
      {past ? <p style={{ margin: 0, color: "#5d566b" }}>Cette pratique est passée. Merci !</p> : <InviteAnswer token={token} initial={r.status} girl={girl} />}
    </div>
  );
}
