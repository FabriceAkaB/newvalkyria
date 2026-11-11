import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { OUTCOME_LABEL, evalLabel, matchDayLabel, matchesPlayerQuery, minutesLabel, seasonLabel, seasonStartYear, type PlayerStat } from "@/lib/match-results-core";
import { getPlayerMatchStats, type MatchScope } from "@/lib/match-results";

export const metadata = { title: "Joueuses en match — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function PlayerGames({ p }: { p: PlayerStat }) {
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head">
        <div>
          <h2 className="mda-h2">{p.name}</h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            {plural(p.matches, "match joué", "matchs joués")}
            {p.starts ? `, ${p.starts} comme titulaire` : ""}
            {p.timedMatches ? ` · ${p.minutes} min (${p.avgMinutes} min par match chronométré)` : ""}
            {p.evalAvg !== null ? ` · note moyenne ${evalLabel(p.evalAvg)}` : ""}
          </p>
        </div>
        <Pill tone={p.wins > p.losses ? "good" : undefined}>
          {p.wins}-{p.draws}-{p.losses}
        </Pill>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {p.games.map((g) => (
          <li key={g.matchId} style={{ borderTop: "1px solid var(--adm-line)" }}>
            <Link href={`/admin/matchs/resultats/${g.matchId}`} style={{ display: "flex", gap: 12, padding: "12px 20px", textDecoration: "none", color: "inherit", alignItems: "center", minHeight: 48 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: "0.9rem", color: "var(--adm-text)" }}>
                {matchDayLabel(g.date)} · contre {g.opponent ?? "adversaire"}
                <span className="mda-muted" style={{ fontSize: "0.8rem" }}>
                  {g.starter === true ? " · titulaire" : g.starter === false ? " · remplaçante" : ""}
                  {g.outcome ? ` · ${OUTCOME_LABEL[g.outcome].toLowerCase()}` : ""}
                </span>
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "0.85rem", color: "var(--adm-text-2)", whiteSpace: "nowrap" }}>
                {minutesLabel(g.minutes)} · {evalLabel(g.evalAvg)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** « Combien de matchs chaque joueuse a joués, combien de minutes, et sa note ? » (ex. Charlotte) */
export default async function PlayerMatchStatsPage({ searchParams }: { searchParams: Promise<{ q?: string; saison?: string; vue?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const current = seasonStartYear(today);
  const season = /^\d{4}$/.test(sp.saison ?? "") ? Number(sp.saison) : current;
  const scope: MatchScope = sp.vue === "hors" ? "hors" : "academie";
  const q = (sp.q ?? "").slice(0, 60).trim();
  const res = await getPlayerMatchStats(season, today, scope);
  const shown = res.stats.filter((p) => matchesPlayerQuery(p.name, q));
  const focus = q && shown.length > 0 && shown.length <= 3 ? shown : [];
  const totalMinutes = res.stats.reduce((s, p) => s + p.minutes, 0);
  const played = res.activityMatches + res.slotOnlyMatches;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              {seasonLabel(season)} · {scope === "hors" ? "hors Académie" : "New Valkyria"}
            </p>
            <h1 className="mda-h1">{res.stats.length ? `${plural(res.stats.length, "joueuse a joué", "joueuses ont joué")} au moins un match` : "Aucune joueuse notée en match encore"}</h1>
            <p className="mda-lead">
              {played
                ? `${plural(res.trackedMatches, "match suivi", "matchs suivis")} sur ${plural(played, "match joué", "matchs joués")} (alignement, chronomètre ou évaluations).`
                : "Aucun match joué cette saison."}{" "}
              Une joueuse compte pour un match quand elle est dans l&apos;alignement, a des minutes au chronomètre ou une évaluation.
              {res.slotOnlyMatches ? ` ${plural(res.slotOnlyMatches, "plage vendue n'a", "plages vendues n'ont")} pas d'activité, donc pas de joueuses rattachées.` : ""}
            </p>
          </header>

          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="search">
            {scope === "hors" ? <input type="hidden" name="vue" value="hors" /> : null}
            {season !== current ? <input type="hidden" name="saison" value={season} /> : null}
            <input className="admin-input" type="search" name="q" defaultValue={q} placeholder="Chercher une joueuse (ex. Charlotte)" aria-label="Chercher une joueuse" style={{ flex: "1 1 240px", minHeight: 44 }} />
            <button type="submit" className="admin-btn-primary" style={{ minHeight: 44 }}>
              Chercher
            </button>
            {q ? (
              <Link href={`/admin/matchs/resultats/joueuses${scope === "hors" ? "?vue=hors" : ""}`} className="admin-btn-ghost" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                Tout voir
              </Link>
            ) : null}
          </form>

          {focus.map((p) => (
            <PlayerGames key={p.key} p={p} />
          ))}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">{q ? `Résultats pour « ${q} »` : "Toutes les joueuses"}</h2>
              <Pill>{totalMinutes ? `${totalMinutes} min au total` : plural(shown.length, "joueuse", "joueuses")}</Pill>
            </div>
            {shown.length ? (
              <div className="admin-table-wrap" style={{ margin: 0 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Joueuse</th>
                      <th style={{ textAlign: "right" }}>Matchs</th>
                      <th style={{ textAlign: "right" }}>Titulaire</th>
                      <th style={{ textAlign: "right" }}>Minutes</th>
                      <th style={{ textAlign: "right" }}>Moy. / match</th>
                      <th style={{ textAlign: "right" }}>Note</th>
                      <th style={{ textAlign: "right" }}>V-N-D</th>
                      <th>Dernier match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.key}>
                        <td>
                          <Link href={`/admin/matchs/resultats/joueuses?q=${encodeURIComponent(p.name)}${scope === "hors" ? "&vue=hors" : ""}`} style={{ fontWeight: 600 }}>
                            {p.name}
                          </Link>
                          {p.birthYear ? <span className="mda-muted"> · {p.birthYear}</span> : null}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{p.matches}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.starts}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.timedMatches ? p.minutes : "—"}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{minutesLabel(p.avgMinutes)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{evalLabel(p.evalAvg)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {p.wins}-{p.draws}-{p.losses}
                        </td>
                        <td>{p.lastDate ? matchDayLabel(p.lastDate) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mda-sub" style={{ padding: "0 20px 16px", margin: 0 }}>
                {q
                  ? `Aucune joueuse « ${q} » n'a joué de match noté cette saison.`
                  : "Les statistiques se remplissent dès qu'un match a un alignement, un chronomètre ou des évaluations (activité du match dans Entraînements ou portail des éducateurs)."}
              </p>
            )}
          </section>

          <p className="mda-sub" style={{ margin: 0 }}>
            <Link href={`/admin/matchs/resultats${scope === "hors" ? "?vue=hors" : ""}`} style={{ color: "var(--adm-accent)" }}>
              Nos matchs
            </Link>
            {scope === "hors" ? (
              <>
                {" · "}
                <Link href="/admin/matchs/resultats/joueuses" style={{ color: "var(--adm-accent)" }}>
                  Joueuses de l&apos;Académie
                </Link>
              </>
            ) : (
              <>
                {" · "}
                <Link href="/admin/matchs/resultats/joueuses?vue=hors" style={{ color: "var(--adm-accent)" }}>
                  Matchs hors Académie
                </Link>
              </>
            )}
            {season === current ? (
              <>
                {" · "}
                <Link href={`/admin/matchs/resultats/joueuses?saison=${current - 1}${scope === "hors" ? "&vue=hors" : ""}`} style={{ color: "var(--adm-accent)" }}>
                  Bilan {seasonLabel(current - 1).toLowerCase()}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </>
  );
}
