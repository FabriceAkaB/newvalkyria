import { DelegatedRow } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { bucketOf } from "@/lib/team-tasks-core";
import { listTeamTasks } from "@/lib/team-tasks-repo";
import { todayIso } from "@/lib/mandalart-repo";

export const metadata = { title: "Tâches confiées — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Tout ce que JP a confié, personne par personne : à faire, en cours, en retard, fait (avec la note et le lien). */
export default async function TachesConfieesPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = todayIso();
  const tasks = (await listTeamTasks()).filter((t) => t.assignee !== "JP");
  const people = [...new Set(tasks.map((t) => t.assignee))].sort((a, b) => a.localeCompare(b, "fr"));
  const open = tasks.filter((t) => t.status === "a_faire" || t.status === "en_cours");
  const late = open.filter((t) => bucketOf(t.due, today) === "retard");
  const item = (t: (typeof tasks)[number]) => ({ id: t.id, title: t.title, assignee: t.assignee, due: t.due, status: t.status, late: bucketOf(t.due, today) === "retard", seen: !!t.seen_at, doneNote: t.done_note, evidenceUrl: t.evidence_url, code: t.mandalart_code, doneAt: t.done_at });
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Ce que tu n&apos;as plus à porter</p>
          <h1 className="mda-h1">{open.length ? `${open.length} tâche${open.length > 1 ? "s" : ""} confiée${open.length > 1 ? "s" : ""} en cours` : "Tâches confiées"}</h1>
          <p className="mda-lead">
            Chaque personne reçoit un courriel avec son lien, un rappel la veille de l&apos;échéance, puis aux 2 jours si c&apos;est en retard. Tu es avisé dès qu&apos;elle s&apos;en occupe ou que c&apos;est fait. Une tâche du Mandalart confiée s&apos;y coche toute seule.
            {late.length ? ` ${late.length} en retard.` : ""}
          </p>
        </header>
        {people.length === 0 ? (
          <section className="mda-card">
            <p className="mda-sub" style={{ margin: 0 }}>Rien de confié pour l&apos;instant. Dans « Ma journée » ou dans le Mandalart, touche « Confier » sur une tâche.</p>
          </section>
        ) : (
          people.map((p) => {
            const mine = tasks.filter((t) => t.assignee === p);
            const sorted = [...mine.filter((t) => t.status === "a_faire" || t.status === "en_cours"), ...mine.filter((t) => t.status === "fait"), ...mine.filter((t) => t.status === "abandonne")];
            return (
              <section key={p} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2">{p}</h2>
                  <span className="mda-sub" style={{ margin: 0 }}>
                    {mine.filter((t) => t.status === "a_faire" || t.status === "en_cours").length} en cours · {mine.filter((t) => t.status === "fait").length} faite{mine.filter((t) => t.status === "fait").length > 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="mda-tasks">
                  {sorted.slice(0, 40).map((t) => (
                    <DelegatedRow key={t.id} t={item(t)} />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
