import Link from "next/link";

import { PlanSteps, ShootCard, ShootForm } from "@/components/jp-shoots";
import { requireAdmin } from "@/lib/admin-auth";
import { groupShoots, SERIES, type Shoot } from "@/lib/video-shoots-core";
import { getShoots } from "@/lib/video-shoots-repo";

export const metadata = { title: "Mes tournages — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function List({ items, tomorrow, open = false }: { items: Shoot[]; tomorrow: string; open?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((s) => (
        <ShootCard key={s.id} s={s} tomorrow={tomorrow} open={open} />
      ))}
    </div>
  );
}

/** Espace JP › Mes tournages : la vidéo de demain se planifie la veille, en 15 minutes ; le matin, on tourne sans réfléchir. */
export default async function TournagesPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = todayIso();
  const tomorrow = addDays(today, 1);
  const g = groupShoots(await getShoots(), today, tomorrow);
  const ideasBySeries = SERIES.map((s) => ({ s, items: g.ideas.filter((i) => i.series === s.id) })).filter((x) => x.items.length);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Planifié la veille, tourné sans réfléchir</p>
          <h1 className="mda-h1">Mes tournages</h1>
          <p className="mda-lead">
            Chaque soir, 15 minutes : tu choisis la vidéo de demain et tu écris son plan. Le matin, tu tournes. Ensuite : tourné, monté, publié. Les chiffres de la publication
            s&apos;entrent dans <Link href="/admin/reseaux">Réseaux sociaux</Link>.
          </p>
        </header>

        <section className="mda-card" style={{ borderColor: "rgba(180,155,242,0.5)" }}>
          <h2 className="mda-h2" style={{ marginTop: 0 }}>🎬 Demain, {longDay(tomorrow)}</h2>
          {g.tomorrow.length ? (
            <List items={g.tomorrow} tomorrow={tomorrow} open />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.9rem" }}>
                Rien de planifié pour demain. Pioche une idée plus bas (« Planifier pour demain ») ou écris-la ici, dans cet ordre :
              </p>
              <PlanSteps />
              <ShootForm defaultDate={tomorrow} />
            </div>
          )}
        </section>

        {g.today.length + g.late.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Aujourd&apos;hui{g.late.length ? " et en retard" : ""}</h2>
            </div>
            <div style={{ padding: "0 16px 16px" }}>
              <List items={[...g.late, ...g.today]} tomorrow={tomorrow} />
            </div>
          </section>
        )}

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

        {g.upcoming.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Plus tard</h2>
            </div>
            <div style={{ padding: "0 16px 16px" }}>
              <List items={g.upcoming} tomorrow={tomorrow} />
            </div>
          </section>
        )}

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Mes idées de vidéos ({g.ideas.length})</h2>
          </div>
          <div style={{ padding: "0 16px 16px", display: "grid", gap: 10 }}>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--adm-text-2)" }}>
              Les 5 séries de vidéos explicatives pour les parents (Mandalart P3.2.12 à P3.2.17 et P4.1.06) sont déjà là. Une idée qui reçoit un jour devient un tournage planifié.
            </p>
            {ideasBySeries.map(({ s, items }) => (
              <details key={s.id} open={s.id === "academie"}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.92rem", padding: "4px 0" }}>
                  {s.emoji} {s.label} ({items.length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  <List items={items} tomorrow={tomorrow} />
                </div>
              </details>
            ))}
            <details>
              <summary style={{ cursor: "pointer", fontSize: "0.88rem", color: "var(--adm-text-2)" }}>+ Ajouter une idée</summary>
              <div style={{ marginTop: 10 }}>
                <ShootForm />
              </div>
            </details>
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
