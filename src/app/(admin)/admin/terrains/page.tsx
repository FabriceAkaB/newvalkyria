import { AdminTerrains } from "@/components/admin-terrains";
import { requireAdmin } from "@/lib/admin-auth";
import { getTerrains } from "@/lib/terrains-repo";

export const metadata = { title: "Terrains — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminTerrainsPage() {
  await requireAdmin();
  const terrains = await getTerrains();

  return <AdminTerrains initialTerrains={terrains} />;
}
