import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
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
 *  l'équipe y a accès). Ouvrir la borne avant d'arriver au gymnase : elle marche ensuite même sans réseau. */
export default async function CoachSurveyPage() {
  const coachId = await requireCoach();
  const today = todayIso();
  const [coach, practices] = await Promise.all([getCoach(coachId), getRecentPracticesForSurvey().catch(() => [])]);
  const list = practices.filter((p) => p.daysLeft >= -1);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide">
          <p className="coach-eyebrow">À la fin de chaque pratique</p>
          <h1 className="coach-title coach-title--xl">Sondage des jeunes</h1>
          <p className="coach-sub" style={{ maxWidth: 680 }}>
            Ouvre la borne sur l&apos;iPad <strong>avant d&apos;arriver au gymnase</strong> : chaque fille touche sa photo et répond seule à 5 questions (plaisir, fatigue, apprentissage, compréhension, confiance). Sans réseau, les réponses restent sur l&apos;iPad et partent toutes seules ensuite.
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
                      {done ? "✓ Toutes les présentes ont répondu" : p.present ? `${p.answered}/${p.present} ont répondu` : `${p.expected} joueuses attendues`}
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
        </div>
      </div>
    </>
  );
}
