import Link from "next/link";
import { Tablet } from "lucide-react";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { OpenSurveyButton } from "@/components/practice-survey";
import { requireAdmin } from "@/lib/admin-auth";
import { SurveyLines, SurveyRing } from "@/components/survey-charts";
import { HelperRanking, SurveyBlockRow, SurveyPeriodFilter } from "@/components/survey-results";
import { ThemePracticeBars } from "@/components/theme-quiz-results";
import { parsePeriod } from "@/lib/practice-survey-results-core";
import { getSurveyResults } from "@/lib/practice-survey-results-repo";
import { getRecentPracticesForSurvey, getSurveyDashboard } from "@/lib/practice-survey-repo";
import { todayIso } from "@/lib/practices-repo";
import { kioskPath } from "@/lib/survey-kiosk";

export const metadata = { title: "Sondage de fin — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayLabel = (iso: string, today: string) => {
  if (iso === today) return "Aujourd'hui";
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** « Comment les filles ont trouvé la pratique ? » : présence, plaisir, fatigue, l'aide de la coach et des autres, et ce qu'elles veulent plus. */
export default async function SurveyListPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string; jours?: string; groupe?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante", "borne"] });
  const today = todayIso();
  const sp = await searchParams;
  const period = parsePeriod(sp, today);
  const group = sp.groupe?.trim() || null;
  const [practices, results, dash] = await Promise.all([
    getRecentPracticesForSurvey().catch(() => []),
    getSurveyResults({ from: period.from, to: period.to, group }).catch(() => null),
    getSurveyDashboard().catch(() => null)
  ]);
  const sum = results?.summary;
  // Le sondage se fait le soir même : le titre ne compte que les pratiques d'hier et d'aujourd'hui.
  const recent = practices.filter((p) => p.daysLeft >= -1);
  const toDo = recent.filter((p) => !p.present || p.answered < p.present);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · à la fin de chaque pratique</p>
            <h1 className="mda-h1">{toDo.length ? `${toDo.length} pratique${toDo.length > 1 ? "s" : ""} d'hier ou d'aujourd'hui à sonder` : recent.length ? "Les pratiques d'hier et d'aujourd'hui sont sondées" : "Aucune pratique hier ni aujourd'hui"}</h1>
            <p className="mda-lead">Ouvre la « Borne iPad » à la fin de la pratique : chaque fille touche sa photo et répond seule (plaisir, fatigue, « Ta coach t&apos;a-t-elle aidée ou encouragée ? » et laquelle, « Est-ce que quelqu&apos;un t&apos;a aidée ? » et qui, puis « Qu&apos;est-ce qu&apos;on a travaillé aujourd&apos;hui ? »). Ici : qui a aidé le plus de filles, le résumé et la réponse de chaque fille, pratique par pratique. Les éducateurs voient la même chose dans leur portail (Sondage des jeunes).</p>
          </header>

          <section className="mda-card" style={{ display: "grid", gap: 14 }}>
            <SurveyPeriodFilter action="/admin/coaching/sondage" from={period.from} to={period.to} days={period.days} groups={results?.groups ?? []} group={group} />
          </section>

          <section className="mda-card" style={{ display: "grid", gap: 12 }}>
            <div>
              <h2 className="mda-h2" style={{ margin: 0 }}>Qui a aidé ou encouragé le plus de filles</h2>
              <p style={{ margin: "4px 0 0", color: "var(--adm-text-2)", fontSize: "0.875rem" }}>
                Sur la période{group ? ` (${group})` : ""}, combien de filles ont nommé chaque éducateur à « Ta coach t&apos;a-t-elle aidée ou encouragée ? ». Une fille aidée à deux pratiques compte deux fois ; le pourcentage se compare entre éducateurs qui n&apos;ont pas le même nombre de pratiques.
              </p>
            </div>
            <HelperRanking ranking={results?.ranking ?? []} period />
          </section>

          {sum && sum.respondents > 0 ? (
            <section className="svc-rings" aria-label="Résumé de la période">
              <SurveyRing value={sum.pleasure} max={10} unit="" label="Plaisir moyen" detail={`${sum.respondents} réponses · ${results?.blocks.length ?? 0} pratiques`} />
              <SurveyRing value={sum.fatigue} max={10} unit="" label="Fatigue moyenne" detail="1 = pleine d'énergie, 10 = épuisée" color="var(--adm-series-2)" />
              <SurveyRing value={sum.coachHelp.pct} max={100} unit=" %" label="Aidées ou encouragées par leur coach" detail={sum.coachHelp.answered ? `${sum.coachHelp.yes} sur ${sum.coachHelp.answered}` : "Dès les premières réponses de la borne"} />
              <SurveyRing value={sum.theme.pct ?? sum.peerHelp.pct} max={100} unit=" %" label={sum.theme.pct !== null ? "Ont compris le thème" : "Aidées par une autre fille"} detail={sum.theme.pct !== null ? `${sum.theme.understood} sur ${sum.theme.answered}` : sum.peerHelp.answered ? `${sum.peerHelp.yes} sur ${sum.peerHelp.answered}` : "Dès les premières réponses de la borne"} />
            </section>
          ) : null}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Les réponses, pratique par pratique</h2>
              <span style={{ fontSize: "0.8125rem", color: "var(--adm-text-3)" }}>Touche une pratique : le classement, le résumé et chaque fille</span>
            </div>
            {results && results.blocks.length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {results.blocks.map((b) => (
                  <SurveyBlockRow key={b.activityId} block={b} href={`/admin/coaching/sondage/${b.activityId}`} />
                ))}
              </ul>
            ) : (
              <p className="admin-empty-text" style={{ padding: "16px 20px 20px", margin: 0 }}>Aucune réponse de la borne sur cette période.</p>
            )}
          </section>

          {dash && dash.weeks.length > 0 && (
            <section className="mda-card" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <h2 className="mda-h2" style={{ margin: 0 }}>Plaisir et fatigue, semaine par semaine</h2>
                <div className="svc-legend">
                  <span><i className="svc-swatch" style={{ background: "var(--adm-series-1)" }} />Plaisir</span>
                  <span><i className="svc-swatch" style={{ background: "var(--adm-series-2)" }} />Fatigue</span>
                </div>
              </div>
              <SurveyLines
                weeks={dash.weeks.map((w) => w.week)}
                counts={dash.weeks.map((w) => w.answered)}
                max={10}
                series={[
                  { key: "plaisir", label: "Plaisir", color: "var(--adm-series-1)", values: dash.weeks.map((w) => w.pleasure) },
                  { key: "fatigue", label: "Fatigue", color: "var(--adm-series-2)", values: dash.weeks.map((w) => w.fatigue) }
                ]}
              />
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>Moyenne des réponses de chaque semaine (sur 10), 10 dernières semaines. Survole une semaine pour le détail.</p>
            </section>
          )}

          {dash && dash.weeks.filter((w) => w.coachHelpPct !== null).length > 1 ? (
            <section className="mda-card" style={{ display: "grid", gap: 12 }}>
              <h2 className="mda-h2" style={{ margin: 0 }}>Filles aidées ou encouragées par leur coach, semaine par semaine</h2>
              <SurveyLines weeks={dash.weeks.map((w) => w.week)} max={100} unit=" %" series={[{ key: "aide", label: "Aidées", color: "var(--adm-series-1)", values: dash.weeks.map((w) => w.coachHelpPct) }]} />
            </section>
          ) : null}

          <section className="mda-card" style={{ display: "grid", gap: 14 }}>
            <h2 className="mda-h2" style={{ margin: 0 }}>Le thème de la pratique : qui a compris ?</h2>
            {dash && dash.themePractices.length ? (
              <>
                <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.875rem" }}>
                  Sur la borne, « Qu&apos;est-ce qu&apos;on a travaillé aujourd&apos;hui ? » : 3 choix, un seul est le thème de la semaine du groupe. La fille ne voit pas si elle a bon. Part des filles qui l&apos;ont trouvé, pratique par pratique (touche une pratique pour voir qui).
                  {(() => {
                    const a = dash.themeWeeks.reduce((s, w) => s + w.answered, 0);
                    const u = dash.themeWeeks.reduce((s, w) => s + w.understood, 0);
                    return a ? ` En tout : ${u} sur ${a} (${Math.round((u / a) * 100)} %).` : "";
                  })()}
                </p>
                <ThemePracticeBars practices={dash.themePractices.slice(0, 20)} />
                {dash.themeWeeks.length > 1 ? (
                  <>
                    <h3 style={{ margin: "8px 0 0", fontSize: "0.875rem", fontWeight: 600, color: "var(--adm-text)" }}>Filles qui ont compris le thème, semaine par semaine</h3>
                    <SurveyLines weeks={dash.themeWeeks.map((w) => w.week)} counts={dash.themeWeeks.map((w) => w.answered)} max={100} unit=" %" series={[{ key: "theme", label: "Compris", color: "var(--adm-series-1)", values: dash.themeWeeks.map((w) => w.pct) }]} />
                  </>
                ) : null}
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.875rem" }}>Pas encore de réponse. Dès la prochaine pratique qui a un thème, chaque fille répond sur la borne à « Qu&apos;est-ce qu&apos;on a travaillé aujourd&apos;hui ? » (3 choix) : la part de celles qui l&apos;ont trouvé s&apos;affiche ici, et qui exactement dans le sondage de chaque pratique.</p>
            )}
          </section>

          {results && sum && (results.peers.length > 0 || sum.wants.length > 0) && (
            <section className="mda-cols-4">
              {results.peers.length ? (
                <div className="mda-card" style={{ gridColumn: "span 2" }}>
                  <p className="mda-label" style={{ marginTop: 0 }}>Celles qui aident le plus les autres · sur la période</p>
                  <p style={{ margin: "6px 0 0", color: "var(--adm-text)", fontWeight: 600 }}>{results.peers.slice(0, 6).map((c) => `${c.name} (${c.count})`).join(" · ")}</p>
                </div>
              ) : null}
              <div className="mda-card" style={{ gridColumn: "span 2" }}>
                <p className="mda-label" style={{ marginTop: 0 }}>Elles veulent plus de</p>
                <p style={{ margin: "6px 0 0", color: "var(--adm-text)", fontWeight: 600 }}>{sum.wants.length ? sum.wants.slice(0, 4).map((w) => `${w.label} (${w.count})`).join(" · ") : "Pas encore de demande"}</p>
              </div>
            </section>
          )}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Aujourd&apos;hui et les 7 derniers jours</h2>
            </div>
            {practices.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Aucune pratique de l&apos;Académie dans l&apos;horaire ces 7 derniers jours.</p>
            ) : (
              <ul className="mda-tasks">
                {practices.map((p) => {
                  const done = p.present > 0 && p.answered >= p.present;
                  return (
                    <li key={p.key} className="mda-task" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div className="mda-task-body" style={{ flex: "1 1 240px" }}>
                        <p className="mda-task-title" style={{ fontWeight: 600, textTransform: "none" }}>
                          <span style={{ textTransform: "capitalize" }}>{dayLabel(p.date, today)}</span> · {p.start.replace(":", " h ")} · {p.group}
                        </p>
                        <div className="mda-task-meta">
                          <span>{p.location}</span>
                          <span>{p.expected} joueuse{p.expected > 1 ? "s" : ""} attendue{p.expected > 1 ? "s" : ""}</span>
                          {p.present ? <span>{p.present} présente{p.present > 1 ? "s" : ""}</span> : <span>Présences pas encore marquées</span>}
                        </div>
                      </div>
                      <Pill tone={done ? "good" : p.answered ? "warn" : undefined}>{done ? "Sondée" : p.present ? `${p.answered}/${p.present} sondées` : "À faire"}</Pill>
                      {p.activityId ? (
                        <>
                          <a href={kioskPath(p.activityId)} target="_blank" rel="noreferrer" className="admin-btn-ghost" style={{ textDecoration: "none", whiteSpace: "nowrap" }} title="Ouvre la page à laisser sur l'iPad : chaque fille touche sa photo et répond elle-même.">
                            <Tablet size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />Borne iPad
                          </a>
                          <Link href={done ? `/admin/coaching/sondage/${p.activityId}` : `/admin/coaching/sondage/${p.activityId}?vue=saisie`} className={done ? "admin-btn-ghost" : "admin-btn-primary"} style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                            {done ? "Voir" : "Faire le sondage"}
                          </Link>
                        </>
                      ) : (
                        <OpenSurveyButton practiceKey={p.key} label="Faire le sondage" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
