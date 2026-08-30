import { notFound } from "next/navigation";

import { AdminEvaluationTerrain } from "@/components/admin-evaluation-terrain";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getCriteriaConfigForEvent,
  getEvaluatorsForEvent,
  getEvaluationsForEvent,
  getEventById,
  getParticipantsForEvent,
  getQuickComments,
  getTeamsForEvent
} from "@/lib/tryout-repo";

export const metadata = { title: "Terrain — Évaluation — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEvaluationTerrainPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const event = await getEventById(id);
  if (!event) notFound();

  const [participants, teams, evaluators, config, evaluations, quickComments] = await Promise.all([
    getParticipantsForEvent(id),
    getTeamsForEvent(id),
    getEvaluatorsForEvent(id),
    getCriteriaConfigForEvent(id),
    getEvaluationsForEvent(id),
    getQuickComments()
  ]);

  return (
    <AdminEvaluationTerrain
      event={event}
      participants={participants}
      teams={teams}
      evaluators={evaluators}
      config={config}
      initialEvaluations={evaluations}
      quickComments={quickComments}
    />
  );
}
