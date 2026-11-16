import { moneyCents } from "@/components/mandalart/ui";
import { MandalartTree, type TreePillar } from "@/components/mandalart/tree";
import { requireAdmin } from "@/lib/admin-auth";
import { getMandalartOverview } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — L'arbre", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Où je suis rendu ? » d'un coup d'œil : la guerrière plante son épée, l'arbre du plan pousse à mesure que les
 *  tâches se font. Une branche par pilier, une feuille par objectif, le détail au clic. */
export default async function MandalartTreePage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  const pillars: TreePillar[] = o.pillars.map((p) => ({
    code: p.code,
    name: p.name,
    progress: p.progress,
    overdue: p.overdue,
    starsOpen: p.starsOpen,
    objectives: p.objectives.map((ob) => ({
      code: ob.code,
      name: ob.name,
      progress: ob.progress,
      medal: ob.medal,
      total: ob.total,
      done: ob.done,
      overdue: ob.overdue,
      tasks: o.tasks
        .filter((t) => t.objective === ob.code && t.status !== "abandonne")
        .sort((a, b) => Number(a.status === "fait") - Number(b.status === "fait") || (a.due ?? "9").localeCompare(b.due ?? "9"))
        .map((t) => ({ code: t.code, title: t.title, status: t.status, due: t.due, overdue: t.overdue, star: t.priority === "star" }))
    }))
  }));

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1240 }}>
        <header>
          <p className="mda-eyebrow">Le plan 1,5 M$ en un coup d&apos;œil</p>
          <h1 className="mda-h1">L&apos;arbre</h1>
          <p className="mda-lead">La guerrière a planté son épée : l&apos;arbre pousse à chaque tâche faite. Une branche par pilier, une feuille par objectif ; une feuille devient dorée quand l&apos;objectif est réussi.</p>
        </header>
        <MandalartTree
          pillars={pillars}
          execution={o.execution}
          results={{ progress: o.results.progress, label: `${moneyCents(o.results.caYearCents)} encaissés en ${o.results.year}` }}
        />
      </div>
    </div>
  );
}
