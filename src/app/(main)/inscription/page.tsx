import type { Metadata } from "next";

import { InscriptionContent } from "@/components/inscription-content";
import { getCapacityData } from "@/lib/capacity";

export const metadata: Metadata = {
  title: "Inscription | New Valkyria",
  description: "Réservez une place pour votre joueuse. Choisissez vos programmes et finalisez le paiement via Stripe."
};

export default async function InscriptionPage() {
  const capacity = await getCapacityData();
  return <InscriptionContent capacityByCategory={capacity.byCategory} maxPerCategory={capacity.maxPerCategory} />;
}
