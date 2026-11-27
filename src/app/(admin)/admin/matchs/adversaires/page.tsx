import { AdminOpponents } from "@/components/admin-opponents";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getOpponents } from "@/lib/match-opponents-repo";

export const metadata = { title: "Adversaires — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Contre qui on joue, quelles catégories ils ont, combien d'équipes, et qui est archivé ? » (JP, 27 nov. 2026) */
export default async function OpponentsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const { vue } = await searchParams;
  const opponents = await getOpponents();
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <AdminOpponents opponents={opponents} archives={vue === "archives"} />
      </div>
    </>
  );
}
