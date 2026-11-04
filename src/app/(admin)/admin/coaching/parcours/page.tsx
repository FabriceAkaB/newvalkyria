import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { CYCLE_COACH, JOUEUSE, LIEN, PARCOURS_FAMILLE, PROFIL, STATUS_LABEL, STRUCTURE, type ParcoursStep } from "@/lib/parcours-valkyria";

export const metadata = { title: "Parcours Valkyria — Coaching", robots: "noindex" };

function Steps({ steps }: { steps: ParcoursStep[] }) {
  return (
    <ol className="pv-steps">
      {steps.map((s) => (
        <li key={s.title} className="pv-step">
          <p className="pv-step-title">
            {s.title}
            {s.when ? <span>{s.when}</span> : null}
          </p>
          <ul className="pv-items">
            {s.items.map((it) => (
              <li key={it.text} data-status={it.status}>
                <span className="pv-dot" aria-label={STATUS_LABEL[it.status]} title={STATUS_LABEL[it.status]} />
                <span>
                  {it.text}
                  {it.where ? <small> · {it.where}</small> : null}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

const count = (steps: ParcoursStep[]) => {
  const all = steps.flatMap((s) => s.items);
  return { done: all.filter((i) => i.status === "en-place").length, total: all.length };
};

/** « Qui sont nos clientes, que vivent les familles, que retire la joueuse, comment travaille le coach ? » */
export default async function ParcoursPage() {
  await requireAdmin();
  const fam = count(PARCOURS_FAMILLE);
  const coach = count(CYCLE_COACH);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 900 }}>
          <header>
            <p className="mda-eyebrow">Espace coaching · la feuille de route de l&apos;Académie</p>
            <h1 className="mda-h1">Le parcours Valkyria</h1>
            <p className="mda-lead">
              De la découverte à la réinscription : ce que la famille vit et reçoit, ce que la joueuse en retire, le cycle de travail du coach et comment tout est relié.
              Famille : {fam.done} sur {fam.total} étapes en place. Coach : {coach.done} sur {coach.total}.
            </p>
            <p className="pv-legend">
              <span data-status="en-place"><span className="pv-dot" /> En place dans le site</span>
              <span data-status="en-cours"><span className="pv-dot" /> En cours</span>
              <span data-status="prevu"><span className="pv-dot" /> Prévu (tâche du Mandalart)</span>
            </p>
          </header>

          <section className="mda-card">
            <h2 className="mda-h2">Nos clientes</h2>
            <div className="pv-grid">
              {PROFIL.map((p) => (
                <div key={p.title} className="pv-tile"><strong>{p.title}</strong><p>{p.text}</p></div>
              ))}
            </div>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Le parcours de la famille</h2>
            <Steps steps={PARCOURS_FAMILLE} />
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Ce que la joueuse en retire</h2>
            <div className="pv-grid">
              {JOUEUSE.map((p) => (
                <div key={p.title} className="pv-tile"><strong>{p.title}</strong><p>{p.text}</p></div>
              ))}
            </div>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Le cycle de travail du coach</h2>
            <Steps steps={CYCLE_COACH} />
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Le lien entre le coaching et la famille</h2>
            <p className="mda-sub" style={{ marginTop: 0 }}>Ce que le coach saisit sur le terrain devient ce que la famille voit et ce que JP pilote.</p>
            <div className="pv-links">
              {LIEN.map((l) => (
                <div key={l.coach} className="pv-link">
                  <div><small>Le coach</small><p>{l.coach}</p></div>
                  <div><small>La famille</small><p>{l.famille}</p></div>
                  <div><small>JP</small><p>{l.jp}</p></div>
                </div>
              ))}
            </div>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Qui fait quoi</h2>
            <div className="pv-grid">
              {STRUCTURE.map((p) => (
                <div key={p.role} className="pv-tile"><strong>{p.role}</strong><p>{p.text}</p></div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
