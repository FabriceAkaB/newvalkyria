import type { Metadata } from "next";

import { InscriptionContent } from "@/components/inscription-content";
import { ProgramCodeGate } from "@/components/program-code-gate";

export const metadata: Metadata = {
  title: "Inscription Automne–Hiver 2027 | New Valkyria",
  description:
    "Inscriptions ouvertes pour la saison Automne–Hiver 2027 : catégories U9 à U12, horaire complet et cinq programmes (NV, TV, TVA, SV, SVA) avec leurs tarifs.",
  alternates: { canonical: "/inscription" }
};

export default function InscriptionPage() {
  return (
    <>
      <InscriptionContent />
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 1.25rem 2.5rem", textAlign: "center" }}>
        <ProgramCodeGate />
      </div>
    </>
  );
}
