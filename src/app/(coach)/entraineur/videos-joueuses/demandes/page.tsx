import { VideoRequestBoard } from "@/components/progress-video-requests";
import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { getVideoRequestScreen } from "@/lib/progress-videos-repo";

export const metadata = { title: "Demandes de vidéos du jour — Espace Technique" };
export const dynamic = "force-dynamic";

/** Le vidéaste au bord du terrain (JP, 25 nov. 2026) : les filles attendues à chaque pratique, avec leur photo, le
 *  dépôt de leurs capsules et « Absente ce jour-là ». */
export default async function CoachVideoRequestsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const coachId = await requireCoach();
  const coach = await getCoach(coachId);
  const allowed = Boolean(coach?.is_videographer);
  const { date } = await searchParams;
  const screen = allowed ? await getVideoRequestScreen(date ?? null) : null;
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page coach-page--wide">
          <p className="coach-eyebrow"><a href="/entraineur/videos-joueuses">Vidéos des joueuses</a> · demandes du jour</p>
          {!screen ? (
            <>
              <h1 className="coach-title coach-title--xl">Réservé au vidéaste</h1>
              <p className="coach-sub">Cette page sert à déposer les vidéos de progression des joueuses. Demande à JP si tu dois y avoir accès.</p>
            </>
          ) : (
            <>
              <h1 className="coach-title coach-title--xl">Demandes de vidéos du jour</h1>
              <p className="coach-sub">Filme chaque fille (toujours le même exercice, même angle) et dépose ses capsules ici, le jour même. La photo t&apos;aide à la reconnaître. Une fille pas là : « Absente ce jour-là ».</p>
              <div style={{ marginTop: 16 }}>
                <VideoRequestBoard endpoint="/api/coach/progression-video" basePath="/entraineur/videos-joueuses/demandes" fichePath="/entraineur/videos-joueuses/joueuse" today={screen.today} days={screen.days} current={screen.current} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
