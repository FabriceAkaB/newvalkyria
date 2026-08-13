import { notFound } from "next/navigation";

import { AdminCoachActiviteDetail } from "@/components/admin-coach-activite-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { getActivity, getActivityAssignments, getAllCoachTypeRates, getCoaches } from "@/lib/coaches-repo";
import { getExercises } from "@/lib/exercises-repo";
import { getBlocksForActivity } from "@/lib/session-plan-repo";

export const metadata = { title: "Activité — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCoachActiviteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { id } = await params;

  const activity = await getActivity(id);
  if (!activity) notFound();

  const [assignments, coaches, typeRates, blocks, exercises] = await Promise.all([
    getActivityAssignments(id),
    getCoaches(),
    getAllCoachTypeRates(),
    getBlocksForActivity(id),
    getExercises()
  ]);

  return (
    <AdminCoachActiviteDetail
      activity={activity}
      initialAssignments={assignments}
      coaches={coaches}
      typeRates={typeRates}
      initialBlocks={blocks}
      exercises={exercises}
    />
  );
}
