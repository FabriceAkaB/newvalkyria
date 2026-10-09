import { AdminCommandites } from "@/components/admin-commandites";
import { requireAdmin } from "@/lib/admin-auth";
import { getSponsorPayments, getSponsors } from "@/lib/sponsors-repo";

export const metadata = { title: "Commandites — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCommanditesPage() {
  await requireAdmin();
  const [sponsors, payments] = await Promise.all([getSponsors(), getSponsorPayments()]);
  return <AdminCommandites initial={{ sponsors, payments }} />;
}
