import { AdminTopbar } from "@/components/admin-topbar";
import { dayLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { periodLabel, summarizeFeedback, usefulLabel, type Useful } from "@/lib/bulletin-feedback";
import { listFeedback } from "@/lib/bulletin-feedback-repo";
import { activeSeasonId, getGateSurvey, getGoogleReviewUrl, listGateStats, syncGoogleLinkTask } from "@/lib/bulletin-gate-repo";
import { currentPeriod } from "@/lib/bulletin-report";
import Link from "next/link";

export const metadata = { title: "Avis sur les bulletins — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const TONE: Record<Useful, string> = { oui: "var(--adm-good)", en_partie: "var(--adm-warn)", non: "var(--adm-bad)" };

/** « Le bulletin sert-il aux familles ? » (P4.8.11) : la réponse de chaque parent sous le bulletin de sa fille
 *  (oui, en partie, non) et ce qui manque, pour améliorer le prochain bulletin. */
export default async function BulletinFeedbackPage() {
  await requireAdmin();
  // Le sondage avant le bulletin (P4.8.18) existe dès maintenant, pour que JP valide ses questions avant le 8 décembre.
  const seasonId = await activeSeasonId();
  await getGateSurvey(seasonId, currentPeriod(seasonId, new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })), { create: true }).catch(() => null);
  const [rows, gates, googleUrl] = await Promise.all([listFeedback(), listGateStats().catch(() => []), getGoogleReviewUrl().catch(() => null), syncGoogleLinkTask().catch(() => undefined)]);
  const s = summarizeFeedback(rows);
  const gate = gates[0] ?? null;
  const comments = rows.filter((r) => r.missing);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Voix des familles · bulletins</p>
            <h1 className="mda-h1">{gate ? `${gate.responded} parent${gate.responded > 1 ? "s ont" : " a"} répondu au sondage avant le bulletin` : "Sondage avant le bulletin"}</h1>
            <p className="mda-lead">
              Le bulletin remis ne s&apos;ouvre qu&apos;après un sondage de 2 minutes, une fois par parent. À 9 ou 10 sur 10, le parent voit « Laisser cet avis sur Google » : son texte est copié et la page d&apos;avis s&apos;ouvre ; c&apos;est lui qui publie, sans aucune récompense.
            </p>
          </header>

          {gates.map((g) => (
            <section key={g.survey.id} className="mda-card" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                <h2 className="mda-h2" style={{ margin: 0 }}>{g.survey.title}</h2>
                <Link href={`/admin/sondages/${g.survey.id}`} className="admin-btn-ghost">
                  {g.responded ? "Voir les réponses" : "Valider les questions"}
                </Link>
              </div>
              {g.responded ? null : (
                <p className="mda-muted" style={{ margin: 0 }}>
                  Questions à valider avant le 8 décembre : elles se modifient dans le sondage jusqu&apos;à la première réponse.
                </p>
              )}
              <div className="mda-cols-3">
                <div><p className="mda-num">{g.responded}<small style={{ fontSize: "0.9rem", color: "var(--adm-text-3)" }}> / {g.invited}</small></p><p className="mda-label">Ont répondu / ont ouvert le bulletin</p></div>
                <div><p className="mda-num">{g.high}</p><p className="mda-label">Donnent 9 ou 10</p></div>
                <div><p className="mda-num">{g.googleClicks}</p><p className="mda-label">Clics vers Google</p></div>
              </div>
              {googleUrl ? null : (
                <p style={{ margin: 0, color: "var(--adm-warn)", fontWeight: 600 }}>
                  Lien d&apos;avis Google manquant : le bouton reste caché. <Link href="/admin/avis" style={{ color: "var(--adm-accent-strong)" }}>Ajouter le lien</Link> (tâche dans Ma journée).
                </p>
              )}
            </section>
          ))}

          <h2 className="mda-h2" style={{ margin: "8px 0 0" }}>
            Sous le bulletin : « Ce bulletin vous est-il utile ? »{s.usefulRate !== null ? ` · ${s.usefulRate} % de oui` : ""}
          </h2>
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
