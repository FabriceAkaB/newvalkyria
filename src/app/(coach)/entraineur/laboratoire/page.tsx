import { CoachLab } from "@/components/coach-lab";
import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";

export const metadata = { title: "Laboratoire — Espace Technique" };
export const dynamic = "force-dynamic";

/** Portail : le laboratoire des éducateurs (tester un concept à une pratique, garder ce qui marche). */
export default async function CoachLabPage() {
  const coachId = await requireCoach();
  const coach = await getCoach(coachId);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <CoachLab />
      </div>
    </>
  );
}
