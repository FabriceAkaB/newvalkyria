import { AdminSlideImport } from "@/components/admin-slide-import";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { bibleKey } from "@/lib/exercise-bank";
import { canReadWithClaude } from "@/lib/exercise-slide-reader";

export const metadata = { title: "Ajouter des diapos — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** JP dépose la diapo d'un exercice (image ou PDF) : l'exercice est créé, lu et rangé dans son chapitre. */
export default async function AdminExerciseSlidesPage({ searchParams }: { searchParams: Promise<{ bible?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  // `?bible=psychomotricite` : les diapos déposées sont rangées dans cette Bible (bouton « Ajouter un exercice » d'une Bible).
  const bible = bibleKey((await searchParams).bible);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 980 }}>
          <AdminSlideImport ai={canReadWithClaude()} bible={bible} />
        </div>
      </div>
    </>
  );
}
