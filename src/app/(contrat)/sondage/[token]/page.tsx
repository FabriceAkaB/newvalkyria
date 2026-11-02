import type { Metadata } from "next";

import { SurveyForm } from "@/components/survey-form";
import { getInviteByToken } from "@/lib/surveys-repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sondage | New Valkyria",
  robots: { index: false, follow: false, nocache: true }
};

const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1.4rem 1.3rem", border: "1px solid #e6e0ee", marginTop: "1rem" };

/** Sondage aux familles : lien personnel (on sait quelle famille répond). */
export default async function SurveyPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = /^[A-Za-z0-9_-]{10,40}$/.test(token) ? await getInviteByToken(token) : null;
  if (!found) {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Lien introuvable</h1>
        <p style={{ color: "#5d566b" }}>Écrivez-nous à info@newvalkyria.com.</p>
      </div>
    );
  }
  const { survey, invite, response } = found;
  if (survey.status === "ferme") {
    return (
      <div style={card}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Ce sondage est terminé</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6 }}>Merci ! Vous pouvez toujours nous écrire à info@newvalkyria.com.</p>
      </div>
    );
  }
  const first = (invite.parent_name ?? "").trim().split(/\s+/)[0];
  return (
    <>
      <div style={card}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>{survey.title}</h1>
        <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.6rem 0 0" }}>
          {first ? (
            <>
              Bonjour {first},
              <br />
            </>
          ) : null}
          {survey.intro}
        </p>
        {invite.player_names ? <p style={{ color: "#5b2a86", fontWeight: 600, margin: "0.6rem 0 0" }}>Pour : {invite.player_names}</p> : null}
      </div>
      <SurveyForm token={token} questions={survey.questions} initial={response?.answers ?? null} />
    </>
  );
}
