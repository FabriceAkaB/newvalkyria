import { AdminIdeas } from "@/components/idea-box";
import { requireAdmin } from "@/lib/admin-auth";
import { listIdeas } from "@/lib/idea-box-repo";

export const metadata = { title: "Boîte à idées — Voix des familles", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Voix des familles › Boîte à idées : les idées du site et des espaces parents, à lire, répondre et faire avancer. */
export default async function AdminIdeesPage() {
  await requireAdmin();
  const ideas = await listIdeas();
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 900 }}>
        <header>
          <p className="mda-eyebrow">Ce que les familles proposent</p>
          <h1 className="mda-h1">Boîte à idées</h1>
          <p className="mda-lead">
            Chaque idée reçoit une réponse. Nouvelle → à l&apos;étude → retenue → réalisée. Une idée réalisée peut être montrée sur la page publique (« Grâce à vous ») : les familles voient qu&apos;on les écoute.
            Lien public : www.newvalkyria.com/boite-a-idees. Aucun courriel à chaque idée : elles arrivent ici et dans « Aujourd'hui », et un résumé part le lundi s'il y en a eu dans la semaine.
          </p>
        </header>
        <AdminIdeas ideas={ideas} />
      </div>
    </div>
  );
}
