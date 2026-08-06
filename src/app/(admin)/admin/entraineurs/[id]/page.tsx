import { notFound } from "next/navigation";

import { AdminEntraineurDetail } from "@/components/admin-entraineur-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { getCoach, getCoachAssignments, getCoachTypeRates } from "@/lib/coaches-repo";

export const metadata = { title: "Entraîneur — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEntraineurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const coach = await getCoach(id);
  if (!coach) notFound();

  const [assignments, typeRates] = await Promise.all([getCoachAssignments(id), getCoachTypeRates(id)]);

  return <AdminEntraineurDetail coach={coach} initialAssignments={assignments} initialTypeRates={typeRates} />;
}
