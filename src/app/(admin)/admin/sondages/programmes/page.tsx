import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getProgramSatisfaction } from "@/lib/program-satisfaction-repo";

export const metadata = { title: "Satisfaction par programme — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const KIND_LABEL = { saison: "Saison", programme: "Programme", camp: "Camp", parascolaire: "Parascolaire" } as const;
const TREND = { hausse: { t: "▲ en hausse", c: "var(--adm-good)" }, baisse: { t: "▼ en baisse", c: "var(--adm-bad)" }, stable: { t: "= stable", c: "var(--adm-text-3)" } } as const;
const tone = (v: number | null) => (v === null ? "var(--adm-text-3)" : v >= 8.5 ? "var(--adm-good)" : v >= 7 ? "var(--adm-text)" : "var(--adm-bad)");

/** « Quel programme plaît le plus, lequel décroche ? » Le plaisir des jeunes mois par mois (note de la pratique au
 *  sondage de fin) et la satisfaction des parents (note de recommandation des sondages), programme par programme. */
export default async function ProgramSatisfactionPage() {
  await requireAdmin();
  const { months, rows } = await getProgramSatisfaction();
  const dropping = rows.filter((r) => r.trend === "baisse");
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Voix des familles · {months.length} derniers mois</p>
            <h1 className="mda-h1">{dropping.length ? `${dropping.length} programme${dropping.length > 1 ? "s" : ""} en baisse` : "Aucun programme en baisse"}</h1>
            <p className="mda-lead">
              Le plaisir des jeunes vient du sondage de fin de chaque pratique (sur 10) ; la satisfaction des parents, de la note de recommandation des sondages (sur 10). Vert à 8,5 et plus, rouge sous 7. Un programme en baisse deux mois de suite mérite une observation et un appel aux familles.
            </p>
          </header>
          <section className="mda-card-flush">
            <div className="admin-table-wrap mda-scroll" style={{ margin: 0, border: 0, boxShadow: "none" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Programme</th>
                    <th style={{ textAlign: "right" }}>Inscrites</th>
                    {months.map((m) => (
                      <th key={m} style={{ textAlign: "right" }}>Jeunes {monthLabel(m)}</th>
                    ))}
                    <th>Tendance</th>
                    <th style={{ textAlign: "right" }}>Parents</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        {r.label}
                        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{KIND_LABEL[r.kind]}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>{r.players}</td>
                      {r.kids.map((k) => (
                        <td key={k.month} style={{ textAlign: "right", color: tone(k.value), fontWeight: k.value !== null ? 600 : 400 }} title={k.count ? `${k.count} réponses` : "Aucune réponse"}>
                          {k.value ?? "—"}
                        </td>
                      ))}
                      <td style={{ color: r.trend ? TREND[r.trend].c : "var(--adm-text-3)", whiteSpace: "nowrap" }}>{r.trend ? TREND[r.trend].t : "—"}</td>
                      <td style={{ textAlign: "right", color: tone(r.parents.average) }}>
                        {r.parents.average ?? "—"}
                        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{r.parents.count} réponse{r.parents.count > 1 ? "s" : ""}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
