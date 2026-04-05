import { AdminEssais } from "@/components/admin-essais";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Essais — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEssaisPage() {
  await requireAdmin();
  return <AdminEssais />;
}
