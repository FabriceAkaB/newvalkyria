import type { Metadata } from "next";

import { InvitationGate } from "@/components/invitation-gate";

export const metadata: Metadata = {
  title: "Accès sur invitation | New Valkyria",
  description: "Accès réservé aux joueuses invitées — programmes avancés de la saison Automne–Hiver 2027.",
  robots: { index: false, follow: false }
};

export default function InvitationPage() {
  return <InvitationGate />;
}
