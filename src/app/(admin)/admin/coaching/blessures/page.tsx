import { AdminTopbar } from "@/components/admin-topbar";
import { IncidentRow } from "@/components/admin-incidents";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { listIncidents } from "@/lib/player-incidents-repo";

export const metadata = { title: "Blessures — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Qui est blessée, et est-ce qu'on a appelé la famille ? » Les éducateurs remplissent la fiche dans leur portail
 *  (étape « Pendant ») ; chaque fiche ouverte est aussi une tâche dans Aujourd'hui, cochée au retour au jeu. */
export default async function IncidentsPage() {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const all = await listIncidents();
  const open = all.filter((i) => i.status !== "fermee");
  const closed = all.filter((i) => i.status === "fermee").slice(0, 30);
  const toCall = open.filter((i) => !i.parentNotified).length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · santé des joueuses</p>
            <h1 className="mda-h1">
              {toCall ? `${toCall} famille${toCall > 1 ? "s" : ""} à appeler` : open.length ? `${open.length} joueuse${open.length > 1 ? "s" : ""} en suivi` : "Aucune blessure en cours"}
            </h1>
            <p className="mda-lead">
              Les éducateurs signalent une blessure, un choc à la tête ou un malaise pendant la pratique, avec les premiers soins. Un choc à la tête arrête la joueuse pour la journée, sans retour au jeu sans avis médical. Chaque fiche ouverte est une tâche « appeler la famille » dans Aujourd&apos;hui.
            </p>
          </header>

          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">En cours</h2><Pill tone={open.length ? "warn" : "good"}>{open.length}</Pill></div>
            {open.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{open.map((i) => <IncidentRow key={i.id} initial={i} />)}</ul>
            ) : (
              <p style={{ margin: 0, padding: "14px 16px", color: "var(--adm-text-2)" }}>Rien à suivre. Les fiches arrivent du portail des éducateurs (« Blessure ou malaise », étape « Pendant »).</p>
            )}
          </section>

          {closed.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head"><h2 className="mda-h2">De retour au jeu</h2><Pill>{closed.length}</Pill></div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{closed.map((i) => <IncidentRow key={i.id} initial={i} />)}</ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
