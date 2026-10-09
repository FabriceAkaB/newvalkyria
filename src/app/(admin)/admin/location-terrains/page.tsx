import { AdminLocationTerrains } from "@/components/admin-location-terrains";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { getAllTerrainsForRental, getBlocks, getRentals, getWindows } from "@/lib/terrain-rentals-repo";

export const metadata = { title: "Location de terrains — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminLocationTerrainsPage() {
  await requireAdmin();
  const [terrains, windows, blocks, rentals] = await Promise.all([getAllTerrainsForRental(), getWindows(), getBlocks(), getRentals()]);
  return <AdminLocationTerrains initial={{ terrains, windows, blocks, rentals }} origin={env.siteUrl} />;
}
