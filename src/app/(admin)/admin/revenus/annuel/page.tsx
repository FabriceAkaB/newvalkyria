import { AdminRevenusAnnuel } from "@/components/admin-revenus-annuel";
import { requireAdmin } from "@/lib/admin-auth";
import { getAnnualBreakdown } from "@/lib/revenue-calc";

export const metadata = { title: "Vue annuelle — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminRevenusAnnuelPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { annee } = await searchParams;
  const year = annee ? parseInt(annee, 10) : new Date().getFullYear();
  const breakdown = await getAnnualBreakdown(year);
  return <AdminRevenusAnnuel breakdown={breakdown} />;
}
