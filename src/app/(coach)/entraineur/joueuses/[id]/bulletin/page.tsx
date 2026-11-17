import Link from "next/link";
import { notFound } from "next/navigation";

import { BulletinReport } from "@/components/bulletin-report";
import { getBulletinReport } from "@/lib/bulletin-repo";
import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { coachCanSeePlayer } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";

export const metadata = { title: "Bulletin — Espace Technique" };
export const dynamic = "force-dynamic";

export default async function CoachBulletinPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bulletin?: string }> }) {
  const sp = await searchParams;
  const period = sp.bulletin === "mi-saison" || sp.bulletin === "fin-saison" ? sp.bulletin : null;
  const coachId = await requireCoach();
  const { id } = await params;
  if (!(await coachCanSeePlayer(coachId, id))) notFound();

  const [coach, data] = await Promise.all([getCoach(coachId), getBulletinReport(id, { period, audience: "equipe" })]);
  if (!data) notFound();

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section">
          <Link href={`/entraineur/joueuses/${id}`} className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Fiche joueuse
          </Link>
          <BulletinReport data={data} periodHref={(p) => `/entraineur/joueuses/${id}/bulletin?bulletin=${p}`} />
        </div>
      </div>
    </>
  );
}
