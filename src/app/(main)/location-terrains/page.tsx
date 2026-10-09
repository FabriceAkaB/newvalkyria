import type { Metadata } from "next";

import { TerrainRentalContent } from "@/components/terrain-rental-content";
import { getRentableTerrains } from "@/lib/terrain-rentals-repo";

export const metadata: Metadata = {
  title: "Location de terrains | New Valkyria",
  description: "Réservez en ligne une plage horaire de terrain pour votre match ou votre entraînement.",
  alternates: { canonical: "/location-terrains" }
};
export const dynamic = "force-dynamic";

export default async function LocationTerrainsPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  const terrains = await getRentableTerrains();
  return (
    <TerrainRentalContent
      terrains={terrains.map((t) => ({ id: t.id, name: t.name, address: t.address, rental_description: t.rental_description }))}
      cancelled={cancelled === "1"}
    />
  );
}
