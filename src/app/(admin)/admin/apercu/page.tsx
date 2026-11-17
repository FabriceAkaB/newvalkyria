import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { listFamilyAccounts } from "@/lib/portal-preview";

export const metadata = { title: "Aperçu des portails — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Toronto" }) : "jamais");

/** « De quoi a l'air le portail quand un éducateur ou une famille se connecte ? » Un bouton par personne ouvre son
 *  portail exactement comme elle le voit (aperçu de 2 h, noté au journal d'audit). */
export default async function PortalPreviewPage() {
  await requireAdmin({ roles: ["admin"] });
  const [{ data: coaches }, families] = await Promise.all([
    (getSupabaseAdminClient() as any).from("coaches").select("id, first_name, last_name, role").eq("status", "active").order("first_name"),
    listFamilyAccounts().catch(() => [])
  ]);
  const btn = { textDecoration: "none", whiteSpace: "nowrap" as const };
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Outils · portails</p>
            <h1 className="mda-h1">Voir un portail comme la personne le voit</h1>
            <p className="mda-lead">
              Le bouton ouvre le portail dans cet onglet, connecté comme cette personne pendant 2 heures (noté au journal d&apos;audit). Sers-t&apos;en pour regarder : ce que tu y fais compte comme si elle l&apos;avait fait. Pour revenir, « Déconnexion » dans le portail.
            </p>
          </header>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Portail des éducateurs</h2>
              <span className="mda-muted">www.newvalkyria.com/entraineur</span>
            </div>
            <ul className="mda-tasks">
              {((coaches ?? []) as any[]).map((c) => (
                <li key={c.id} className="mda-task" style={{ alignItems: "center" }}>
                  <div className="mda-task-body">
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</p>
                  </div>
                  <a href={`/api/admin/apercu/coach/${c.id}`} className="admin-btn-ghost" style={btn}>Voir son portail →</a>
                </li>
              ))}
            </ul>
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Espace des familles</h2>
              <span className="mda-muted">www.newvalkyria.com/compte · {families.length} famille{families.length > 1 ? "s" : ""} avec un compte</span>
            </div>
            {families.length ? (
              <ul className="mda-tasks">
                {families.map((f) => (
                  <li key={f.userId} className="mda-task" style={{ alignItems: "center" }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>{f.name}</p>
                      <div className="mda-task-meta">
                        <span>{f.children.join(", ")}</span>
                        <span>Dernière connexion : {fr(f.lastSignIn)}</span>
                      </div>
                    </div>
                    <a href={`/api/admin/apercu/famille/${f.userId}`} className="admin-btn-ghost" style={btn}>Voir son espace →</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Aucune famille n&apos;a encore créé son compte.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
