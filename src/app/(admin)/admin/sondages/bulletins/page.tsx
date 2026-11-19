import { AdminTopbar } from "@/components/admin-topbar";
import { dayLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { periodLabel, summarizeFeedback, usefulLabel, type Useful } from "@/lib/bulletin-feedback";
import { listFeedback } from "@/lib/bulletin-feedback-repo";

export const metadata = { title: "Avis sur les bulletins — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const TONE: Record<Useful, string> = { oui: "var(--adm-good)", en_partie: "var(--adm-warn)", non: "var(--adm-bad)" };

/** « Le bulletin sert-il aux familles ? » (P4.8.11) : la réponse de chaque parent sous le bulletin de sa fille
 *  (oui, en partie, non) et ce qui manque, pour améliorer le prochain bulletin. */
export default async function BulletinFeedbackPage() {
  await requireAdmin();
  const rows = await listFeedback();
  const s = summarizeFeedback(rows);
  const comments = rows.filter((r) => r.missing);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Voix des familles · sondage sous chaque bulletin</p>
            <h1 className="mda-h1">{s.usefulRate !== null ? `${s.usefulRate} % des parents trouvent le bulletin utile` : "Aucune réponse pour l'instant"}</h1>
            <p className="mda-lead">
              Sous le bulletin remis (mi-saison, fin de saison), chaque parent répond « Ce bulletin vous est-il utile ? » et peut dire ce qui manque. Une réponse par parent, par fille et par bulletin ; le parent peut la changer.
            </p>
          </header>

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">{s.total}</p>
              <p className="mda-label">Réponse{s.total > 1 ? "s" : ""}</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">
                <span style={{ color: TONE.oui }}>{s.oui}</span> · <span style={{ color: TONE.en_partie }}>{s.enPartie}</span> · <span style={{ color: TONE.non }}>{s.non}</span>
              </p>
              <p className="mda-label">Oui · En partie · Non</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{s.withComment}</p>
              <p className="mda-label">Disent ce qui manque</p>
            </div>
          </section>

          {comments.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Ce qui manque, selon les parents</h2>
              </div>
              <ul className="mda-tasks">
                {comments.map((r) => (
                  <li key={r.id} className="mda-task" style={{ display: "block" }}>
                    <p style={{ margin: 0, color: "var(--adm-text)" }}>« {r.missing} »</p>
                    <div className="mda-task-meta">
                      <span>{r.parentName ?? r.parentEmail ?? "Parent"}</span>
                      <span>{r.playerName}</span>
                      <span>{periodLabel(r.period)}</span>
                      <span style={{ color: TONE[r.useful] }}>{usefulLabel(r.useful)}</span>
                      <span>{dayLabel(r.updatedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Toutes les réponses</h2>
            </div>
            {rows.length ? (
              <div className="admin-table-wrap mda-scroll" style={{ margin: 0, border: 0, boxShadow: "none" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Joueuse</th>
                      <th>Parent</th>
                      <th>Bulletin</th>
                      <th>Utile ?</th>
                      <th>Ce qui manque</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.playerName}
                          {r.category ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{r.category}</span> : null}
                        </td>
                        <td>{r.parentName ?? r.parentEmail ?? "—"}</td>
                        <td>{periodLabel(r.period)}</td>
                        <td style={{ color: TONE[r.useful], fontWeight: 600 }}>{usefulLabel(r.useful)}</td>
                        <td style={{ maxWidth: 360, color: r.missing ? "var(--adm-text)" : "var(--adm-text-3)" }}>{r.missing ?? "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{dayLabel(r.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mda-muted" style={{ padding: "16px 20px", margin: 0 }}>
                Les réponses arrivent dès qu&apos;un bulletin est remis aux familles (bulletin de mi-saison : 15 décembre).
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
