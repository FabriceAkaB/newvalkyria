import { AdminCoachActivites } from "@/components/admin-coach-activites";
import { requireAdmin } from "@/lib/admin-auth";
import { getActivities } from "@/lib/coaches-repo";

export const metadata = { title: "Activités entraîneurs — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCoachActivitesPage() {
  await requireAdmin();
  const activities = await getActivities();
  return <AdminCoachActivites activities={activities} />;
}
