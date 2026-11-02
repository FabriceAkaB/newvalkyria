import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { BulletinView } from "@/components/bulletin-view";
import { requireAdmin } from "@/lib/admin-auth";
import { getBulletinData } from "@/lib/coach-portal-repo";

export const metadata = { title: "Saison d'une joueuse — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** La saison d'une joueuse vue par l'équipe : présences, moyennes, évolution, sa note des pratiques et les notes
 *  internes des éducateurs (la version parent, dans l'espace famille, ne montre pas ces notes). */
export default async function PlayerSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getBulletinData(id, "equipe");
  if (!data) notFound();

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <Link href="/admin/coaching/joueuses" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Progression des joueuses
          </Link>
          <BulletinView data={data} />
        </div>
      </div>
    </>
  );
}
