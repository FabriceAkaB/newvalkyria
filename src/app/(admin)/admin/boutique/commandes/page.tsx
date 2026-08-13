import { AdminBoutiqueCommandes } from "@/components/admin-boutique-commandes";
import { requireAdmin } from "@/lib/admin-auth";
import { getOrders, maskOrderAmountsForGerante } from "@/lib/shop-repo";

export const metadata = { title: "Commandes boutique — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminBoutiqueCommandesPage() {
  const role = await requireAdmin();
  const orders = await getOrders();

  return <AdminBoutiqueCommandes initialOrders={role === "gerante" ? maskOrderAmountsForGerante(orders) : orders} showPrices={role === "admin"} />;
}
