import { AdminTopbar } from "@/components/admin-topbar";
import { TaskList } from "@/components/mandalart/task-list";
import { Bar, Pill, dayLabel, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { isOpen } from "@/lib/mandalart-core";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { toItems } from "@/lib/mandalart-view";

export const metadata = { title: "Mandalart — Niveaux", robots: "noindex" };
export const dynamic = "force-dynamic";

const STATE = { fait: { label: "Fait", tone: "good" as const }, en_cours: { label: "En cours", tone: "accent" as const }, a_venir: { label: "À venir", tone: undefined } };

/** Les 6 niveaux en ligne du temps. On passe au suivant quand toutes les ⭐ du niveau sont faites. */
export default async function MandalartLevelsPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Une étape n'est lancée que si la précédente tient</p>
            <h1 className="mda-h1">Les 6 niveaux</h1>
            <p className="mda-lead">Niveau actuel = le premier qui a encore des ⭐ non faites. Les niveaux suivants restent visibles et cochables, mais grisés.</p>
          </header>
          <section className="mda-levels" aria-label="Ligne du temps">
            {o.levels.map((l) => (
              <a key={l.id} href={`#N${l.id}`} className="mda-level" data-state={l.state} style={{ textDecoration: "none", color: "var(--adm-text)" }}>
                <span className="mda-cell-code">N{l.id}</span>
                <span style={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.3 }}>{l.name}</span>
                <Bar value={l.progress} thin color={l.state === "fait" ? "var(--adm-good)" : undefined} />
                <span className="mda-label" style={{ marginTop: 0 }}>
                  {l.starsDone}/{l.stars} ⭐ · {pctLabel(l.progress)}
                </span>
              </a>
            ))}
          </section>
          {o.levels.map((l) => {
            const tasks = o.tasks.filter((t) => t.level === l.id).sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (a.priority === b.priority ? 0 : a.priority === "star" ? -1 : 1) || (a.due ?? "").localeCompare(b.due ?? ""));
            return (
              <section key={l.id} id={`N${l.id}`} className="mda-card-flush" style={{ scrollMarginTop: 16, opacity: l.state === "a_venir" ? 0.85 : 1 }}>
                <div className="mda-card-head" style={{ alignItems: "flex-start" }}>
                  <div style={{ flex: "1 1 320px" }}>
                    <p className="mda-eyebrow">
                      N{l.id} · du {dayLabel(l.start)} au {dayLabel(l.end)}
                      {l.state === "en_cours" ? ` · ${l.daysLeft} jours restants` : ""}
                    </p>
                    <h2 className="mda-h2" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {l.name} <Pill tone={STATE[l.state].tone}>{STATE[l.state].label}</Pill>
                    </h2>
                    <p className="mda-sub" style={{ margin: "4px 0 0" }}>{l.goal}</p>
                  </div>
                  <div style={{ width: 180 }}>
                    <Bar value={l.progress} thin />
                    <p className="mda-label" style={{ textAlign: "right" }}>
                      {l.done}/{l.total} faites{l.overdue ? <span style={{ color: "var(--adm-bad)" }}> · {l.overdue} en retard</span> : null}
                    </p>
                  </div>
                </div>
                {l.state === "a_venir" ? (
                  <details>
                    <summary style={{ cursor: "pointer", padding: "12px 20px", color: "var(--adm-text-2)", fontSize: "0.88rem" }}>Afficher les {l.total} tâches</summary>
                    <TaskList tasks={toItems(tasks)} currentLevel={o.currentLevel} showObjective />
                  </details>
                ) : (
                  <TaskList tasks={toItems(tasks)} currentLevel={o.currentLevel} showObjective />
                )}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
