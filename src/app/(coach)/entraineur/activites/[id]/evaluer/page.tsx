import { notFound } from "next/navigation";

import { CoachTopbar } from "@/components/coach-topbar";
import { MatchEvaluationSheet, type SheetPlayer } from "@/components/match-evaluation-sheet";
import { requireCoach } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { cleanCriteria } from "@/lib/match-evaluation";
import { getConvocations, getLineup, getMatchDetails, getMatchEvaluations, getMatchRoster, getRosterPlayersByIds } from "@/lib/match-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";

export const metadata = { title: "Évaluer le match — Espace Technique" };
export const dynamic = "force-dynamic";

/** « Évaluer le match » (JP, 22 nov. 2026) : fiche en 10 points par joueuse présente, avec sa photo et son poste ;
 *  une fois la page ouverte, elle se remplit même sans réseau (envoi dès que le réseau revient). */
export default async function EvaluerMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;
  const entry = await getCoachActivityById(coachId, id);
  if (!entry || (entry.activity.activity_type !== "Match" && entry.activity.activity_type !== "Tournoi")) notFound();
  const a = entry.activity;
  const date = String(a.activity_date).slice(0, 10);

  const [coach, roster, convocations, lineup, evaluations, details] = await Promise.all([
    getCoach(coachId),
    getMatchRoster(SEASON_DB_ID, a.category, date),
    getConvocations(id),
    getLineup(id),
    getMatchEvaluations(id),
    getMatchDetails(id).catch(() => null)
  ]);

  // Une joueuse convoquée ou évaluée hors de l'effectif de l'équipe (remplaçante d'un autre groupe) apparaît aussi.
  const known = new Set(roster.map((r) => r.registrationId));
  const extraIds = [...new Set([...convocations.map((c) => c.registration_id), ...lineup.map((l) => l.registration_id), ...evaluations.map((e) => e.registration_id)])].filter((x) => !known.has(x));
  const extras = await getRosterPlayersByIds(extraIds).catch(() => []);
  const players: SheetPlayer[] = [...roster, ...extras]
    .map((r) => {
      const mine = evaluations.find((e) => e.registration_id === r.registrationId && e.coach_id === coachId) ?? null;
      const slot = lineup.find((l) => l.registration_id === r.registrationId) ?? null;
      // Le poste : celui de l'alignement, sinon le dernier noté par un éducateur pour ce match.
      const lastPos = evaluations.find((e) => e.registration_id === r.registrationId && e.position_code)?.position_code ?? null;
      return {
        registrationId: r.registrationId,
        firstName: r.firstName,
        lastName: r.lastName,
        photoUrl: r.photoUrl,
        convocation: convocations.find((c) => c.registration_id === r.registrationId)?.status ?? null,
        lineupPosition: slot?.position_code ?? lastPos,
        inLineup: !!slot,
        saved: mine
          ? { positionCode: mine.position_code, criteria: cleanCriteria(mine.criteria), strengths: mine.strengths ?? "", toImprove: mine.to_improve ?? "", comment: mine.comment ?? "" }
          : null
      };
    })
    .sort((x, y) => `${x.firstName} ${x.lastName}`.localeCompare(`${y.firstName} ${y.lastName}`, "fr"));

  const when = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const opponent = details?.opponent_name ? ` · contre ${details.opponent_name}` : "";
  const score = details && details.final_score_us !== null && details.final_score_them !== null ? ` · ${details.final_score_us} à ${details.final_score_them}` : "";

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page">
          <MatchEvaluationSheet activityId={id} title={`${a.title || a.category || "Match"}${opponent}${score}`} subtitle={`${when} · ${String(a.start_time).slice(0, 5).replace(":", " h ")}`} players={players} />
        </div>
      </div>
    </>
  );
}
