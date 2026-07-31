import { AdminBoutiqueProduits } from "@/components/admin-boutique-produits";
import { requireAdmin } from "@/lib/admin-auth";
import { getProducts } from "@/lib/shop-repo";

export const metadata = { title: "Boutique — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminBoutiquePage() {
  await requireAdmin();
  const products = await getProducts(true);

  return <AdminBoutiqueProduits initialProducts={products} />;
}
