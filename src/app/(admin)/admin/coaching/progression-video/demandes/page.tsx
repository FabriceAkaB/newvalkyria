import { AdminTopbar } from "@/components/admin-topbar";
import { VideoRequestBoard } from "@/components/progress-video-requests";
import { requireAdmin } from "@/lib/admin-auth";
import { getVideoRequestScreen } from "@/lib/progress-videos-repo";

export const metadata = { title: "Demandes de vidéos du jour — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Demandes de vidéos du jour (JP, 25 nov. 2026) : à chaque pratique de filles, depuis le jeudi 26 novembre, la liste
 *  des filles attendues, le dépôt de leurs capsules (plusieurs par fille) et « Absente ce jour-là ». */
export default async function VideoRequestsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const { date } = await searchParams;
  const screen = await getVideoRequestScreen(date ?? null);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · progression en vidéo</p>
            <h1 className="mda-h1">Demandes de vidéos du jour</h1>
            <p className="mda-lead">Chaque fille attendue à la pratique, filmée le jour même : dépose ses capsules depuis le téléphone au bord du terrain ou depuis l&apos;ordinateur. Toutes ses vidéos se retrouvent dans sa fiche (clic sur son nom).</p>
          </header>
          <VideoRequestBoard endpoint="/api/admin/coaching/progression-video" basePath="/admin/coaching/progression-video/demandes" fichePath="/admin/coaching/progression-video/joueuse" today={screen.today} days={screen.days} current={screen.current} />
        </div>
      </div>
    </>
  );
}
