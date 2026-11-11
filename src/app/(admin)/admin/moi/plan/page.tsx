import Link from "next/link";

import { PlanTask, PlanTaskList, type PlanTaskItem } from "@/components/jp-plan";
import { requireAdmin } from "@/lib/admin-auth";
import { isOpen, type LiveTask } from "@/lib/mandalart-core";
import { PLAN } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { guideFor, isForJp, LEVEL_GUIDES } from "@/lib/mandalart-steps";

export const metadata = { title: "Mon plan — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const money = (dollars: number) => `${Math.round(dollars).toLocaleString("fr-CA")} $`;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
const SHORT_M = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${SHORT_M[d.getUTCMonth()]}`;
};
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Dimanche de la semaine en cours (la semaine finit le dimanche). */
function endOfWeek(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

/** Ordre de « Mon plan » : en retard, puis par échéance, ⭐ d'abord ; ce que le site a déjà réglé passe en dernier. */
const order = (a: LiveTask, b: LiveTask) =>
  Number(!!guideFor(a.code)?.already) - Number(!!guideFor(b.code)?.already) ||
  Number(b.overdue) - Number(a.overdue) ||
  (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
  Number(b.priority === "star") - Number(a.priority === "star") ||
  a.code.localeCompare(b.code);

const toItem = (t: LiveTask): PlanTaskItem => ({
  code: t.code,
  title: t.title,
  owner: t.owner,
  due: t.due,
  star: t.priority === "star",
  status: t.status,
  late: t.overdue,
  objectiveName: t.objectiveName,
  guide: guideFor(t.code)
});

/** Espace JP — Mon plan : le Mandalart rendu simple. Le but, l'étape où il est, LA prochaine chose à faire (avec le
 *  comment faire), sa semaine, le reste de l'étape par échéance, ce que les autres font, et les 6 étapes jusqu'en 2028. */
export default async function MonPlanPage() {
  await requireAdmin({ roles: ["admin"] });
  const ov = await getMandalartOverview();
  const { today, tasks, levels, currentLevel } = ov;
  const level = levels.find((l) => l.id === currentLevel)!;
  const month = today.slice(0, 7);
  const monthPlan = PLAN.trajectory.months.find((m) => m.month === month);
  const monthIn = (ov.figures.monthsCents[month] ?? 0) / 100;
  const weekEnd = endOfWeek(today);

  const open = tasks.filter((t) => t.level === currentLevel && isOpen(t)).sort(order);
  const mine = open.filter((t) => isForJp(t.owner));
  const others = open.filter((t) => !isForJp(t.owner));
  const next = mine.find((t) => !guideFor(t.code)?.already) ?? mine[0] ?? null;
  const week = mine.filter((t) => t !== next && (t.overdue || (!!t.due && t.due <= weekEnd)));
  const later = mine.filter((t) => t !== next && !week.includes(t));
  const laterByDue = new Map<string, LiveTask[]>();
  for (const t of later) laterByDue.set(t.due ?? "", [...(laterByDue.get(t.due ?? "") ?? []), t]);
  const othersByOwner = new Map<string, LiveTask[]>();
  for (const t of others) othersByOwner.set(t.owner ?? "À attribuer", [...(othersByOwner.get(t.owner ?? "À attribuer") ?? []), t]);

  const levelMoney = (start: string, end: string) => PLAN.trajectory.months.filter((m) => m.month >= start.slice(0, 7) && m.month <= end.slice(0, 7)).reduce((s, m) => s + m.target, 0);
  const caYear = ov.results.caYearCents / 100;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Le but : 1 500 000 $ encaissés en 2028</p>
          <h1 className="mda-h1" style={{ textTransform: "none" }}>
            Étape {level.id} sur {levels.length} : {level.name}
          </h1>
          <p className="mda-lead">
            {LEVEL_GUIDES[level.id]?.plain ?? level.goal} Une chose à la fois : fais l&apos;étape 👉, coche-la, la suivante monte toute seule. Ce que les autres peuvent faire, confie-le.
          </p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num">{monthPlan ? money(monthPlan.target) : "—"}</p>
            <p className="mda-label">
              À encaisser en {monthName(month)} · {money(monthIn)} rentrés{monthPlan ? ` (plancher ${money(monthPlan.floor)})` : ""}
            </p>
            {monthPlan ? (
              <div className="mda-bar mda-bar-thin" style={{ marginTop: 10 }}>
                <div className="mda-fill" style={{ width: `${Math.min(100, (monthIn / monthPlan.target) * 100)}%` }} />
              </div>
            ) : null}
          </div>
          <div className="mda-card">
            <p className="mda-num">
              {level.done} / {level.total}
            </p>
            <p className="mda-label">
              Tâches faites dans l&apos;étape {level.id} · {level.daysLeft} jours restants (fin le {longDate(level.end)})
            </p>
            <div className="mda-bar mda-bar-thin" style={{ marginTop: 10 }}>
              <div className="mda-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
          </div>
          <div className="mda-card">
            <p className="mda-num" style={{ color: mine.some((t) => t.overdue) ? "var(--adm-warn)" : undefined }}>{week.length + (next ? 1 : 0)}</p>
            <p className="mda-label">
              À toi d&apos;ici dimanche{mine.filter((t) => t.overdue).length ? ` · ${mine.filter((t) => t.overdue).length} en retard` : ""} · {others.length} confiées aux autres
            </p>
          </div>
        </section>

        {monthPlan ? (
          <p className="mda-sub" style={{ margin: "-4px 0 0" }}>
            <strong>Comment on fait l&apos;argent de {monthName(month)} :</strong> {monthPlan.how}
          </p>
        ) : null}

        <section className="mda-card-flush" style={{ borderColor: "rgba(180,155,242,0.5)" }}>
          <div className="mda-card-head">
            <h2 className="mda-h2">👉 Ta prochaine étape</h2>
          </div>
          {next ? (
            <ul className="mda-tasks">
              <PlanTask t={toItem(next)} open />
            </ul>
          ) : (
            <p style={{ padding: "14px 20px", margin: 0 }}>Toutes tes tâches de l&apos;étape {level.id} sont faites. Bravo : l&apos;étape suivante commence.</p>
          )}
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Ensuite, cette semaine (d&apos;ici {shortDate(weekEnd)})</h2>
          </div>
          <PlanTaskList items={week.map(toItem)} empty="Rien d'autre d'ici dimanche : prends la suite plus bas." />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Le reste de l&apos;étape {level.id}, par date</h2>
          </div>
          {[...laterByDue.entries()].map(([due, ts]) => (
            <div key={due}>
              <p className="mda-group-title">
                {due ? `D'ici le ${longDate(due)}` : "Sans date"} · {ts.length} tâche{ts.length > 1 ? "s" : ""}
              </p>
              <PlanTaskList items={ts.map(toItem)} empty="" />
            </div>
          ))}
          {!laterByDue.size ? <p style={{ padding: "14px 20px", margin: 0, color: "var(--adm-text-3)" }}>Rien d&apos;autre dans cette étape.</p> : null}
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Ce que les autres font pour l&apos;étape {level.id}</h2>
          </div>
          <p className="mda-sub" style={{ padding: "0 20px", margin: "0 0 8px" }}>
            Tu n&apos;as pas à les faire : vérifie le vendredi qu&apos;elles avancent. « Confier » envoie la tâche à la bonne personne avec un lien de suivi.
          </p>
          {[...othersByOwner.entries()].map(([owner, ts]) => (
            <details key={owner}>
              <summary className="mda-group-title" style={{ cursor: "pointer", listStyle: "revert" }}>
                {owner} · {ts.length} tâche{ts.length > 1 ? "s" : ""}
              </summary>
              <PlanTaskList items={ts.map(toItem)} empty="" />
            </details>
          ))}
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Les {levels.length} étapes jusqu&apos;au 1,5 M$</h2>
          </div>
          <p className="mda-sub" style={{ padding: "0 20px", margin: "0 0 8px" }}>
            Encaissé cette année : {money(caYear)}. Chaque étape a son argent à rentrer et ce qui doit être vrai pour passer à la suivante.
          </p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {levels.map((l) => {
              const g = LEVEL_GUIDES[l.id];
              const target = levelMoney(l.start, l.end);
              const keyMoves = tasks.filter((t) => t.level === l.id && t.priority === "star" && isOpen(t)).sort(order);
              return (
                <li key={l.id} style={{ padding: "14px 20px", borderTop: "1px solid var(--adm-line)", opacity: l.state === "a_venir" ? 0.85 : 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span className="mda-pill" data-tone={l.state === "fait" ? "good" : l.state === "en_cours" ? "accent" : undefined}>
                      {l.state === "fait" ? "✓ Faite" : l.state === "en_cours" ? "👉 Tu es ici" : "À venir"}
                    </span>
                    <strong>
                      Étape {l.id} · {l.name}
                    </strong>
                    <span style={{ color: "var(--adm-text-3)", fontSize: "0.82rem" }}>
                      {shortDate(l.start)} au {shortDate(l.end)} {l.end.slice(0, 4)} · {money(target)} à encaisser
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>{g?.plain ?? l.goal}</p>
                  <div className="mda-bar mda-bar-thin" style={{ margin: "8px 0 0", maxWidth: 360 }}>
                    <div className="mda-fill" style={{ width: `${Math.round(l.progress * 100)}%` }} />
                  </div>
                  <details style={{ marginTop: 8 }} open={l.state === "en_cours"}>
                    <summary style={{ cursor: "pointer", fontSize: "0.84rem", color: "var(--adm-text-2)" }}>
                      Pour passer à l&apos;étape suivante{keyMoves.length ? ` · ${keyMoves.length} ⭐ à faire` : ""}
                    </summary>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: "0.86rem", display: "grid", gap: 3 }}>
                      {(g?.pass ?? []).map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                    {l.state === "a_venir" && keyMoves.length ? (
                      <>
                        <p style={{ margin: "10px 0 4px", fontSize: "0.82rem", fontWeight: 600 }}>Les coups clés</p>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.84rem", display: "grid", gap: 3, color: "var(--adm-text-2)" }}>
                          {keyMoves.slice(0, 8).map((t) => (
                            <li key={t.code}>
                              {t.title} <span style={{ color: "var(--adm-text-3)" }}>({t.due ? shortDate(t.due) : "sans date"} · {t.owner})</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ol>
        </section>

        <p className="mda-sub">
          Tout le détail (piliers, indicateurs, agents) reste dans le <Link href="/admin/mandalart">Mandalart</Link>. Une case cochée ici est cochée là-bas aussi.
        </p>
      </div>
    </div>
  );
}
