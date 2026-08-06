import { notFound } from "next/navigation";

import { AdminCoachActiviteDetail } from "@/components/admin-coach-activite-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { getActivity, getActivityAssignments, getAllCoachTypeRates, getCoaches } from "@/lib/coaches-repo";

export const metadata = { title: "Activité — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCoachActiviteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const activity = await getActivity(id);
  if (!activity) notFound();

  const [assignments, coaches, typeRates] = await Promise.all([
    getActivityAssignments(id),
    getCoaches(),
    getAllCoachTypeRates()
  ]);

  return <AdminCoachActiviteDetail activity={activity} initialAssignments={assignments} coaches={coaches} typeRates={typeRates} />;
}
