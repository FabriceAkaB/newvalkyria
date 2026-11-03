import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { OpenSurveyButton } from "@/components/practice-survey";
import { requireAdmin } from "@/lib/admin-auth";
import { getRecentPracticesForSurvey, getSurveyTrend } from "@/lib/practice-survey-repo";
import { todayIso } from "@/lib/practices-repo";

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

/** « Comment les filles ont trouvé la pratique ? » : présence, plaisir, fatigue et ce qu'elles veulent plus. */
export default async function SurveyListPage() {
  await requireAdmin();
  const today = todayIso();
  const [practices, trend] = await Promise.all([getRecentPracticesForSurvey().catch(() => []), getSurveyTrend().catch(() => null)]);
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
            <p className="mda-lead">Marque qui était là, puis chaque fille dit en 3 touches si elle a aimé, sa fatigue et ce qu&apos;elle aimerait avoir plus. Le plaisir alimente l&apos;indicateur « appréciation des joueuses » du Mandalart.</p>
          </header>

          {trend && trend.answered > 0 && (
            <section className="mda-cols-4" aria-label="Les 4 dernières semaines">
              <div className="mda-card"><p className="mda-num">{fr(trend.pleasure)}<span style={{ fontSize: "0.9rem", color: "var(--adm-text-3)" }}>/10</span></p><p className="mda-label">Plaisir moyen · 4 dernières semaines</p></div>
              <div className="mda-card"><p className="mda-num">{fr(trend.fatigue)}<span style={{ fontSize: "0.9rem", color: "var(--adm-text-3)" }}>/10</span></p><p className="mda-label">Fatigue moyenne</p></div>
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
                          {p.present ? <span>{p.present} présente{p.present > 1 ? "s" : ""}</span> : <span>Présences pas encore marquées</span>}
                        </div>
                      </div>
                      <Pill tone={done ? "good" : p.answered ? "warn" : undefined}>{done ? "Sondée" : p.present ? `${p.answered}/${p.present} sondées` : "À faire"}</Pill>
                      {p.activityId ? (
                        <Link href={`/admin/coaching/sondage/${p.activityId}`} className={done ? "admin-btn-ghost" : "admin-btn-primary"} style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
                          {done ? "Voir" : "Faire le sondage"}
                        </Link>
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
