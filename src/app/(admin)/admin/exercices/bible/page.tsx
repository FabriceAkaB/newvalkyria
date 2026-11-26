import { AdminTopbar } from "@/components/admin-topbar";
import { ExerciseBible } from "@/components/exercise-bible";
import { requireAdmin } from "@/lib/admin-auth";
import { getGestures } from "@/lib/coaching-method-repo";
import { bibleExercises } from "@/lib/exercise-book-core";
import { BIBLES, bibleInfo, bibleKey } from "@/lib/exercise-bank";
import { getBank } from "@/lib/exercises-repo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ bible?: string }> }) {
  return { title: `${bibleInfo((await searchParams).bible).title} — Admin New Valkyria`, robots: "noindex" };
}
export const dynamic = "force-dynamic";

/** Ce que voient les éducateurs dans leur portail (les 3 Bibles, le descriptif, les meilleurs), avec ajout, marquage et
 *  suppression pour JP. `?bible=psychomotricite` ou `?bible=ball-mastery` ouvre une autre Bible. */
export default async function AdminExerciseBiblePage({ searchParams }: { searchParams: Promise<{ bible?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const bible = bibleKey((await searchParams).bible);
  const [{ entries }, gestures] = await Promise.all([getBank(), getGestures({ activeOnly: true }).catch(() => [])]);
  const counts = Object.fromEntries(BIBLES.map((b) => [b.key, bibleExercises(entries, b.key, gestures).length]));
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 1280 }}>
          <ExerciseBible key={bible} exercises={bibleExercises(entries, bible, gestures)} ficheBase="/admin/exercices" bible={bible} counts={counts} basePath="/admin/exercices/bible" />
        </div>
      </div>
    </>
  );
}
