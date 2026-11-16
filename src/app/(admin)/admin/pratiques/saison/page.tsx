import { AdminTopbar } from "@/components/admin-topbar";
import { PracticeSeason } from "@/components/practice-season";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasonPractices } from "@/lib/practice-history-repo";
import { VENUES } from "@/lib/practice-venue";

export const metadata = { title: "Pratiques de la saison — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Combien de pratiques je dois monter cet hiver, pour quel espace ? » Puis les déposer d'avance et les voir. */
export default async function SeasonPracticesPage() {
  await requireAdmin();
  const rows = await getSeasonPractices();
  const done = rows.filter((r) => r.docs.length).length;
  const distinct = new Set(rows.flatMap((r) => r.docs.map((d) => d.fileName))).size;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">D'aujourd'hui au 18 avril 2027 · pas de pratique du 20 décembre au 2 janvier</p>
            <h1 className="mda-h1">
              {rows.length - done} pratique{rows.length - done > 1 ? "s" : ""} à monter sur {rows.length}
            </h1>
            <p className="mda-lead">
              Lundi et mercredi : gymnase double. Jeudi : deux tiers du gymnase. Pratiques d&apos;équipe : synthétique, terrain à 7. Les groupes au même gymnase à la même heure font une seule pratique. Déposez les diapos en PDF (claude.ai → Télécharger → PDF) : l&apos;éducateur assigné les voit dans son portail, à l&apos;étape « Avant ».
            </p>
          </header>

          <section className="mda-cols-4">
            {VENUES.filter((v) => rows.some((r) => r.venue === v.id)).map((v) => {
              const list = rows.filter((r) => r.venue === v.id);
              const ok = list.filter((r) => r.docs.length).length;
              return (
                <div key={v.id} className="mda-card">
                  <p className="mda-num">{list.length - ok}</p>
                  <p className="mda-label">
                    {v.icon} {v.label} à monter · {ok}/{list.length} déposées
                  </p>
                </div>
              );
            })}
            <div className="mda-card">
              <p className="mda-num" style={{ color: "var(--adm-good)" }}>{done}</p>
              <p className="mda-label">Déposées · {distinct} pratique{distinct > 1 ? "s" : ""} différente{distinct > 1 ? "s" : ""}</p>
            </div>
          </section>

          <PracticeSeason rows={rows} />
        </div>
      </div>
    </>
  );
}
