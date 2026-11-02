import { AdminTopbar } from "@/components/admin-topbar";
import { Bar, capitalize, monthLabel, moneyDollars, pctLabel } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { PLAN } from "@/lib/mandalart-plan";
import { getMandalartOverview } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — Trajectoire", robots: "noindex" };
export const dynamic = "force-dynamic";

const LINES: { key: string; label: string }[] = [
  { key: "academie", label: "Académie (automne-hiver)" },
  { key: "valkyriaEte", label: "Valkyria Été (soirs)" },
  { key: "camps", label: "Camps (été, relâche, Fêtes)" },
  { key: "parascolaire", label: "Parascolaire" },
  { key: "commandites", label: "Commandites" },
  { key: "autres", label: "Élite, kits, tournoi, fêtes, Home Lab" },
  { key: "conseil", label: "Conseil aux clubs" }
];

/** Encaissements mois par mois : cible, plancher et réel (module Revenus), de novembre 2026 à décembre 2028. */
export default async function MandalartTrajectoryPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  const months = PLAN.trajectory.months;
  const actual = (m: string) => (m <= o.today.slice(0, 7) ? (o.figures.monthsCents[m] ?? 0) / 100 : null);
  // Cumul réel, comparé au cumul visé du plan (qui part de novembre en 2026, de janvier ensuite)
  const cumul = new Map<string, number | null>();
  let running = 0;
  let year = "";
  for (const m of months) {
    if (m.month.slice(0, 4) !== year) {
      year = m.month.slice(0, 4);
      running = 0;
    }
    const a = actual(m.month);
    if (a === null) cumul.set(m.month, null);
    else {
      running += a;
      cumul.set(m.month, running);
    }
  }
  const nowMonth = o.today.slice(0, 7);
  const cur = months.find((m) => m.month === nowMonth);
  const curCumul = cumul.get(nowMonth) ?? null;
  const floorCumul = months.filter((m) => m.month.slice(0, 4) === nowMonth.slice(0, 4) && m.month <= nowMonth).reduce((s, m) => s + m.floor, 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Novembre 2026 → décembre 2028</p>
            <h1 className="mda-h1">Trajectoire des encaissements</h1>
            <p className="mda-lead">{PLAN.trajectory.intro[0]}</p>
          </header>

          {cur ? (
            <section className="mda-cols-3">
              <div className="mda-card">
                <p className="mda-num">{moneyDollars(curCumul)}</p>
                <p className="mda-label">Cumul réel depuis le début du plan pour {nowMonth.slice(0, 4)}{nowMonth.startsWith("2026") ? " (novembre-décembre 2026)" : ""}</p>
                <div style={{ marginTop: 10 }}>
                  <Bar value={curCumul && cur.cumulTarget ? curCumul / cur.cumulTarget : 0} floor={cur.cumulTarget ? floorCumul / cur.cumulTarget : undefined} thin />
                  <p className="mda-label">Cible fin {monthLabel(nowMonth, false)} : {moneyDollars(cur.cumulTarget)} · plancher {moneyDollars(floorCumul)}</p>
                </div>
              </div>
              <div className="mda-card">
                <p className="mda-num">{moneyDollars(actual(nowMonth))}</p>
                <p className="mda-label">
                  Encaissé en {monthLabel(nowMonth, false)} · cible {moneyDollars(cur.target)} · plancher {moneyDollars(cur.floor)}
                </p>
              </div>
              <div className="mda-card" style={curCumul !== null && curCumul < floorCumul ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
                <p className="mda-num" style={{ fontSize: "1.1rem", lineHeight: 1.35 }}>{curCumul !== null && curCumul < floorCumul ? "Sous le plancher" : "Au-dessus du plancher"}</p>
                <p className="mda-label">Signal d'alarme : cumul de l'année sous le plancher deux mois de suite. Un paiement qui glisse d'un mois n'est pas un échec.</p>
              </div>
            </section>
          ) : null}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Mois par mois</h2>
            </div>
            <div className="mda-scroll">
              <table className="mda-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Type de mois</th>
                    <th className="r">Cible</th>
                    <th className="r">Plancher</th>
                    <th className="r">Réel</th>
                    <th className="r">Cumul visé</th>
                    <th className="r">Cumul réel</th>
                    <th>Ce qui fait rentrer l'argent</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => {
                    const a = actual(m.month);
                    const c = cumul.get(m.month) ?? null;
                    return (
                      <tr key={m.month} data-now={m.month === nowMonth ? "true" : undefined} data-past={m.month < nowMonth ? "true" : undefined}>
                        <td style={{ whiteSpace: "nowrap", fontWeight: m.month === nowMonth ? 600 : 400 }}>{capitalize(monthLabel(m.month, false))}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{m.kind}</td>
                        <td className="r">{moneyDollars(m.target)}</td>
                        <td className="r mda-muted">{moneyDollars(m.floor)}</td>
                        <td className="r" style={{ color: a === null ? undefined : a >= m.target ? "var(--adm-good)" : a < m.floor ? "var(--adm-warn)" : undefined, fontWeight: 600 }}>{a === null ? "" : moneyDollars(a)}</td>
                        <td className="r">{moneyDollars(m.cumulTarget)}</td>
                        <td className="r">{c === null ? "" : `${moneyDollars(c)} (${pctLabel(c / m.cumulTarget)})`}</td>
                        <td style={{ minWidth: 280, color: "var(--adm-text-2)" }}>{m.how}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Par année et par ligne d'affaires</h2>
            </div>
            <div className="mda-scroll">
              <table className="mda-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Ligne</th>
                    {PLAN.trajectory.years.map((y) => (
                      <th key={y.year} className="r">{y.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Cible</td>
                    {PLAN.trajectory.years.map((y) => (
                      <td key={y.year} className="r" style={{ fontWeight: 600 }}>{moneyDollars(y.target)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="mda-muted">Plancher</td>
                    {PLAN.trajectory.years.map((y) => (
                      <td key={y.year} className="r mda-muted">{moneyDollars(y.floor)}</td>
                    ))}
                  </tr>
                  {LINES.map((l) => (
                    <tr key={l.key}>
                      <td>{l.label}</td>
                      {PLAN.trajectory.years.map((y) => (
                        <td key={y.year} className="r">{moneyDollars(y.lines[l.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mda-cols-2">
            <div className="mda-card">
              <h2 className="mda-h2">Par 6 mois et par trimestre</h2>
              <table className="mda-table">
                <tbody>
                  {PLAN.trajectory.periods.map((p) => (
                    <tr key={p.period}>
                      <td style={{ fontWeight: p.half ? 600 : 400 }}>{p.period}</td>
                      <td className="r" style={{ fontWeight: p.half ? 600 : 400 }}>{moneyDollars(p.target)}</td>
                      <td className="r mda-muted">{moneyDollars(p.floor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mda-card">
              <h2 className="mda-h2">Salaire de JP : 10 000 $ par mois dès février 2027</h2>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.88rem", lineHeight: 1.6 }}>
                {PLAN.trajectory.salary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
