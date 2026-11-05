import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { QUICK_CRITERIA } from "@/lib/coach-report";
import { getPlayersProgress } from "@/lib/coaching-repo";

export const metadata = { title: "Progression des joueuses — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));

/** « Comment chaque fille progresse-t-elle cette saison ? » : moyennes des évaluations rapides après chaque
 *  pratique, évolution, sa note des pratiques et sa fatigue, présence. */
export default async function PlayersProgressPage() {
  await requireAdmin();
  const players = await getPlayersProgress();
  const evaluated = players.filter((p) => p.evaluations > 0).length;
  const groups = [...new Set(players.map((p) => p.group))];
  // Assiduité (présences du site, alimentées aussi par MonClubSportif chaque soir) : qui s'absente le plus.
  const marked = players.reduce((s, p) => s + p.marked, 0);
  const attended = players.reduce((s, p) => s + p.attended, 0);
  const pct = (a: number, m: number) => `${Math.round((a / m) * 100)} %`;
  const mostAbsent = players.filter((p) => p.marked >= 3 && p.attended < p.marked).sort((a, b) => a.attended / a.marked - b.attended / b.marked || b.marked - a.marked).slice(0, 8);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · saison en cours</p>
            <h1 className="mda-h1">{evaluated ? `${evaluated} joueuse${evaluated > 1 ? "s" : ""} sur ${players.length} déjà évaluée${evaluated > 1 ? "s" : ""}` : `${players.length} joueuses, pas encore d'évaluation`}</h1>
            <p className="mda-lead">Chaque éducateur évalue chaque fille après chaque pratique (ball mastery, prestation, attitude sur 5 et une note) dans son portail. Tout s&apos;accumule ici : à la fin de la saison, on a un vrai portrait de chaque fille.</p>
          </header>

          <section className="mda-card">
            <h2 className="mda-h2">Assiduité{marked ? ` · ${pct(attended, marked)} de présence` : ""}</h2>
            <p className="mda-sub" style={{ marginTop: 0 }}>Présences notées par les éducateurs et, chaque soir, celles de MonClubSportif. Elles font partie de la fiche de chaque joueuse et du bulletin.</p>
            {mostAbsent.length === 0 ? (
              <p className="mda-label" style={{ margin: 0 }}>{marked ? "Personne ne s'absente régulièrement." : "Pas encore assez de présences notées."}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.88rem", lineHeight: 1.6 }}>
                {mostAbsent.map((p) => (
                  <li key={p.registrationId}>
                    <Link href={`/admin/coaching/joueuses/${p.registrationId}`} style={{ fontWeight: 600 }}>{p.name}</Link> · {p.group} · présente {p.attended}/{p.marked} ({pct(p.attended, p.marked)}), {p.marked - p.attended} absence{p.marked - p.attended > 1 ? "s" : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {groups.map((g) => {
            const list = players.filter((p) => p.group === g);
            return (
              <section key={g} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2">{g}</h2>
                  <Pill>{list.length} joueuse{list.length > 1 ? "s" : ""}</Pill>
                </div>
                <div className="admin-table-wrap" style={{ margin: 0 }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Joueuse</th>
                        <th style={{ textAlign: "right" }}>Évaluations</th>
                        {QUICK_CRITERIA.map((c) => (
                          <th key={c} style={{ textAlign: "right" }}>{c}</th>
                        ))}
                        <th style={{ textAlign: "right" }}>Évolution</th>
                        <th style={{ textAlign: "right" }}>Sa note / fatigue</th>
                        <th style={{ textAlign: "right" }}>Présente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p) => (
                        <tr key={p.registrationId}>
                          <td>
                            <Link href={`/admin/coaching/joueuses/${p.registrationId}`} style={{ fontWeight: 600 }}>{p.name}</Link>
                            {p.watch.length > 0 && <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-warn)" }}>{p.watch[0]}</span>}
                          </td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.evaluations}</td>
                          {QUICK_CRITERIA.map((c) => (
                            <td key={c} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fr(p.averages[c])}</td>
                          ))}
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: p.trend === null ? "var(--adm-text-3)" : p.trend >= 0 ? "var(--adm-good)" : "var(--adm-warn)" }}>
                            {p.trend === null ? "—" : `${p.trend >= 0 ? "▲ +" : "▼ "}${fr(p.trend)}`}
                          </td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fr(p.practiceRating)} / {fr(p.fatigue)}</td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.marked ? `${p.attended}/${p.marked} (${pct(p.attended, p.marked)})` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
