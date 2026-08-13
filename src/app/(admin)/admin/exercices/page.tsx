import { AdminExercices } from "@/components/admin-exercices";
import { requireAdmin } from "@/lib/admin-auth";
import { getExercises } from "@/lib/exercises-repo";

export const metadata = { title: "Exercices — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminExercicesPage() {
  await requireAdmin({ roles: ["admin"] });
  const exercises = await getExercises();
  return <AdminExercices initialExercises={exercises} canEdit />;
}
