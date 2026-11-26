import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { PlayerVideoFicheView } from "@/components/progress-video-requests";
import { requireAdmin } from "@/lib/admin-auth";
import { getPlayerVideoFiche } from "@/lib/progress-videos-repo";

export const metadata = { title: "Vidéos de la joueuse — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Fiche vidéo d'une joueuse (JP, 25 nov. 2026) : toutes ses vidéos, peu importe la date. */
export default async function PlayerVideosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const { id } = await params;
  const fiche = await getPlayerVideoFiche(id);
  if (!fiche) notFound();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <PlayerVideoFicheView endpoint="/api/admin/coaching/progression-video" fiche={fiche} today={today} />
        </div>
      </div>
    </>
  );
}
