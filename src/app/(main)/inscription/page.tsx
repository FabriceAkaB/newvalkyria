import type { Metadata } from "next";

import { InscriptionContent } from "@/components/inscription-content";

export const metadata: Metadata = {
  title: "Inscription Automne–Hiver 2027 | New Valkyria",
  description:
    "Inscriptions ouvertes pour la saison Automne–Hiver 2027 : catégories U9 à U12, horaire complet et cinq programmes (NV, TV, TVA, SV, SVA) avec leurs tarifs.",
  alternates: { canonical: "/inscription" }
};

export default function InscriptionPage() {
  return <InscriptionContent />;
}
