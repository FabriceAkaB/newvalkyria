import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { TaskList } from "@/components/mandalart/task-list";
import { Bar, capitalize, dayLabel, monthLabel, moneyCents, moneyDollars, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { isOpen, monthFocus, nowList } from "@/lib/mandalart-core";
import { PLAN } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { toItems } from "@/lib/mandalart-view";

export const metadata = { title: "Mandalart — Ce mois-ci", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Écran par défaut du Mandalart : « ce mois-ci, c'est quoi les trucs importants ? » */
export default async function MandalartNowPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  const focus = monthFocus(o.tasks, o.today);
  const level = o.levels.find((l) => l.id === o.currentLevel)!;
  const now = nowList(o.tasks, o.currentLevel);
  const month = PLAN.trajectory.months.find((m) => m.month === focus.month);
  const monthCents = o.figures.monthsCents[focus.month] ?? 0;
  const ytdTarget = month?.cumulTarget ?? null;
  // Cumul réel comparable au cumul visé du plan (le plan part de novembre en 2026, de janvier ensuite)
  const ytdCents = PLAN.trajectory.months
    .filter((m) => m.month.slice(0, 4) === focus.month.slice(0, 4) && m.month <= focus.month)
    .reduce((s, m) => s + (o.figures.monthsCents[m.month] ?? 0), 0);
  const ytdFloor = PLAN.trajectory.months.filter((m) => m.month.slice(0, 4) === focus.month.slice(0, 4) && m.month <= focus.month).reduce((s, m) => s + m.floor, 0);
  const nextMonth = PLAN.trajectory.months.find((m) => m.month > focus.month);

  const starsThisMonth = focus.dueThisMonth.filter((t) => t.priority === "star");
  const progThisMonth = focus.dueThisMonth.filter((t) => t.priority === "progressive");
  const pillarOfMonth = PLAN.pillars.find((p) => p.focus && /novembre 2026/.test(p.focus) && focus.month === "2026-11");
  const doneMonth = focus.doneThisMonth.length;
  const openStarsLevel = o.tasks.filter((t) => t.level === o.currentLevel && t.priority === "star" && isOpen(t)).length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          {/* Héros */}
          <header>
            <p className="mda-eyebrow">Plan 1,5 M$ en 2028 · niveau {level.id} {level.name}</p>
            <h1 className="mda-h1">{capitalize(monthLabel(focus.month))} : {focus.overdue.length + starsThisMonth.length} priorités</h1>
            <p className="mda-lead">
              {month ? `${month.kind}. ${month.how}` : "Hors de la trajectoire du plan."}
              {pillarOfMonth ? ` Chantier du mois : pilier ${pillarOfMonth.code.slice(1)}, ${pillarOfMonth.name}.` : ""}
            </p>
          </header>

          {/* Les deux barres côte à côte : ce que JP a fait, ce que ça donne */}
          <section className="mda-cols-2" aria-label="Progression">
            <div className="mda-card">
              <p className="mda-label" style={{ marginTop: 0 }}>Résultats : encaissé en {o.results.year}</p>
              <p className="mda-num-xl">{moneyCents(o.results.caYearCents)}</p>
              <p className="mda-label">sur 1 500 000 $ visés en 2028 · repère à 1 M$</p>
              <div style={{ marginTop: 16 }}>
                <Bar value={o.results.progress} marker={o.results.milestoneCents / o.results.goalCents} />
                <div className="mda-bar-legend">
                  <span>{pctLabel(o.results.progress)}</span>
                  <span>Rythme sur 12 mois : {moneyCents(o.results.ca12mCents)}</span>
                </div>
              </div>
            </div>
            <div className="mda-card">
              <p className="mda-label" style={{ marginTop: 0 }}>Exécution du plan</p>
              <p className="mda-num-xl">{pctLabel(o.execution)}</p>
              <p className="mda-label">
                {o.tasks.filter((t) => t.status === "fait").length} tâches faites sur {o.tasks.filter((t) => t.status !== "abandonne").length} · ⭐ comptent double
              </p>
              <div style={{ marginTop: 16 }}>
                <Bar value={o.execution} color="var(--adm-good)" />
                <div className="mda-bar-legend">
                  <span>{doneMonth} faite{doneMonth > 1 ? "s" : ""} ce mois-ci</span>
                  <Link href="/admin/mandalart/piliers" style={{ color: "var(--adm-text-3)" }}>Voir les 8 piliers</Link>
                </div>
              </div>
            </div>
          </section>

          {/* Repères du mois */}
          <section className="mda-cols-4" aria-label="Repères">
            <div className="mda-card">
              <p className="mda-num">{level.starsDone}/{level.stars} ⭐</p>
              <p className="mda-label">Niveau {level.id} {level.name} · {level.daysLeft} jours restants (fin le {dayLabel(level.end)})</p>
            </div>
            <div className="mda-card" style={focus.overdue.length ? { boxShadow: "inset 3px 0 0 var(--adm-bad)" } : undefined}>
              <p className="mda-num" style={{ color: focus.overdue.length ? "var(--adm-bad)" : undefined }}>{focus.overdue.length}</p>
              <p className="mda-label">Tâche{focus.overdue.length > 1 ? "s" : ""} en retard</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{moneyCents(monthCents)}</p>
              <p className="mda-label">
                Encaissé ce mois-ci · cible {moneyDollars(month?.target)} · plancher {moneyDollars(month?.floor)}
              </p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: ytdTarget && ytdCents / 100 < ytdFloor ? "var(--adm-warn)" : undefined }}>{ytdTarget ? pctLabel(ytdCents / 100 / ytdTarget) : "—"}</p>
              <p className="mda-label">
                Du cumul visé fin {monthLabel(focus.month, false)} ({moneyDollars(ytdTarget)}). On juge au cumul et au trimestre, pas au mois isolé.
              </p>
            </div>
          </section>

          {/* En retard */}
          {focus.overdue.length > 0 && (
            <section className="mda-card-flush" style={{ borderColor: "rgba(255,123,123,0.35)" }}>
              <div className="mda-card-head">
                <div>
                  <h2 className="mda-h2" style={{ color: "var(--adm-bad)" }}>En retard · {focus.overdue.length}</h2>
                  <p className="mda-sub" style={{ margin: 0 }}>Échéance passée. À faire d'abord, ou à replanifier avec une note.</p>
                </div>
              </div>
              <TaskList tasks={toItems(focus.overdue)} currentLevel={o.currentLevel} showObjective />
            </section>
          )}

          {/* Priorités du mois */}
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">⭐ Priorités de {monthLabel(focus.month, false)} · {starsThisMonth.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  Dues ce mois-ci. Touchez le rond : à faire → en cours → fait. Il reste {openStarsLevel} ⭐ pour finir le niveau {level.id}.
                </p>
              </div>
            </div>
            <TaskList tasks={toItems(starsThisMonth)} currentLevel={o.currentLevel} showObjective empty="Aucune priorité due ce mois-ci." />
          </section>

          {/* Règle d'anticipation */}
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">À préparer dès maintenant · {focus.prepare.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  ⭐ dues dans les 2 prochains mois{nextMonth ? ` (dont ${capitalize(nextMonth.kind.toLowerCase())} en ${monthLabel(nextMonth.month, false)})` : ""}. Les commencer ce mois-ci évite d'être en retard.
                </p>
              </div>
            </div>
            <TaskList tasks={toItems(focus.prepare)} currentLevel={o.currentLevel} showObjective empty="Rien à préparer d'avance." />
          </section>

          {/* Le reste du mois */}
          <details className="mda-card-flush">
            <summary style={{ cursor: "pointer", padding: "16px 20px", listStyle: "none" }}>
              <span className="mda-h2">Aussi ce mois-ci (➜ progressives) · {progThisMonth.length}</span>
              <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>Elles comptent une fois. Toucher pour afficher.</span>
            </summary>
            <div style={{ borderTop: "1px solid var(--adm-line)" }}>
              <TaskList tasks={toItems(progThisMonth)} currentLevel={o.currentLevel} showObjective empty="Aucune." />
            </div>
          </details>

          {focus.doneThisMonth.length > 0 && (
            <details className="mda-card-flush">
              <summary style={{ cursor: "pointer", padding: "16px 20px", listStyle: "none" }}>
                <span className="mda-h2" style={{ color: "var(--adm-good)" }}>✓ Faites ce mois-ci · {focus.doneThisMonth.length}</span>
                <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>Touchez le rond d'une tâche pour la remettre à faire.</span>
              </summary>
              <div style={{ borderTop: "1px solid var(--adm-line)" }}>
                <TaskList tasks={toItems(focus.doneThisMonth)} currentLevel={o.currentLevel} showObjective />
              </div>
            </details>
          )}

          {/* Après le mois : le niveau en cours */}
          {now.moreStars > 0 || now.stars.some((t) => !t.due?.startsWith(focus.month)) ? (
            <p className="mda-sub" style={{ margin: 0 }}>
              Le niveau {level.id} compte {openStarsLevel} ⭐ encore ouvertes au total. Toutes les tâches, par pilier :{" "}
              <Link href="/admin/mandalart/piliers" style={{ color: "var(--adm-accent)" }}>les 8 piliers</Link> · par niveau :{" "}
              <Link href="/admin/mandalart/niveaux" style={{ color: "var(--adm-accent)" }}>les 6 niveaux</Link>.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
