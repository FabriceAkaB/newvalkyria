import { AdminBoutiqueCommandes } from "@/components/admin-boutique-commandes";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrders } from "@/lib/shop-repo";

export const metadata = { title: "Commandes boutique — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminBoutiqueCommandesPage() {
  await requireAdmin();
  const orders = await getOrders();

  return <AdminBoutiqueCommandes initialOrders={orders} />;
}
