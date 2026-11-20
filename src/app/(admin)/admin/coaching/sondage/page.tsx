import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { OpenSurveyButton } from "@/components/practice-survey";
import { requireAdmin } from "@/lib/admin-auth";
import { CoachHelpBars, SurveyLines, SurveyRing } from "@/components/survey-charts";
import { getRecentPracticesForSurvey, getSurveyDashboard, getSurveyTrend } from "@/lib/practice-survey-repo";
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
const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));

/** « Comment les filles ont trouvé la pratique ? » : présence, plaisir, fatigue, l'aide de la coach et des autres, et ce qu'elles veulent plus. */
export default async function SurveyListPage() {
  await requireAdmin({ roles: ["admin", "gerante", "borne"] });
  const today = todayIso();
  const [practices, trend, dash] = await Promise.all([getRecentPracticesForSurvey().catch(() => []), getSurveyTrend().catch(() => null), getSurveyDashboard().catch(() => null)]);
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
            <p className="mda-lead">Les joueuses de chaque pratique sont déjà là, selon leur groupe et leur journée. Marque qui était présente, puis chaque fille donne son plaisir et sa fatigue sur 10 (et, si elle veut, ce qu&apos;elle aimerait avoir plus). Ou ouvre la « Borne iPad » : chaque fille touche sa photo et répond seule aux 4 mêmes questions à chaque fois (plaisir, fatigue, « Ta coach t&apos;a-t-elle aidée ou encouragée ? » et « Est-ce que quelqu&apos;un t&apos;a aidée ? », avec qui). Le plaisir alimente l&apos;indicateur « appréciation des joueuses » du Mandalart.</p>
          </header>

          {trend && trend.answered > 0 && (
            <section className="svc-rings" aria-label="Les 4 dernières semaines">
              <SurveyRing value={trend.pleasure} max={10} unit="" label="Plaisir moyen" detail={`4 dernières semaines · ${trend.answered} réponses`} />
              <SurveyRing value={trend.fatigue} max={10} unit="" label="Fatigue moyenne" detail="1 = pleine d'énergie, 10 = épuisée" color="var(--adm-series-2)" />
              <SurveyRing value={trend.coachHelp.answered ? Math.round((trend.coachHelp.yes / trend.coachHelp.answered) * 100) : null} max={100} unit=" %" label="Aidées ou encouragées par leur coach" detail={trend.coachHelp.answered ? `${trend.coachHelp.yes} sur ${trend.coachHelp.answered}` : "Dès les premières réponses de la borne"} />
              <SurveyRing value={trend.peerHelp.answered ? Math.round((trend.peerHelp.yes / trend.peerHelp.answered) * 100) : null} max={100} unit=" %" label="Aidées par une autre fille" detail={trend.peerHelp.answered ? `${trend.peerHelp.yes} sur ${trend.peerHelp.answered}` : "Dès les premières réponses de la borne"} />
            </section>
          )}

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

          <section className="mda-card" style={{ display: "grid", gap: 14 }}>
            <h2 className="mda-h2" style={{ margin: 0 }}>L&apos;aide des coachs</h2>
            {dash && dash.coaches.length ? (
              <>
                <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.875rem" }}>Sur toutes les filles qui ont répondu dans ses pratiques, la part qui l&apos;a nommée à « Ta coach t&apos;a-t-elle aidée ou encouragée ? » (10 dernières semaines).</p>
                <CoachHelpBars coaches={dash.coaches} />
                {dash.weeks.filter((w) => w.coachHelpPct !== null).length > 1 ? (
                  <>
                    <h3 style={{ margin: "8px 0 0", fontSize: "0.875rem", fontWeight: 600, color: "var(--adm-text)" }}>Filles aidées ou encouragées par leur coach, semaine par semaine</h3>
                    <SurveyLines weeks={dash.weeks.map((w) => w.week)} max={100} unit=" %" series={[{ key: "aide", label: "Aidées", color: "var(--adm-series-1)", values: dash.weeks.map((w) => w.coachHelpPct) }]} />
                  </>
                ) : null}
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.875rem" }}>Pas encore de réponse. Dès la prochaine pratique, chaque fille dit sur la borne si sa coach l&apos;a aidée ou encouragée, et laquelle : chaque coach aura ici sa part en pourcentage.</p>
            )}
          </section>

          {trend && (trend.peerNames.length > 0 || trend.wants.length > 0) && (
            <section className="mda-cols-4">
              {trend.peerNames.length ? (
                <div className="mda-card" style={{ gridColumn: "span 2" }}>
                  <p className="mda-label" style={{ marginTop: 0 }}>Celles qui aident le plus les autres · 4 semaines</p>
                  <p style={{ margin: "6px 0 0", color: "var(--adm-text)", fontWeight: 600 }}>{trend.peerNames.slice(0, 6).map((c) => `${c.name} (${c.count})`).join(" · ")}</p>
                </div>
              ) : null}
              <div className="mda-card" style={{ gridColumn: "span 2" }}>
                <p className="mda-label" style={{ marginTop: 0 }}>Elles veulent plus de</p>
                <p style={{ margin: "6px 0 0", color: "var(--adm-text)", fontWeight: 600 }}>{trend.wants.length ? trend.wants.slice(0, 4).map((w) => `${w.label} (${w.count})`).join(" · ") : "Pas encore de demande"}</p>
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
                            📱 Borne iPad
                          </a>
                          <Link href={`/admin/coaching/sondage/${p.activityId}`} className={done ? "admin-btn-ghost" : "admin-btn-primary"} style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
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
