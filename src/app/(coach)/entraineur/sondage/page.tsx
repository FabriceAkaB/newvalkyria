import { CoachTopbar } from "@/components/coach-topbar";
import { CoachOfMonthCard, HelperRanking, SummaryTiles, SurveyBlockRow, SurveyPeriodFilter } from "@/components/survey-results";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { parsePeriod } from "@/lib/practice-survey-results-core";
import { getCoachOfMonthHistory, getSurveyResults } from "@/lib/practice-survey-results-repo";
import { getRecentPracticesForSurvey } from "@/lib/practice-survey-repo";
import { todayIso } from "@/lib/practices-repo";
import { kioskPath } from "@/lib/survey-kiosk";

export const metadata = { title: "Sondage des jeunes — Espace Technique" };
export const dynamic = "force-dynamic";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const label = (iso: string, today: string) => {
  if (iso === today) return "Aujourd'hui";
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Portail : la borne iPad du sondage de fin, pour chaque pratique de l'Académie d'aujourd'hui et d'hier (toute
 *  l'équipe y a accès). Ouvrir la borne avant d'arriver au gymnase : elle marche ensuite même sans réseau.
 *  Puis les résultats, comme dans l'admin (JP, 25 nov. 2026) : qui a aidé le plus de filles, le résumé, chaque
 *  pratique (lecture seule, pratiques de l'Académie, aucun montant). */
export default async function CoachSurveyPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string; jours?: string; groupe?: string }> }) {
  const coachId = await requireCoach();
  const today = todayIso();
  const sp = await searchParams;
  const period = parsePeriod(sp, today);
  const group = sp.groupe?.trim() || null;
  const [coach, practices] = await Promise.all([getCoach(coachId), getRecentPracticesForSurvey().catch(() => [])]);
  const active = Boolean(coach && coach.status !== "inactive");
  const results = active ? await getSurveyResults({ from: period.from, to: period.to > today ? today : period.to, group }).catch(() => null) : null;
  const coachMonths = active ? await getCoachOfMonthHistory(today).catch(() => []) : [];
  const list = practices.filter((p) => p.daysLeft >= -1);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide">
          <p className="coach-eyebrow">À la fin de chaque pratique</p>
          <h1 className="coach-title coach-title--xl">Sondage des jeunes</h1>
          <p className="coach-sub" style={{ maxWidth: 680 }}>
            Ouvre la borne sur l&apos;iPad <strong>avant d&apos;arriver au gymnase</strong> : chaque fille touche sa photo et répond seule à 5 questions (plaisir, fatigue, sa coach l&apos;a-t-elle aidée ou encouragée, une amie l&apos;a-t-elle aidée, et ce qu&apos;on a travaillé aujourd&apos;hui). Sans réseau, les réponses restent sur l&apos;iPad et partent toutes seules ensuite.
          </p>
          {list.length === 0 ? (
            <div className="coach-card" style={{ marginTop: 16 }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>Aucune pratique aujourd&apos;hui ni hier.</p>
            </div>
          ) : (
            <div className="coach-today" style={{ marginTop: 16 }}>
              {list.map((p) => {
                const done = p.present > 0 && p.answered >= p.present;
                return (
                  <div key={p.key} className="coach-tcard">
                    <p className="coach-tcard__time">
                      {label(p.date, today)} · {p.start.replace(":", " h ")}
                    </p>
                    <p className="coach-tcard__title">{p.group}</p>
                    <p className="coach-tcard__place">{p.location}</p>
                    <p className="coach-tcard__theme" style={{ color: done ? "var(--adm-good)" : undefined }}>
                      {done ? "Toutes les présentes ont répondu" : p.present ? `${p.answered}/${p.present} ont répondu` : `${p.expected} joueuses attendues`}
                    </p>
                    {p.activityId ? (
                      <a href={kioskPath(p.activityId)} target="_blank" rel="noreferrer" className="coach-primary" style={{ textDecoration: "none", textAlign: "center", marginTop: 8 }}>
                        Ouvrir la borne iPad
                      </a>
                    ) : (
                      <p className="coach-muted" style={{ margin: "8px 0 0" }}>La borne s&apos;ouvre dès que la pratique est créée (présences ou plan).</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {results ? (
            <div className="mda" style={{ display: "grid", gap: 16, marginTop: 32 }}>
              <div>
                <h2 className="coach-title" style={{ margin: 0 }}>Ce que les filles ont répondu</h2>
                <p className="coach-sub" style={{ maxWidth: 680 }}>Toutes les pratiques de l&apos;Académie, même celles où tu n&apos;étais pas. Touche une pratique pour voir le classement, le résumé et la réponse de chaque fille.</p>
              </div>
              <CoachOfMonthCard months={coachMonths} viewerId={coachId} />
              <section className="mda-card">
                <SurveyPeriodFilter action="/entraineur/sondage" from={period.from} to={period.to} days={period.days} groups={results.groups} group={group} />
              </section>
              <section className="mda-card" style={{ display: "grid", gap: 12 }}>
                <div>
                  <h2 className="mda-h2" style={{ margin: 0 }}>Qui a aidé ou encouragé le plus de filles</h2>
                  <p style={{ margin: "4px 0 0", color: "var(--adm-text-2)", fontSize: "0.875rem" }}>Sur la période, combien de filles ont nommé chaque éducateur à « Ta coach t&apos;a-t-elle aidée ou encouragée ? ». Une fille aidée à deux pratiques compte deux fois.</p>
                </div>
                <HelperRanking ranking={results.ranking} viewerId={coachId} period />
              </section>
              {results.summary.respondents ? (
                <section style={{ display: "grid", gap: 12 }}>
                  <h2 className="mda-h2" style={{ margin: 0 }}>Le résumé de la période</h2>
                  <SummaryTiles summary={results.summary} />
                </section>
              ) : null}
              <section className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2">Pratique par pratique</h2>
                </div>
                {results.blocks.length ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {results.blocks.map((b) => (
                      <SurveyBlockRow key={b.activityId} block={b} href={`/entraineur/sondage/${b.activityId}`} viewerId={coachId} />
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, padding: "16px 20px 20px", color: "var(--adm-text-2)", fontSize: "0.875rem" }}>Aucune réponse de la borne sur cette période.</p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
