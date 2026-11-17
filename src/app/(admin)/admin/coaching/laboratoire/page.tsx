import { AdminTopbar } from "@/components/admin-topbar";
import { LabDecision } from "@/components/admin-lab-decision";
import { requireAdmin } from "@/lib/admin-auth";
import { LAB_RATING, LAB_STATUS_LABEL } from "@/lib/coach-lab-core";
import { listExperiments } from "@/lib/coach-lab-repo";

export const metadata = { title: "Laboratoire — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Qu'est-ce que les éducateurs testent, et qu'est-ce qui mérite d'entrer dans la méthode ? » */
export default async function AdminLabPage() {
  await requireAdmin();
  const experiments = await listExperiments();
  const ready = experiments.filter((e) => e.status === "concluant");
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · laboratoire des éducateurs</p>
            <h1 className="mda-h1">{ready.length ? `${ready.length} idée${ready.length > 1 ? "s" : ""} concluante${ready.length > 1 ? "s" : ""} à faire entrer dans la méthode` : `${experiments.length} idée${experiments.length > 1 ? "s" : ""} au laboratoire`}</h1>
            <p className="mda-lead">Les éducateurs notent un concept entendu, le testent à une pratique et disent si la séance s&apos;est améliorée (1 à 5). Après 2 essais à 4 ou plus en moyenne : concluant. « Ajouter à la méthode » l&apos;ajoute aux principes de la pédagogie Valkyria.</p>
          </header>
          <section className="mda-card-flush">
            {experiments.length ? (
              <ul className="mda-tasks">
                {experiments.map((e) => (
                  <li key={e.id} className="mda-task" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>{e.title}</p>
                      <div className="mda-task-meta">
                        <span>{LAB_STATUS_LABEL[e.status]}{e.average !== null ? ` · ${e.average.toLocaleString("fr-CA")}/5` : ""} · {e.trials.length} essai{e.trials.length > 1 ? "s" : ""}</span>
                        <span>par {e.createdBy}{e.source ? ` · ${e.source}` : ""}</span>
                        {e.trials.slice(-2).map((t) => (
                          <span key={t.id}>{t.coachName} : {t.rating ? `${t.rating}/5 (${LAB_RATING[t.rating].toLowerCase()})` : ""}{t.observation ? ` · « ${t.observation.slice(0, 140)} »` : ""}</span>
                        ))}
                      </div>
                    </div>
                    <LabDecision id={e.id} status={e.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-empty-text" style={{ padding: 20 }}>Rien encore : les éducateurs ajoutent leurs idées dans leur portail, onglet « Laboratoire ».</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
