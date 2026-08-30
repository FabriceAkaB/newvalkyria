import { notFound } from "next/navigation";

import { AdminEvaluationEventDetail } from "@/components/admin-evaluation-event-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasonPrograms } from "@/lib/season-admin-repo";
import { getEventById, getEvaluatorsForEvent, getParticipantsForEvent, getTeamsForEvent } from "@/lib/tryout-repo";

export const metadata = { title: "Événement d'évaluation — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEvaluationEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();

  const [participants, teams, evaluators, programs] = await Promise.all([
    getParticipantsForEvent(id),
    getTeamsForEvent(id),
    getEvaluatorsForEvent(id),
    getSeasonPrograms("automne-hiver-2026")
  ]);

  return (
    <AdminEvaluationEventDetail
      event={event}
      initialParticipants={participants}
      teams={teams}
      initialEvaluators={evaluators}
      programs={programs.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
