import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { TestCatalog, TestEntry } from "@/components/coaching-tests";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { formatGain, jour1Coverage, LEVEL_LABEL, progressFor } from "@/lib/skill-tests";
import { getResults, getSeasonPlayers, getTests } from "@/lib/skill-tests-repo";

export const metadata = { title: "Tests et passeport — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 1 });

/** « Où en est chaque fille dans ses tests, comparée à elle-même ? » (Mandalart P1.2, P1.5.03). */
export default async function TestsPassportPage() {
  await requireAdmin();
  const [allTests, players] = await Promise.all([getTests(), getSeasonPlayers()]);
  const tests = allTests.filter((t) => t.active);
  const results = await getResults(players.map((p) => p.registrationId));
  const cov = jour1Coverage(players.map((p) => p.registrationId), results);
  const groups = [...new Map(players.map((p) => [p.groupKey, p.group])).entries()];
  const toValidate = tests.filter((t) => !t.validated_at).length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · passeport Valkyria</p>
            <h1 className="mda-h1">Test du jour 1 filmé : {cov.filmed} joueuse{cov.filmed > 1 ? "s" : ""} sur {cov.total}</h1>
            <p className="mda-lead">
              Même exercice, même angle, même durée à chaque test. Chaque fille est comparée à elle-même : son jour 1, puis son test du mois précédent, jamais aux autres.
              {toValidate ? ` ${toValidate} test${toValidate > 1 ? "s" : ""} à valider plus bas.` : ""}
            </p>
          </header>

          <section className="mda-cols-4">
            <div className="mda-card">
              <p className="mda-num" style={{ color: cov.percent === 100 ? "var(--adm-good)" : undefined }}>{cov.percent === null ? "—" : `${fr(cov.percent)} %`}</p>
              <p className="mda-label">Jour 1 filmé (cible 100 % au 30 nov.)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{cov.tested}</p>
              <p className="mda-label">Joueuses avec un test du jour 1</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{results.length}</p>
              <p className="mda-label">Résultats dans la feuille de suivi</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{tests.length - toValidate}/{tests.length}</p>
              <p className="mda-label">Tests validés par JP</p>
            </div>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginBottom: 12 }}>Saisir des résultats</h2>
            <TestEntry players={players} tests={tests} results={results} />
          </section>

          <h2 className="mda-h2" style={{ margin: "8px 0 0" }}>Feuille de suivi</h2>
          {groups.map(([key, label]) => {
            const list = players.filter((p) => p.groupKey === key);
            const tested = list.filter((p) => results.some((r) => r.registration_id === p.registrationId)).length;
            return (
              <section key={key} className="mda-card-flush">
                <div className="mda-card-head">
                  <h3 className="mda-h2" style={{ fontSize: "1rem" }}>{label}</h3>
                  <Pill tone={tested === list.length ? "good" : undefined}>{tested}/{list.length} testées</Pill>
                </div>
                <div className="admin-table-wrap" style={{ margin: 0 }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Joueuse</th>
                        {tests.map((t) => <th key={t.id} style={{ textAlign: "right" }}>{t.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p) => {
                        const own = results.filter((r) => r.registration_id === p.registrationId);
                        return (
                          <tr key={p.registrationId}>
                            <td><Link href={`/admin/coaching/joueuses/${p.registrationId}`}>{p.firstName} {p.lastName}</Link></td>
                            {tests.map((t) => {
                              const pr = progressFor(t, own);
                              if (!pr) return <td key={t.id} style={{ textAlign: "right", color: "var(--adm-text-3)" }}>—</td>;
                              const filmed = own.some((r) => r.test_id === t.id && r.context === "jour-1" && r.video_url);
                              return (
                                <td key={t.id} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                  <strong>{fr(pr.last.score)}</strong> {t.unit}
                                  {pr.level && <span style={{ display: "block", fontSize: "0.72rem", color: "var(--adm-accent)" }}>{LEVEL_LABEL[pr.level]}</span>}
                                  {pr.sincePrevious !== null && (
                                    <span style={{ display: "block", fontSize: "0.72rem", color: pr.sincePrevious >= 0 ? "var(--adm-good)" : "var(--adm-warn)" }}>{formatGain(t, pr.sincePrevious)}</span>
                                  )}
                                  {!filmed && <span style={{ display: "block", fontSize: "0.72rem", color: "var(--adm-text-3)" }}>Jour 1 pas filmé</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section>
            <h2 className="mda-h2" style={{ marginBottom: 4 }}>Les tests du passeport</h2>
            <p className="mda-lead" style={{ marginTop: 0 }}>Propositions de départ (P1.2.01) : ajuste le protocole et le score de chaque niveau (bronze, argent, or, mauve), puis valide. Les seuils vides n&apos;attribuent aucun niveau.</p>
            <TestCatalog tests={allTests} />
          </section>
        </div>
      </div>
    </>
  );
}
