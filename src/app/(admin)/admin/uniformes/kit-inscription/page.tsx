import { AdminUniformesKitInscription } from "@/components/admin-uniformes-kit-inscription";
import { requireAdmin } from "@/lib/admin-auth";
import { getActiveSeasonId } from "@/lib/season-admin-repo";
import { getBaseUniformList } from "@/lib/uniform-kits-repo";

export const metadata = { title: "Kit d'inscription — Uniformes — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesKitInscriptionPage() {
  await requireAdmin();
  const [rows, activeSeasonId] = await Promise.all([getBaseUniformList(), getActiveSeasonId()]);
  return <AdminUniformesKitInscription initialRows={rows} initialSeasonFilter={activeSeasonId ?? ""} />;
}
