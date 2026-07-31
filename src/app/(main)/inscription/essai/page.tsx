import type { Metadata } from "next";

import { InscriptionContent } from "@/components/inscription-content";

export const metadata: Metadata = {
  title: "Essai gratuit | New Valkyria",
  description: "Réservez une séance d'essai gratuite pour votre joueuse — saison Automne–Hiver 2027."
};

export default function EssaiPage() {
  return <InscriptionContent variant="trial" />;
}
