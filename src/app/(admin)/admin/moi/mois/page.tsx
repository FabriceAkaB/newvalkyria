import { DayList, DelegatedRow, type DayEntryItem } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { getJpMonth, monthLabelFr } from "@/lib/team-tasks-repo";

export const metadata = { title: "Mon mois — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

/** La liste du mois (aussi envoyée par courriel le 1er) : ce qui est à JP et ce qu'il a confié, à suivre. */
export default async function MonMoisPage() {
  await requireAdmin({ roles: ["admin"] });
  const m = await getJpMonth();
  const item = (e: (typeof m.mine)[number]): DayEntryItem => ({ ...e, late: e.bucket === "retard" });
  const late = m.mine.filter((e) => e.bucket === "retard");
  const lateDelegated = m.delegatedOpen.filter((t) => t.due && t.due < m.today);
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">La liste du 1er du mois, à suivre jusqu&apos;à la fin</p>
          <h1 className="mda-h1" style={{ textTransform: "none" }}>Mon mois de {monthLabelFr(m.month)}</h1>
          <p className="mda-lead">Le 1er de chaque mois à 8 h, tu reçois cette liste par courriel. Coche ce que tu fais, confie ce qu&apos;un autre peut faire, et suis ce que tu as confié.</p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num" style={{ color: late.length ? "var(--adm-warn)" : undefined }}>{m.mine.length}</p>
            <p className="mda-label">À moi ce mois-ci{late.length ? ` · ${late.length} en retard` : ""}</p>
          </div>
          <div className="mda-card">
            <p className="mda-num" style={{ color: lateDelegated.length ? "var(--adm-warn)" : undefined }}>{m.delegatedOpen.length}</p>
            <p className="mda-label">Confiées, à suivre{lateDelegated.length ? ` · ${lateDelegated.length} en retard` : ""}</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{m.doneLastMonth + m.delegatedDoneLastMonth.length}</p>
            <p className="mda-label">
              Faites le mois passé ({m.doneLastMonth} par moi, {m.delegatedDoneLastMonth.length} par l&apos;équipe)
            </p>
          </div>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">À moi</h2>
          </div>
          <DayList entries={m.mine.map(item)} empty="Rien à ton nom ce mois-ci." />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Confiées, à suivre</h2>
          </div>
          {m.delegatedOpen.length ? (
            <ul className="mda-tasks">
              {m.delegatedOpen.map((t) => (
                <DelegatedRow
                  key={t.id}
                  t={{ id: t.id, title: t.title, assignee: t.assignee, due: t.due, status: t.status, late: !!t.due && t.due < m.today, seen: !!t.seen_at, doneNote: t.done_note, evidenceUrl: t.evidence_url, code: t.mandalart_code, doneAt: t.done_at }}
                />
              ))}
            </ul>
          ) : (
            <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>Rien de confié en cours.</p>
          )}
        </section>

        {m.delegatedDoneLastMonth.length ? (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Faites par l&apos;équipe le mois passé</h2>
            </div>
            <ul className="mda-tasks">
              {m.delegatedDoneLastMonth.map((t) => (
                <DelegatedRow key={t.id} t={{ id: t.id, title: t.title, assignee: t.assignee, due: t.due, status: t.status, late: false, seen: true, doneNote: t.done_note, evidenceUrl: t.evidence_url, code: t.mandalart_code, doneAt: t.done_at }} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
