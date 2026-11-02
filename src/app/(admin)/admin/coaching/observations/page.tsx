import { AdminTopbar } from "@/components/admin-topbar";
import { ObservationForm, ShareToggle } from "@/components/coach-observations";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { notObservedThisMonth, OBSERVATION_CRITERIA, SCORE_LABEL } from "@/lib/coach-observations";
import { coachActivitiesInRange, listObservations } from "@/lib/coach-observations-repo";
import { getCoaches } from "@/lib/coaches-repo";

export const metadata = { title: "Observations des coachs — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** « Est-ce que chaque coach applique la méthode ? » : une séance observée et filmée par coach chaque mois (P1.4.03). */
export default async function CoachObservationsPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const month = today.slice(0, 7);
  const [coaches, observations, recent] = await Promise.all([getCoaches(), listObservations(), coachActivitiesInRange(addDays(today, -45), today)]);
  const active = coaches.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }));
  const worked = new Set(recent.filter((a) => a.date.startsWith(month)).map((a) => a.coachId));
  const missing = notObservedThisMonth(active, worked, observations, month);
  const thisMonth = observations.filter((o) => o.observed_on.startsWith(month));

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · formation des coachs</p>
            <h1 className="mda-h1">
              {worked.size === 0 ? `Aucun éducateur n'a encore travaillé en ${MONTHS[Number(month.slice(5)) - 1]}` : missing.length ? `${missing.length} éducateur${missing.length > 1 ? "s" : ""} à observer ce mois-ci` : "Chaque éducateur a été observé ce mois-ci"}
            </h1>
            <p className="mda-lead">Une séance filmée par coach chaque mois, notée selon la règle du coach (5 critères, sur 10), avec un retour : points forts, à améliorer et un seul focus pour le mois suivant. Le retour publié apparaît dans le portail de l&apos;éducateur.</p>
          </header>

          {missing.length > 0 && (
            <section className="mda-card">
              <h2 className="mda-h2" style={{ marginBottom: 8 }}>À observer en {MONTHS[Number(month.slice(5)) - 1]}</h2>
              <p className="mda-lead" style={{ margin: 0 }}>{missing.map((m) => m.name).join(", ")}</p>
            </section>
          )}

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginBottom: 12 }}>Nouvelle observation</h2>
            <ObservationForm coaches={active} activities={recent} defaultCoachId={missing[0]?.id} />
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Observations</h2>
              <Pill>{thisMonth.length} ce mois-ci</Pill>
            </div>
            {observations.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Aucune observation pour l&apos;instant.</p>
            ) : (
              <ul className="mda-tasks">
                {observations.map((o) => (
                  <li key={o.id} className="mda-task" style={{ alignItems: "flex-start" }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>
                        {o.coach_name} · {dayLabel(o.observed_on)} · {o.total ?? "—"}/10
                      </p>
                      <div className="mda-task-meta">
                        {o.activity_label && <span>{o.activity_label}</span>}
                        {OBSERVATION_CRITERIA.filter((c) => o.scores?.[c.key] !== undefined && o.scores[c.key]! < 2).map((c) => (
                          <span key={c.key} style={{ color: "var(--adm-warn)" }}>{c.label} : {SCORE_LABEL[o.scores[c.key]!]}</span>
                        ))}
                        {o.next_focus && <span>Focus : {o.next_focus}</span>}
                        {o.video_url && <a href={o.video_url} target="_blank" rel="noreferrer">Vidéo</a>}
                      </div>
                    </div>
                    <Pill tone={o.shared_at ? "good" : undefined}>{o.shared_at ? "Publié" : "Brouillon"}</Pill>
                    <ShareToggle id={o.id} shared={Boolean(o.shared_at)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
