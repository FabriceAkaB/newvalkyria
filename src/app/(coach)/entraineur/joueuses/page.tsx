import { CoachJoueuses } from "@/components/coach-joueuses";
import { requireCoach } from "@/lib/coach-auth";
import { getCoachPlayers } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";

export const metadata = { title: "Joueuses — Espace Entraîneur" };
export const dynamic = "force-dynamic";

export default async function CoachJoueusesPage() {
  const coachId = await requireCoach();
  const [coach, players] = await Promise.all([getCoach(coachId), getCoachPlayers(coachId, SEASON_DB_ID)]);

  return <CoachJoueuses coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} players={players} />;
}
