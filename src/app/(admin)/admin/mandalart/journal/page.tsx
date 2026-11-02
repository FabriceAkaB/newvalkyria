import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { STATUS_LABEL } from "@/lib/mandalart-core";
import { PLAN } from "@/lib/mandalart-plan";
import { getEvents } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — Journal", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Ce qui se trame » : les derniers changements de statut, qui, quand. */
export default async function MandalartJournalPage() {
  await requireAdmin({ roles: ["admin"] });
  const events = await getEvents(200);
  const titles = new Map(PLAN.pillars.flatMap((p) => p.objectives.flatMap((o) => o.tasks.map((t) => [t.code, t.title] as const))));
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Les 200 derniers changements</p>
            <h1 className="mda-h1">Ce qui se trame</h1>
          </header>
          <section className="mda-card-flush">
            {events.length === 0 ? (
              <p style={{ padding: 20, margin: 0, color: "var(--adm-text-3)" }}>Aucun changement pour l'instant. Cochez une tâche dans « Ce mois-ci » : elle apparaîtra ici.</p>
            ) : (
              <ul className="mda-tasks">
                {events.map((e) => (
                  <li key={e.id} className="mda-task" style={{ display: "block" }}>
                    <p className="mda-task-title">
                      <span className="mda-tnum mda-muted">{e.code}</span> {titles.get(e.code) ?? e.note ?? ""}
                    </p>
                    <div className="mda-task-meta">
                      <span>{new Date(e.at).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })}</span>
                      {e.from_status !== e.to_status ? (
                        <span>
                          {e.from_status ? STATUS_LABEL[e.from_status] : "Nouvelle"} → <strong style={{ color: e.to_status === "fait" ? "var(--adm-good)" : "var(--adm-text)" }}>{e.to_status ? STATUS_LABEL[e.to_status] : ""}</strong>
                        </span>
                      ) : (
                        <span>Note modifiée</span>
                      )}
                      {e.by ? <span>par {e.by}</span> : null}
                    </div>
                    {e.note && titles.has(e.code) ? <p style={{ fontSize: "0.82rem", color: "var(--adm-text-2)", margin: "6px 0 0" }}>{e.note}</p> : null}
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
