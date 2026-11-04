import { MandalartBoard } from "@/components/mandalart/board";
import { moneyCents, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { PLAN } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — Les 8 piliers", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Le Mandalart complet en 9 × 9 : la case centrale (1,5 M$ en 2028) entourée des 8 piliers, et chaque pilier au centre
 *  de ses 8 objectifs, chacun rempli de la couleur de son pilier selon son avancement. */
export default async function MandalartPillarsPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1240 }}>
        <header>
          <p className="mda-eyebrow">8 piliers × 8 objectifs · la vue d&apos;ensemble</p>
          <h1 className="mda-h1">Le Mandalart</h1>
          <p className="mda-lead">Au centre, le but ; autour, les 8 piliers ; chaque pilier est entouré de ses 8 objectifs. Touche une case pour ouvrir le pilier, ses tâches et ses sections.</p>
        </header>
        <MandalartBoard
          pillars={o.pillars}
          center={
            <>
              <span className="mdb-center-eyebrow">Case centrale</span>
              <span className="mdb-center-goal">1,5 M$</span>
              <span className="mdb-center-sub">encaissés en {PLAN.center.year}</span>
              <span className="mdb-center-bar">
                <span style={{ width: `${Math.min(100, Math.round(o.results.progress * 100))}%` }} />
              </span>
              <span className="mdb-center-sub">
                {moneyCents(o.results.caYearCents)} en {o.results.year} · exécution {pctLabel(o.execution)}
              </span>
            </>
          }
        />
        <p className="mdb-legend">
          Chaque pilier a sa couleur ; un objectif se remplit de cette couleur à mesure que ses tâches sont faites. 🥉 25 % · 🥈 50 % · 🥇 100 % · 💜 indicateurs atteints · ⭐ tâches prioritaires ouvertes · <span className="mdb-late">n</span> en retard.
        </p>
      </div>
    </div>
  );
}
