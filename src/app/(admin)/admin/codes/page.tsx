import { AccessCodeForm } from "@/components/admin-access-codes";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Codes d'accès — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Changer les codes d'accès de l'admin (JP, la gérante, la borne). Seul JP y a accès. */
export default async function AccessCodesPage() {
  await requireAdmin({ roles: ["admin"] });
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Outils · sécurité</p>
            <h1 className="mda-h1">Codes d&apos;accès</h1>
            <p className="mda-lead">Change ton code administrateur, celui de la gérante ou celui de la borne. Ton code actuel est demandé à chaque fois ; les codes sont gardés chiffrés et ne sont jamais affichés.</p>
          </header>
          <section className="mda-card-flush">
            <AccessCodeForm />
          </section>
        </div>
      </div>
    </>
  );
}
