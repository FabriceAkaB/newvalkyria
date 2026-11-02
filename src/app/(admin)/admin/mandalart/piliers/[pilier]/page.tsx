import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { AddTaskForm } from "@/components/mandalart/forms";
import { TaskList } from "@/components/mandalart/task-list";
import { Bar, MedalCounts, MedalDot, Pill, STATUS_TONE, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { formatKpi } from "@/lib/mandalart-kpis";
import { MODULE_STATUS_LABEL, moduleHref, modulesForPillar } from "@/lib/mandalart-modules";
import { pillarBySlug } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { toItems } from "@/lib/mandalart-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pilier: string }> }) {
  const p = pillarBySlug((await params).pilier);
  return { title: p ? `Mandalart — ${p.name}` : "Mandalart", robots: "noindex" };
}

/** Un pilier : ses sections dans l'admin, sa grille 3 × 3 d'objectifs, puis les tâches de chaque objectif. */
export default async function MandalartPillarPage({ params }: { params: Promise<{ pilier: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const plan = pillarBySlug((await params).pilier);
  if (!plan) notFound();
  const o = await getMandalartOverview();
  const p = o.pillars.find((x) => x.code === plan.code)!;
  const mods = modulesForPillar(plan.code);
  const objs = p.objectives;

  const ObjCell = ({ ob }: { ob: (typeof objs)[number] }) => (
    <a href={`#${ob.code}`} className="mda-cell" style={{ minHeight: 120 }}>
      <span className="mda-cell-code">{ob.code}</span>
      <span className="mda-cell-title" style={{ fontSize: "0.92rem" }}>{ob.name}</span>
      <div className="mda-cell-foot">
        <Bar value={ob.progress} thin />
        <div className="mda-cell-meta">
          <span>
            {pctLabel(ob.progress)} · {ob.done}/{ob.total}
          </span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {ob.overdue ? <span style={{ color: "var(--adm-bad)" }}>{ob.overdue} en retard</span> : null}
            <MedalDot medal={ob.medal} />
          </span>
        </div>
      </div>
    </a>
  );

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              <Link href="/admin/mandalart/piliers" style={{ color: "var(--adm-text-3)" }}>Les 8 piliers</Link> · Pilier {plan.code.slice(1)}
            </p>
            <h1 className="mda-h1">{plan.name}</h1>
            <p className="mda-lead">{plan.intro}</p>
            {plan.focus ? <p className="mda-lead" style={{ marginTop: 8, color: "var(--adm-accent)", fontWeight: 600 }}>{plan.focus}</p> : null}
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 16, maxWidth: 560 }}>
              <div style={{ flex: 1 }}>
                <Bar value={p.progress} />
              </div>
              <span className="mda-num" style={{ fontSize: "1.2rem" }}>{pctLabel(p.progress)}</span>
              <MedalCounts medals={p.medals} />
            </div>
          </header>

          {/* Sections du pilier dans l'admin */}
          <section>
            <h2 className="mda-h2">Les sections du pilier</h2>
            <p className="mda-sub">Ce qui existe déjà dans l'admin, ce qui est en construction et ce qui reste à bâtir. Chaque section se branche ici au fur et à mesure.</p>
            <div className="mda-cols-3">
              {mods.map((m) => (
                <Link key={m.slug} href={moduleHref(m)} className="mda-cell" style={{ minHeight: 0 }}>
                  <Pill tone={STATUS_TONE[m.status]}>{MODULE_STATUS_LABEL[m.status]}</Pill>
                  <span className="mda-cell-title" style={{ fontSize: "0.92rem" }}>{m.title}</span>
                  <span style={{ fontSize: "0.82rem", color: "var(--adm-text-2)", lineHeight: 1.4 }}>{m.question}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Grille des 8 objectifs */}
          <section>
            <h2 className="mda-h2">Les 8 objectifs</h2>
            <p className="mda-sub">Touchez un objectif pour aller à ses tâches.</p>
            <div className="mda-grid9">
              {objs.slice(0, 4).map((ob) => (
                <ObjCell key={ob.code} ob={ob} />
              ))}
              <div className="mda-cell mda-cell-center" style={{ minHeight: 120 }}>
                <span className="mda-cell-code">Pilier {plan.code.slice(1)}</span>
                <span className="mda-cell-title">{plan.name}</span>
                <span className="mda-num" style={{ fontSize: "1.3rem" }}>{pctLabel(p.progress)}</span>
              </div>
              {objs.slice(4).map((ob) => (
                <ObjCell key={ob.code} ob={ob} />
              ))}
            </div>
          </section>

          {/* Tâches de chaque objectif */}
          {plan.objectives.map((ob) => {
            const prog = objs.find((x) => x.code === ob.code)!;
            const tasks = o.tasks.filter((t) => t.objective === ob.code);
            const kpis = o.kpis.filter((k) => ob.kpis.includes(k.id));
            const relatedMods = mods.filter((m) => m.objectives.includes(ob.code));
            return (
              <section key={ob.code} id={ob.code} className="mda-card-flush" style={{ scrollMarginTop: 16 }}>
                <div className="mda-card-head" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                    <p className="mda-eyebrow">{ob.code}</p>
                    <h2 className="mda-h2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {ob.name} <MedalDot medal={prog.medal} />
                    </h2>
                    {ob.description ? <p className="mda-sub" style={{ margin: "4px 0 0" }}>{ob.description}</p> : null}
                    {kpis.length || relatedMods.length ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        {kpis.map((k) => (
                          <Link key={k.id} href="/admin/mandalart/indicateurs" className="mda-pill" data-tone={k.met ? "good" : undefined} style={{ textDecoration: "none" }}>
                            {k.label} : {formatKpi(k.current, k.targetN.unit || k.startN.unit)} / {k.target}
                          </Link>
                        ))}
                        {relatedMods.map((m) => (
                          <Link key={m.slug} href={moduleHref(m)} className="mda-pill" data-tone="accent" style={{ textDecoration: "none" }}>
                            → {m.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ width: 160 }}>
                    <Bar value={prog.progress} thin />
                    <p className="mda-label" style={{ textAlign: "right" }}>
                      {pctLabel(prog.progress)} · {prog.done}/{prog.total} faites
                    </p>
                  </div>
                </div>
                <TaskList tasks={toItems(tasks)} currentLevel={o.currentLevel} groupByLevel />
                <AddTaskForm objective={ob.code} defaultLevel={o.currentLevel} />
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
