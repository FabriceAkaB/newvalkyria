import { AdminCoachActivites } from "@/components/admin-coach-activites";
import { requireAdmin } from "@/lib/admin-auth";
import { getActivities } from "@/lib/coaches-repo";
import { getTerrains } from "@/lib/terrains-repo";

export const metadata = { title: "Activités entraîneurs — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCoachActivitesPage() {
  await requireAdmin({ roles: ["admin"] });
  const [activities, terrains] = await Promise.all([getActivities(), getTerrains()]);
  return <AdminCoachActivites activities={activities} terrains={terrains} />;
}
