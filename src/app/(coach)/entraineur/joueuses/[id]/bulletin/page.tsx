import Link from "next/link";
import { notFound } from "next/navigation";

import { BulletinView } from "@/components/bulletin-view";
import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { getBulletinData } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";

export const metadata = { title: "Bulletin — Espace Entraîneur" };
export const dynamic = "force-dynamic";

export default async function CoachBulletinPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;

  const [coach, data] = await Promise.all([getCoach(coachId), getBulletinData(id)]);
  if (!data) notFound();

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section">
          <Link href={`/entraineur/joueuses/${id}`} className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Fiche joueuse
          </Link>
          <BulletinView data={data} />
        </div>
      </div>
    </>
  );
}
