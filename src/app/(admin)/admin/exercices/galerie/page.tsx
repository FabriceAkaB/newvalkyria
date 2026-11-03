import { AdminTopbar } from "@/components/admin-topbar";
import { ExerciseGallery } from "@/components/exercise-gallery";
import { requireAdmin } from "@/lib/admin-auth";
import { gallerySlides } from "@/lib/exercise-gallery";
import { getBank } from "@/lib/exercises-repo";

export const metadata = { title: "Galerie des exercices — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Les exercices approuvés en diapos : on les balaie sans ouvrir de fichier. */
export default async function ExerciseGalleryPage({ searchParams }: { searchParams: Promise<{ tous?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const all = (await searchParams).tous === "1";
  const { entries } = await getBank();
  const slides = gallerySlides(entries, { all });
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 1100 }}>
          <header>
            <p className="mda-eyebrow">Banque d&apos;exercices Valkyria · en diapos</p>
            <h1 className="mda-h1">{all ? `${slides.length} exercice${slides.length > 1 ? "s" : ""}` : `${slides.length} exercice${slides.length > 1 ? "s" : ""} approuvé${slides.length > 1 ? "s" : ""}`}</h1>
            <p className="mda-lead">Balaie de gauche à droite pour passer d&apos;un exercice à l&apos;autre. La diapo est l&apos;image ajoutée à la fiche (une diapo exportée en PNG ou JPG) ; sans image, c&apos;est le schéma de la fiche.</p>
          </header>
          <ExerciseGallery slides={slides} ficheBase="/admin/exercices" showingAll={all} allHref="/admin/exercices/galerie?tous=1" approvedHref="/admin/exercices/galerie" />
        </div>
      </div>
    </>
  );
}
