import { AdminTopbar } from "@/components/admin-topbar";
import { KpiEntryForm } from "@/components/mandalart/forms";
import { Bar, Pill, dayLabel, shortDay } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { formatKpi } from "@/lib/mandalart-kpis";
import { getMandalartOverview } from "@/lib/mandalart-repo";

export const metadata = { title: "Mandalart — Indicateurs", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Les indicateurs : départ → actuel → cible. Les automatiques viennent des vraies tables ;
 *  les manuels se saisissent ici. */
export default async function MandalartKpisPage() {
  await requireAdmin({ roles: ["admin"] });
  const o = await getMandalartOverview();
  const met = o.kpis.filter((k) => k.met).length;
  const measured = o.kpis.filter((k) => k.current !== null).length;
  const groups: { title: string; ids: string[] }[] = [
    { title: "Argent", ids: ["ca_annee", "ca_12m", "ca_valkyria_annee", "marge_valkyria", "ca_conseil_annee", "clubs_conseil", "commandites_annee", "plages_matchs", "benefice_ete_2027", "reserve_tresorerie", "remuneration_jp", "salaire_jp"] },
    { title: "Familles et joueuses", ids: ["membres_actifs", "cohortes_2017_2019", "retour_saison", "remplissage", "nouvelles_joueuses_an", "source_connue", "cac"] },
    { title: "Satisfaction", ids: ["recommandation", "satisfaction", "taux_reponse_sondages", "appreciation_joueuses", "familles_profil", "familles_video_lab"] },
    { title: "Pédagogie et preuve", ids: ["joueuses_filmees_jour1", "exercices_approuves", "seances_approuvees", "entrevues_saison", "videos_semaine"] }
  ];
  const placed = new Set(groups.flatMap((g) => g.ids));
  const others = o.kpis.filter((k) => !placed.has(k.id));
  if (others.length) groups.push({ title: "Autres", ids: others.map((k) => k.id) });

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">{o.kpis.length} indicateurs · {measured} mesurés · {met} cibles atteintes</p>
            <h1 className="mda-h1">Les résultats, en chiffres</h1>
            <p className="mda-lead">« Automatique » = calculé à partir des vraies données du site à chaque ouverture. « Manuel » = la dernière valeur entrée ici. Un plan bien exécuté avec des résultats qui ne bougent pas est un signal d'alarme.</p>
          </header>
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mda-h2" style={{ marginBottom: 12 }}>{g.title}</h2>
              <div className="mda-cols-2">
                {g.ids
                  .map((id) => o.kpis.find((k) => k.id === id))
                  .filter((k): k is NonNullable<typeof k> => !!k)
                  .map((k) => {
                    const unit = k.targetN.unit || k.startN.unit;
                    const auto = k.source === "auto" && k.currentSource === "auto";
                    return (
                      <div key={k.id} className="mda-card">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.92rem", color: "var(--adm-text)" }}>{k.label}</p>
                          {k.met ? <Pill tone="good">Atteint</Pill> : auto ? <Pill tone="info">Automatique</Pill> : <Pill>Manuel</Pill>}
                        </div>
                        <p className="mda-num" style={{ marginTop: 10 }}>{formatKpi(k.current, unit)}</p>
                        <div style={{ marginTop: 10 }}>
                          <Bar value={k.progress ?? 0} thin color={k.met ? "var(--adm-good)" : undefined} />
                          <div className="mda-bar-legend">
                            <span>Départ : {k.start}</span>
                          </div>
                          <p className="mda-label">
                            Cible : <strong style={{ color: "var(--adm-text)" }}>{k.target}</strong> au {k.due ? dayLabel(k.due) : "—"}
                          </p>
                        </div>
                        <p className="mda-label mda-muted">{k.currentNote ?? k.how}</p>
                        {k.history.length > 1 ? (
                          <p className="mda-label mda-muted">
                            Historique : {k.history.slice(-5).map((h) => `${shortDay(h.date)} ${formatKpi(h.value, unit)}`).join(" · ")}
                          </p>
                        ) : null}
                        {!auto ? <KpiEntryForm kpiId={k.id} unit={unit} /> : null}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
