import { AdminTopbar } from "@/components/admin-topbar";
import { ExerciseBible } from "@/components/exercise-bible";
import { requireAdmin } from "@/lib/admin-auth";
import { bookExercises } from "@/lib/exercise-book-core";
import { getBank } from "@/lib/exercises-repo";

export const metadata = { title: "La Bible New Valkyria — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Ce que voient les éducateurs dans leur portail (La Bible, le descriptif, les meilleurs), avec « Modifier » sur chaque page. */
export default async function AdminExerciseBiblePage() {
  await requireAdmin({ roles: ["admin"] });
  const { entries } = await getBank();
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 1280 }}>
          <ExerciseBible exercises={bookExercises(entries)} ficheBase="/admin/exercices" />
        </div>
      </div>
    </>
  );
}
