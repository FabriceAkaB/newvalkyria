import { AdminEvaluationsEvents } from "@/components/admin-evaluations-events";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllEvents, getParticipantCounts } from "@/lib/tryout-repo";

export const metadata = { title: "Évaluations — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEvaluationsPage() {
  await requireAdmin();
  const [events, counts] = await Promise.all([getAllEvents(), getParticipantCounts()]);
  return <AdminEvaluationsEvents initialEvents={events} participantCounts={counts} />;
}
