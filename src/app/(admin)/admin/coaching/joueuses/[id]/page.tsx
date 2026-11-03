import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { BulletinView } from "@/components/bulletin-view";
import { requireAdmin } from "@/lib/admin-auth";
import { getBulletinData } from "@/lib/coach-portal-repo";
import { CONTEXT_LABEL, formatGain, LEVEL_LABEL, progressFor } from "@/lib/skill-tests";
import { getPointsSummaries } from "@/lib/player-points-repo";
import { getResults, getTests } from "@/lib/skill-tests-repo";

const fr = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 1 });
export const metadata = { title: "Saison d'une joueuse — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** La saison d'une joueuse vue par l'équipe : présences, moyennes, évolution, sa note des pratiques et les notes
 *  internes des éducateurs (la version parent, dans l'espace famille, ne montre pas ces notes). */
export default async function PlayerSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [data, tests, results, points] = await Promise.all([getBulletinData(id, "equipe"), getTests({ activeOnly: true }), getResults([id]), getPointsSummaries([id]).then((m) => m.get(id) ?? null)]);
  if (!data) notFound();

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <Link href="/admin/coaching/joueuses" className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
            ← Progression des joueuses
          </Link>
          <BulletinView data={data} />

          {points && (
            <div className="mda" style={{ maxWidth: 720, marginTop: 24 }}>
              <h2 className="mda-h2">Points</h2>
              <section className="mda-card" style={{ marginTop: 12 }}>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>{points.balance} points à échanger</p>
                <p className="mda-lead" style={{ margin: "4px 0 0" }}>
                  {points.presences} présence{points.presences > 1 ? "s" : ""} · {points.victoires} victoire{points.victoires > 1 ? "s" : ""} · {points.attitudes} fois l&apos;attitude du jour
                  {points.spent ? ` · ${points.spent} points déjà échangés` : ""}. <Link href="/admin/coaching/points">Points et récompenses</Link>
                </p>
              </section>
            </div>
          )}

          <div className="mda" style={{ maxWidth: 720, marginTop: 24 }}>
            <h2 className="mda-h2">Tests de progression</h2>
            {results.length === 0 ? (
              <p className="admin-empty-text">Pas encore de test. <Link href="/admin/coaching/tests">Saisir son test du jour 1</Link></p>
            ) : (
              tests.map((t) => {
                const pr = progressFor(t, results);
                if (!pr) return null;
                const own = results.filter((r) => r.test_id === t.id);
                return (
                  <section key={t.id} className="mda-card" style={{ marginTop: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                      {t.name} : {fr(pr.last.score)} {t.unit}
                      {pr.level ? ` · niveau ${LEVEL_LABEL[pr.level]}` : ""}
                    </p>
                    <p className="mda-lead" style={{ margin: "4px 0 8px" }}>
                      Depuis son premier test : {formatGain(t, pr.sinceFirst)} · depuis le précédent : {formatGain(t, pr.sincePrevious)}
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.85rem" }}>
                      {own.map((r) => (
                        <li key={r.id}>
                          {r.tested_on} · {CONTEXT_LABEL[r.context]} · {fr(r.score)} {t.unit}
                          {r.video_url ? <> · <a href={r.video_url} target="_blank" rel="noreferrer">vidéo</a></> : null}
                          {r.note ? ` · ${r.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
