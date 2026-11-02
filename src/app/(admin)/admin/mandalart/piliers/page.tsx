import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Bar, MedalCounts, moneyCents, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { modulesForPillar } from "@/lib/mandalart-modules";
import { PLAN } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — Les 8 piliers", robots: "noindex" };
export const dynamic = "force-dynamic";

/** La grille 3 × 3 : la case centrale (1,5 M$ en 2028) entourée des 8 piliers. */
export default async function MandalartPillarsPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  const cells = [...o.pillars];
  const before = cells.slice(0, 4);
  const after = cells.slice(4);

  const PillarCell = ({ p }: { p: (typeof o.pillars)[number] }) => {
    const mods = modulesForPillar(p.code);
    return (
      <Link href={`/admin/mandalart/piliers/${p.code.toLowerCase()}`} className="mda-cell">
        <span className="mda-cell-code">Pilier {p.code.slice(1)}</span>
        <span className="mda-cell-title">{p.name}</span>
        <div className="mda-cell-foot">
          <Bar value={p.progress} thin />
          <div className="mda-cell-meta">
            <span>{pctLabel(p.progress)}</span>
            <MedalCounts medals={p.medals} />
          </div>
          <div className="mda-cell-meta">
            <span>{p.starsOpen} ⭐ ouvertes{p.overdue ? <span style={{ color: "var(--adm-bad)" }}> · {p.overdue} en retard</span> : null}</span>
            <span className="mda-muted">{mods.filter((m) => m.status === "actif").length}/{mods.length} sections en place</span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">8 piliers × 8 objectifs</p>
            <h1 className="mda-h1">Le Mandalart</h1>
            <p className="mda-lead">Touchez un pilier pour voir ses 8 objectifs, ses tâches et ses sections dans l'admin. Médailles : bronze à 25 % d'un objectif, argent à 50 %, or à 100 %, mauve quand ses indicateurs atteignent leur cible.</p>
          </header>
          <section className="mda-grid9" aria-label="Grille des piliers">
            {before.map((p) => (
              <PillarCell key={p.code} p={p} />
            ))}
            <div className="mda-cell mda-cell-center">
              <span className="mda-cell-code">Case centrale</span>
              <span className="mda-num" style={{ fontSize: "1.5rem" }}>1 500 000 $</span>
              <span className="mda-cell-title" style={{ fontWeight: 500, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
                encaissés du 1er janvier au 31 décembre {PLAN.center.year}, et au moins 400 000 $ par année pour JP
              </span>
              <div style={{ marginTop: 8 }}>
                <Bar value={o.results.progress} marker={o.results.milestoneCents / o.results.goalCents} thin />
                <p className="mda-label" style={{ marginTop: 8 }}>
                  {moneyCents(o.results.caYearCents)} en {o.results.year} · exécution {pctLabel(o.execution)}
                </p>
              </div>
            </div>
            {after.map((p) => (
              <PillarCell key={p.code} p={p} />
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
