import type { Metadata } from "next";

import { RefereeSignup } from "@/components/referee-board";

export const metadata: Metadata = { title: "Devenir arbitre | New Valkyria", robots: { index: false, follow: false } };

/** Inscription d'un arbitre : il est approuvé par JP, puis reçoit son lien personnel. */
export default function RefereeSignupPage() {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: "1.3rem 1.2rem", border: "1px solid #e6e0ee", marginTop: "1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#1d1730" }}>Arbitrer nos matchs</h1>
      <p style={{ color: "#5d566b", lineHeight: 1.6, margin: "0.5rem 0 1rem" }}>
        Matchs de soccer jeunesse à Terrebonne, le dimanche. 50 $ par match, payé par virement Interac dans les 2 jours. Inscrivez-vous : une fois approuvé, vous recevez un lien pour réserver vos matchs.
      </p>
      <RefereeSignup />
    </div>
  );
}
