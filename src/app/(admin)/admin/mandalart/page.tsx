import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { RecoveryForm, ResolveRecoveryButton } from "@/components/mandalart/forms";
import { TaskList } from "@/components/mandalart/task-list";
import { Bar, capitalize, dayLabel, monthLabel, moneyCents, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { isOpen, monthFocus } from "@/lib/mandalart-core";
import { dailyQuest, journey, rankOf, streakOf, xpOf } from "@/lib/mandalart-game";
import { computeGap } from "@/lib/mandalart-levers";
import { getMandalartOverview } from "@/lib/mandalart-repo";
import { toItems } from "@/lib/mandalart-view";

export const metadata = { title: "Mandalart — Ce mois-ci", robots: "noindex" };
export const dynamic = "force-dynamic";

const WORLD_ICON = ["🧱", "☀️", "🚦", "🏕️", "🌱", "🏆"];
const torontoDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/** Écran par défaut du Mandalart, en jeu : la quête du jour (3 petites bouchées), le rang et l'XP,
 *  la carte du voyage vers 1,5 M$ (est-on dans les temps ?), l'écart d'argent et les leviers pour le
 *  rattraper, puis toutes les priorités du mois. */
export default async function MandalartNowPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  const focus = monthFocus(o.tasks, o.today);
  const level = o.levels.find((l) => l.id === o.currentLevel)!;
  const gap = await computeGap(o.figures, o.today);

  const done = o.tasks.filter((t) => t.status === "fait" && t.doneAt);
  const xp = xpOf(o.tasks);
  const rank = rankOf(xp);
  const streak = streakOf(done.map((t) => torontoDay(t.doneAt!)), o.today);
  const quest = dailyQuest(o.tasks, o.currentLevel);
  const { stops, pacePerWeek } = journey(o.levels, o.tasks, done.map((t) => ({ code: t.code, date: torontoDay(t.doneAt!) })), o.today);
  const current = stops.find((s) => s.state === "en_cours");
  const starsThisMonth = focus.dueThisMonth.filter((t) => t.priority === "star");
  const progThisMonth = focus.dueThisMonth.filter((t) => t.priority === "progressive");
  const openStarsLevel = o.tasks.filter((t) => t.level === o.currentLevel && t.priority === "star" && isOpen(t)).length;
  const doneToday = done.filter((t) => torontoDay(t.doneAt!) === o.today).length;
  const weeksLeft = current ? Math.max(1, Math.ceil((Date.parse(`${current.end}T12:00:00Z`) - Date.parse(`${o.today}T12:00:00Z`)) / (7 * 86400000))) : 1;

  const assurance = !current
    ? "Tous les niveaux sont faits."
    : current.onTrack === null
      ? `Coche tes premières bouchées : le jeu calculera ton rythme et dira si le monde ${current.id} finit à temps (le ${dayLabel(current.end)}). Il faut environ ${Math.ceil(openStarsLevel / weeksLeft)} ⭐ par semaine.`
      : current.onTrack
        ? `Au rythme des 4 dernières semaines, le monde ${current.id} sera fini vers le ${dayLabel(current.projected)}, avant l'échéance du ${dayLabel(current.end)}. Dans les temps. 💪`
        : `Au rythme actuel, le monde ${current.id} finirait vers le ${dayLabel(current.projected)} : ${current.weeksLate} semaine${current.weeksLate > 1 ? "s" : ""} de retard. Pour rattraper : ${Math.ceil(openStarsLevel / weeksLeft)} ⭐ par semaine.`;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              {capitalize(monthLabel(focus.month))} · monde {level.id} sur 6 : {level.name}
            </p>
            <h1 className="mda-h1">{doneToday ? `${doneToday} bouchée${doneToday > 1 ? "s" : ""} faite${doneToday > 1 ? "s" : ""} aujourd'hui. On continue ?` : "Ta quête du jour : 3 petites bouchées"}</h1>
            <p className="mda-lead">Une à la fois. Touche le rond quand tu commences (en cours), puis quand c'est fait : +100 XP pour une ⭐, +50 XP pour une ➜.</p>
          </header>

          {/* Rang, XP, série + quête du jour */}
          <section className="mda-game">
            <div className="mda-rank">
              <span className="mda-rank-icon" aria-hidden>{rank.icon}</span>
              <div>
                <p className="mda-eyebrow" style={{ color: "var(--adm-text-2)" }}>Ton rang</p>
                <p className="mda-num" style={{ fontSize: "1.4rem" }}>{rank.name}</p>
              </div>
              <div className="mda-xpbar" role="progressbar" aria-valuenow={Math.round(rank.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${Math.max(2, rank.progress * 100)}%` }} />
              </div>
              <p className="mda-label" style={{ margin: 0 }}>
                <strong style={{ color: "var(--adm-text)" }}>{xp.toLocaleString("fr-CA")} XP</strong>
                {rank.next ? ` · encore ${rank.toNext.toLocaleString("fr-CA")} XP pour ${rank.next.icon} ${rank.next.name}` : " · rang maximal"}
              </p>
              <span className="mda-streak">🔥 {streak} jour{streak > 1 ? "s" : ""} de suite</span>
              <p className="mda-label" style={{ margin: 0 }}>{streak ? "Fais au moins une bouchée aujourd'hui pour garder ta série." : "Une bouchée aujourd'hui lance ta série."}</p>
            </div>
            <div className="mda-card-flush">
              <div className="mda-quest-head">
                <h2 className="mda-h2" style={{ margin: 0 }}>🎯 Quête du jour</h2>
                <span className="mda-label" style={{ margin: 0 }}>Bloque 25 minutes, une bouchée à la fois</span>
              </div>
              <TaskList tasks={toItems(quest)} currentLevel={o.currentLevel} showObjective empty="Rien à faire : toutes les tâches ouvertes sont faites. 🏆" />
            </div>
          </section>

          {/* Carte du voyage : l'assurance long terme */}
          <section className="mda-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <h2 className="mda-h2" style={{ margin: 0 }}>🗺️ Le voyage vers 1 500 000 $</h2>
              <span className="mda-label" style={{ margin: 0 }}>Rythme : {pacePerWeek.toLocaleString("fr-CA", { maximumFractionDigits: 1 })} points par semaine (⭐ = 2, ➜ = 1)</span>
            </div>
            <div className="mda-journey" style={{ marginTop: 16 }}>
              {stops.map((s, i) => (
                <Link key={s.id} href={`/admin/mandalart/niveaux#N${s.id}`} className="mda-stop" data-state={s.state} style={{ textDecoration: "none" }}>
                  <span className="mda-node" aria-hidden>{s.state === "fait" ? "✓" : s.state === "en_cours" ? WORLD_ICON[i] : "🔒"}</span>
                  <span>
                    <span className="mda-stop-name" style={{ display: "block" }}>
                      {s.id}. {s.name}
                    </span>
                    <span className="mda-stop-sub" style={{ display: "block" }}>
                      {pctLabel(s.progress)} · fin {dayLabel(s.end)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
            <p className="mda-lead" style={{ marginTop: 16, fontSize: "0.9rem", color: current?.onTrack === false ? "var(--adm-warn)" : "var(--adm-text-2)" }}>{assurance}</p>
            <div className="mda-cols-2" style={{ marginTop: 16 }}>
              <div>
                <p className="mda-label" style={{ marginTop: 0 }}>Encaissé en {o.results.year} : <strong style={{ color: "var(--adm-text)" }}>{moneyCents(o.results.caYearCents)}</strong> · 1,5 M$ visés en 2028</p>
                <Bar value={o.results.progress} marker={o.results.milestoneCents / o.results.goalCents} thin />
              </div>
              <div>
                <p className="mda-label" style={{ marginTop: 0 }}>Plan exécuté : <strong style={{ color: "var(--adm-text)" }}>{pctLabel(o.execution)}</strong> · monde {level.id} : {level.starsDone}/{level.stars} ⭐</p>
                <Bar value={o.execution} thin color="var(--adm-good)" />
              </div>
            </div>
          </section>

          {/* Écart et rattrapage */}
          <section className="mda-card-flush">
            <div className="mda-card-head" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 320px" }}>
                <h2 className="mda-h2">💸 Écart et rattrapage</h2>
                {gap.proposal.map((p) => (
                  <p key={p} className="mda-sub" style={{ margin: "4px 0 0", color: "var(--adm-text-2)" }}>
                    {p}
                  </p>
                ))}
              </div>
              <div style={{ width: 260, display: "grid", gap: 10 }}>
                <div>
                  <p className="mda-label" style={{ marginTop: 0 }}>
                    {capitalize(monthLabel(gap.month, false))} : {moneyCents(gap.monthActualCents)} / plancher {moneyCents(gap.monthFloorCents)}
                  </p>
                  <Bar value={gap.monthTargetCents ? gap.monthActualCents / gap.monthTargetCents : 0} floor={gap.monthTargetCents ? gap.monthFloorCents / gap.monthTargetCents : undefined} thin />
                </div>
                <div>
                  <p className="mda-label" style={{ marginTop: 0 }}>
                    {gap.quarterLabel} : {moneyCents(gap.quarterActualCents)} / plancher {moneyCents(gap.quarterFloorCents)}
                  </p>
                  <Bar value={gap.quarterTargetCents ? gap.quarterActualCents / gap.quarterTargetCents : 0} floor={gap.quarterTargetCents ? gap.quarterFloorCents / gap.quarterTargetCents : undefined} thin />
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--adm-line)" }}>
              <p className="mda-label" style={{ marginTop: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                Trésorerie jusqu'au {dayLabel(gap.cash.until)} {gap.cash.shortfallCents ? <span style={{ color: "var(--adm-bad)" }}>· il manque {moneyCents(gap.cash.shortfallCents)}</span> : <span style={{ color: "var(--adm-good)" }}>· couverte</span>}
              </p>
              <p className="mda-label" style={{ margin: "4px 0 0" }}>
                Solde {gap.cash.balanceCents === null ? "non saisi" : moneyCents(gap.cash.balanceCents)} + entrées attendues {moneyCents(gap.cash.expectedCents ?? 0)} + versements des familles {moneyCents(gap.cash.installmentsCents)} − dépenses à payer {moneyCents(gap.cash.expensesCents)} − paie des contrats {moneyCents(gap.cash.payrollCents)}.{" "}
                <Link href="/admin/mandalart/indicateurs" style={{ color: "var(--adm-accent)" }}>Mettre à jour le solde</Link>
              </p>
            </div>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--adm-line)" }}>
              <p className="mda-label" style={{ marginTop: 0, fontWeight: 600, color: "var(--adm-text)" }}>Argent à rattraper {gap.recoveryCents ? `· ${moneyCents(gap.recoveryCents)}` : ""}</p>
              {gap.recovery.map((r) => (
                <p key={r.id} className="mda-label" style={{ margin: "4px 0" }}>
                  {r.label} : <strong>{moneyCents(r.amount_cents)}</strong> <ResolveRecoveryButton id={r.id} />
                </p>
              ))}
              <RecoveryForm />
            </div>
            {gap.levers.map((l) => (
              <div key={l.key} className="mda-lever">
                <div>
                  <Link href={l.href} style={{ color: "var(--adm-text)", fontWeight: 600, textDecoration: "none" }}>
                    {l.title}
                  </Link>
                  <p className="mda-label" style={{ margin: "2px 0 0" }}>
                    {l.how}
                    {l.task ? ` (tâche ${l.task})` : ""}
                  </p>
                </div>
                <div>
                  <p className="mda-lever-amt" style={{ margin: 0 }}>jusqu'à {moneyCents(l.potentialCents)}</p>
                  <p className="mda-label" style={{ margin: 0, textAlign: "right" }}>{l.when}</p>
                </div>
              </div>
            ))}
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
          <details className="mda-card-flush" open={starsThisMonth.length <= 8}>
            <summary style={{ cursor: "pointer", padding: "16px 20px", listStyle: "none" }}>
              <span className="mda-h2">⭐ Toutes les priorités de {monthLabel(focus.month, false)} · {starsThisMonth.length}</span>
              <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>Il reste {openStarsLevel} ⭐ pour finir le monde {level.id}. Toucher pour afficher.</span>
            </summary>
            <div style={{ borderTop: "1px solid var(--adm-line)" }}>
              <TaskList tasks={toItems(starsThisMonth)} currentLevel={o.currentLevel} showObjective empty="Aucune priorité due ce mois-ci." />
            </div>
          </details>

          {/* Règle d'anticipation */}
          <details className="mda-card-flush">
            <summary style={{ cursor: "pointer", padding: "16px 20px", listStyle: "none" }}>
              <span className="mda-h2">⏩ À préparer dès maintenant · {focus.prepare.length}</span>
              <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>⭐ dues dans les 2 prochains mois : les commencer maintenant évite d'être en retard.</span>
            </summary>
            <div style={{ borderTop: "1px solid var(--adm-line)" }}>
              <TaskList tasks={toItems(focus.prepare)} currentLevel={o.currentLevel} showObjective empty="Rien à préparer d'avance." />
            </div>
          </details>

          <details className="mda-card-flush">
            <summary style={{ cursor: "pointer", padding: "16px 20px", listStyle: "none" }}>
              <span className="mda-h2">➜ Aussi ce mois-ci · {progThisMonth.length}</span>
              <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>Tâches progressives : elles comptent une fois.</span>
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
        </div>
      </div>
    </>
  );
}
