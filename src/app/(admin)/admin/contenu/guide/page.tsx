import { ShootingGuide } from "@/components/shooting-guide";
import { requireAdmin } from "@/lib/admin-auth";
import { imageConsentCount } from "@/lib/content-repo";

export const metadata = { title: "Guide de tournage, Création de contenu", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Espace Contenu › Guide de tournage (P3.2.24) : les plans en images, la liste de chaque pratique, la recette de
 *  chaque format et les règles. Le même guide est dans le portail des éducateurs (/entraineur/guide-tournage). */
export default async function GuideTournagePage() {
  await requireAdmin();
  const consent = await imageConsentCount().catch(() => null);
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1100 }}>
        <header>
          <p className="mda-eyebrow">Pour filmer comme chez nous, sans JP</p>
          <h1 className="mda-h1">Guide de tournage</h1>
          <p className="mda-lead">
            Ce que la personne caméra, puis Will, filme à chaque pratique, comment le filmer et comment le monter. Le même guide est dans le portail des éducateurs, sous
            « Guide de tournage ».
          </p>
        </header>
        <ShootingGuide consent={consent} />
      </div>
    </div>
  );
}
