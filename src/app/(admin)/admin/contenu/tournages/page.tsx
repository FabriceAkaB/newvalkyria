import { PlanSteps, ShootCard, ShootForm } from "@/components/jp-shoots";
import { requireAdmin } from "@/lib/admin-auth";
import { addDaysIso } from "@/lib/content-core";
import { groupShoots, SERIES, type Shoot } from "@/lib/video-shoots-core";
import { getShoots } from "@/lib/video-shoots-repo";

export const metadata = { title: "Tournages — Création de contenu", robots: "noindex" };
export const dynamic = "force-dynamic";

const API = "/api/admin/contenu";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

function List({ items, tomorrow, open = false }: { items: Shoot[]; tomorrow: string; open?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((s) => (
        <ShootCard key={s.id} s={s} tomorrow={tomorrow} open={open} endpoint={API} calendar />
      ))}
    </div>
  );
}

/** Espace Contenu › Tournages : les mêmes tournages que « Mes tournages » de JP (jp_video_shoots), vus par l'équipe
 *  contenu, avec qui filme et quand ça se publie. */
export default async function ContenuTournagesPage() {
  await requireAdmin();
  const today = todayIso();
  const tomorrow = addDaysIso(today, 1);
  const g = groupShoots(await getShoots(), today, tomorrow);
  const planned = [...g.late, ...g.today, ...g.tomorrow, ...g.upcoming];
  const ideasBySeries = SERIES.map((s) => ({ s, items: g.ideas.filter((i) => i.series === s.id) })).filter((x) => x.items.length);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Planifié la veille, tourné sans réfléchir</p>
          <h1 className="mda-h1">Tournages</h1>
          <p className="mda-lead">Chaque vidéo : le message, l&apos;accroche, les plans, qui filme et le jour où elle se publie. Tourné, monté, publié : un bouton à la fois.</p>
        </header>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Planifier une vidéo</h2>
          <details>
            <summary style={{ cursor: "pointer", fontSize: "0.88rem", color: "var(--adm-text-2)" }}>Les 15 minutes de la veille, dans l&apos;ordre</summary>
            <div style={{ margin: "10px 0" }}>
              <PlanSteps />
            </div>
          </details>
          <div style={{ marginTop: 10 }}>
            <ShootForm defaultDate={tomorrow} endpoint={API} calendar />
          </div>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">À tourner ({planned.length})</h2>
          </div>
          <div style={{ padding: "0 16px 16px" }}>{planned.length ? <List items={planned} tomorrow={tomorrow} /> : <p style={{ margin: 0, color: "var(--adm-text-2)" }}>Rien de planifié.</p>}</div>
        </section>

        {g.toFinish.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">À monter et à publier ({g.toFinish.length})</h2>
            </div>
            <div style={{ padding: "0 16px 16px" }}>
              <List items={g.toFinish} tomorrow={tomorrow} />
            </div>
          </section>
        )}

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Idées de vidéos ({g.ideas.length})</h2>
          </div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>
            {ideasBySeries.map(({ s, items }) => (
              <details key={s.id}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.92rem", padding: "4px 0" }}>
                  {s.emoji} {s.label} ({items.length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  <List items={items} tomorrow={tomorrow} />
                </div>
              </details>
            ))}
          </div>
        </section>

        {g.published.length > 0 && (
          <details className="mda-card">
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>✓ Publiées ({g.published.length})</summary>
            <div style={{ marginTop: 10 }}>
              <List items={g.published} tomorrow={tomorrow} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
