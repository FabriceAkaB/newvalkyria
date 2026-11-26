import Link from "next/link";

import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { VERDICT_LABEL, VERDICT_TONE, dollars, marginLabel } from "@/lib/launch-calculator";
import { getAccountingSeasons, getSeasonSettings, getSpentBySeason, listScenarios, torontoToday } from "@/lib/launch-scenarios-repo";
import { DEFAULT_SEASON_SETTINGS, SEASON_FILLS, budgetVsSpent, seasonLabels, seasonOf, seasonTotals } from "@/lib/season-budget";

export const metadata = { title: "Plans de saison — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const hours = (h: number) => `${String(Math.round(h * 10) / 10).replace(".", ",")} h`;

/** « Que va rapporter cette saison, et avec quel budget ? » Les hypothèses viennent des scénarios du calculateur de
 *  lancement (champ Saison) ; le budget par poste est l'enveloppe à respecter, comparée aux dépenses entrées dans Revenus. */
export default async function SeasonPlansPage({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const sp = await searchParams;
  const today = torontoToday();
  const [scenarios, allSettings, accounting, spentBySeason] = await Promise.all([
    listScenarios(200, today),
    getSeasonSettings(),
    getAccountingSeasons().catch(() => []),
    getSpentBySeason().catch(() => ({}) as Record<string, Record<string, number>>)
  ]);
  const labels = seasonLabels(scenarios);

  if (!labels.length) {
    return (
      <div className="admin-content">
        <div className="admin-section mda">
          <section className="mda-card">
            <h1 className="mda-h1">Aucun plan de saison pour l’instant</h1>
            <p className="mda-lead">Chiffrez un programme dans le calculateur de lancement et donnez-lui une saison (ex. « Été 2027 ») : son plan apparaît ici.</p>
            <Link className="admin-btn-primary" href="/admin/revenus/calculateur">
              Ouvrir le calculateur
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const season = sp.saison && labels.includes(sp.saison) ? sp.saison : labels[0];
  const settings = allSettings[season] ?? DEFAULT_SEASON_SETTINGS;
  const list = scenarios.filter((s) => seasonOf(s.inputs) === season);
  const t = seasonTotals(list, settings);
  const fill = SEASON_FILLS.find((f) => f.key === settings.fill)!;
  const linked = settings.seasonKey ? accounting.find((a) => a.id === settings.seasonKey) ?? { id: settings.seasonKey, label: settings.seasonKey } : null;
  const spent = linked ? spentBySeason[linked.id] ?? {} : {};
  const rows = budgetVsSpent(t.budget, spent);
  const totalBudget = rows.reduce((s, r) => s + r.budgetCents, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spentCents, 0);
  const byId = new Map(list.map((s) => [s.id, s]));
  const leftTone = t.leftCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)";
  const calcHref = `/admin/revenus/calculateur?saison=${encodeURIComponent(season)}`;

  return (
    <div className="admin-content">
      <div className="admin-section mda sp">
        <style>{CSS}</style>
        <header className="sp-head">
          <div>
            <p className="mda-eyebrow">Plan de saison · hypothèses du calculateur · {fill.label}</p>
            <h1 className="mda-h1" style={{ color: leftTone }}>
              {season} : {dollars(t.leftCents)} dans l’entreprise
            </h1>
            <p className="mda-lead">
              {t.included} programme{t.included > 1 ? "s" : ""} compté{t.included > 1 ? "s" : ""}, {t.signups.toLocaleString("fr-CA")} inscriptions, {dollars(t.programProfitCents)} de bénéfice des programmes
              {t.jpSalaryCents ? `, moins ton salaire de ${dollars(t.jpSalaryCents)}` : ""}
              {t.otherChargesCents ? ` et ${dollars(t.otherChargesCents)} d’autres charges` : ""}.
            </p>
          </div>
          <Link className="admin-btn-ghost sp-btn" href={calcHref}>
            Modifier les hypothèses
          </Link>
        </header>

        {labels.length > 1 ? (
          <nav className="sp-seasons" aria-label="Saisons">
            {labels.map((l) => (
              <Link key={l} href={`/admin/revenus/saisons?saison=${encodeURIComponent(l)}`} aria-current={l === season ? "page" : undefined}>
                {l}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="sp-kpis">
          <Kpi label="Revenus" value={dollars(t.revenueCents)} detail={t.grantCents ? `dont ${dollars(t.grantCents)} de subventions` : "inscriptions et frais"} />
          <Kpi label="Bénéfice des programmes" value={dollars(t.programProfitCents)} detail={t.margin === null ? "—" : `${marginLabel(t.margin)} de marge`} />
          <Kpi label="Ton salaire" value={dollars(t.jpSalaryCents)} detail={`au plus ${dollars(t.maxSalaryCents)} sans être dans le rouge`} />
          <Kpi
            label="Coût d’opportunité"
            value={dollars(t.opportunityCents)}
            detail={t.jpHours ? `${hours(t.jpHours)} à ${dollars(settings.jpHourValueCents)}/h · ${t.overOpportunityCents >= 0 ? `+${dollars(t.overOpportunityCents)} au-dessus` : `${dollars(t.overOpportunityCents)} en dessous`}` : "heures de JP non entrées"}
            tone={t.jpHours ? (t.overOpportunityCents >= 0 ? "good" : "bad") : undefined}
          />
        </div>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Les hypothèses</h2>
              <p className="mda-sub" style={{ margin: 0 }}>Chaque programme tel que chiffré dans le calculateur, au remplissage de {fill.label}.</p>
            </div>
          </div>
          <div className="mda-scroll">
            <table className="mda-table" style={{ minWidth: 880 }}>
              <thead>
                <tr>
                  <th>Programme</th>
                  <th className="r">Prix</th>
                  <th className="r">Places</th>
                  <th className="r">Inscriptions</th>
                  <th className="r">Revenus</th>
                  <th className="r">Coûts</th>
                  <th className="r">Bénéfice</th>
                  <th className="r">Par heure de JP</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {t.lines.map((l) => {
                  const s = byId.get(l.id)!;
                  const i = s.inputs;
                  const perHour = l.jpHours > 0 ? Math.round(l.profitCents / l.jpHours) : null;
                  return (
                    <tr key={l.id} style={l.included ? undefined : { opacity: 0.5 }}>
                      <td>
                        <Link href={`/admin/revenus/calculateur?scenario=${l.id}`} style={{ color: "var(--adm-text)", fontWeight: 500 }}>
                          {l.name}
                        </Link>
                        <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>
                          {l.included ? "" : "Pas compté · "}
                          {i.format === "camp" ? `Camp : ${i.weeks} sem. × ${i.perWeek} places` : `${i.sessions} séances de ${hours(i.hoursPerSession)}`}
                          {s.results.grantCents ? ` · subvention ${dollars(s.results.grantCents)}` : ""}
                          {s.results.installmentExtraCents ? ` · frais de versements` : ""}
                        </span>
                      </td>
                      <td className="r">
                        {dollars(i.priceCents)}
                        {i.format === "camp" ? "/sem." : ""}
                      </td>
                      <td className="r">{l.capacity}</td>
                      <td className="r">{l.count}</td>
                      <td className="r">{dollars(l.revenueCents)}</td>
                      <td className="r">{dollars(l.costCents)}</td>
                      <td className="r" style={{ fontWeight: 600, color: l.profitCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)" }}>{dollars(l.profitCents)}</td>
                      <td className="r" style={{ color: perHour !== null && perHour < settings.jpHourValueCents ? "var(--adm-bad)" : undefined }}>
                        {perHour === null ? "—" : `${dollars(perHour)}/h`}
                      </td>
                      <td>
                        <Pill tone={VERDICT_TONE[s.results.verdict]}>{VERDICT_LABEL[s.results.verdict]}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="sp-grid">
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Le budget de la saison</h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  L’enveloppe pour réussir la saison : on avance avec, et on la réduit sur le moment quand c’est possible.
                  {linked ? ` Dépensé : dépenses de « ${linked.label} » entrées dans Revenus.` : " Liez une saison comptable dans le calculateur pour voir le dépensé."}
                </p>
              </div>
            </div>
            <div className="mda-scroll">
              <table className="mda-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Poste</th>
                    <th className="r">Budget</th>
                    {linked ? <th className="r">Dépensé</th> : null}
                    {linked ? <th className="r">Reste</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.category}>
                      <td>
                        {r.category}
                        <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>{r.labels.join(", ") || "Pas prévu au budget"}</span>
                        {linked && r.budgetCents > 0 ? (
                          <span className="sp-bar" aria-hidden="true">
                            <span style={{ width: `${Math.min(100, (r.used ?? 0) * 100)}%`, background: r.leftCents < 0 ? "var(--adm-bad)" : "var(--adm-accent)" }} />
                          </span>
                        ) : null}
                      </td>
                      <td className="r">{dollars(r.budgetCents)}</td>
                      {linked ? <td className="r">{dollars(r.spentCents)}</td> : null}
                      {linked ? (
                        <td className="r" style={{ fontWeight: 600, color: r.leftCents < 0 ? "var(--adm-bad)" : "var(--adm-text)" }}>
                          {r.leftCents < 0 ? `dépasse de ${dollars(-r.leftCents)}` : dollars(r.leftCents)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  <tr data-now="true">
                    <td style={{ fontWeight: 600 }}>Total</td>
                    <td className="r" style={{ fontWeight: 600 }}>{dollars(totalBudget)}</td>
                    {linked ? <td className="r" style={{ fontWeight: 600 }}>{dollars(totalSpent)}</td> : null}
                    {linked ? <td className="r" style={{ fontWeight: 600 }}>{dollars(totalBudget - totalSpent)}</td> : null}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mda-card sp-sum" aria-label="Ce qui reste">
            <p className="mda-label" style={{ marginTop: 0 }}>Reste dans l’entreprise (avant impôts)</p>
            <p className="mda-num-xl" style={{ color: leftTone, margin: "4px 0 16px" }}>{dollars(t.leftCents)}</p>
            <dl className="sp-wf">
              <div>
                <dt>Revenus</dt>
                <dd>{dollars(t.revenueCents)}</dd>
              </div>
              <div>
                <dt>Coûts des programmes</dt>
                <dd>−{dollars(t.costCents)}</dd>
              </div>
              <div data-total="">
                <dt>Bénéfice des programmes</dt>
                <dd>{dollars(t.programProfitCents)}</dd>
              </div>
              <div>
                <dt>Ton salaire</dt>
                <dd>−{dollars(t.jpSalaryCents)}</dd>
              </div>
              <div>
                <dt>Autres charges</dt>
                <dd>−{dollars(t.otherChargesCents)}</dd>
              </div>
              <div data-total="">
                <dt>Reste dans l’entreprise</dt>
                <dd style={{ color: leftTone }}>{dollars(t.leftCents)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "good" | "bad" }) {
  return (
    <div className="sp-kpi">
      <p className="mda-label" style={{ marginTop: 0 }}>{label}</p>
      <p className="mda-num" style={{ margin: "4px 0", color: tone ? `var(--adm-${tone})` : undefined }}>{value}</p>
      <p className="mda-sub" style={{ margin: 0 }}>{detail}</p>
    </div>
  );
}

const CSS = `
.admin-shell .sp { display: flex; flex-direction: column; gap: 24px; }
.admin-shell .sp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.admin-shell .sp-btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; }
.admin-shell .sp-seasons { display: flex; flex-wrap: wrap; gap: 8px; }
.admin-shell .sp-seasons a { min-height: 36px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px; border: 1px solid var(--adm-border); color: var(--adm-text-2); font-size: 0.85rem; text-decoration: none; }
.admin-shell .sp-seasons a[aria-current="page"] { background: var(--adm-accent-soft); border-color: transparent; color: var(--adm-text); font-weight: 600; }
.admin-shell .sp-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.admin-shell .sp-kpi { padding: 16px; border-radius: var(--adm-radius); background: var(--adm-surface); border: 1px solid var(--adm-line); min-width: 0; }
.admin-shell .sp-kpi .mda-num { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
.admin-shell .sp-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 340px); gap: 24px; align-items: start; }
.admin-shell .sp-wf { margin: 0; display: flex; flex-direction: column; }
.admin-shell .sp-wf > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--adm-line); font-size: 0.85rem; color: var(--adm-text-2); }
.admin-shell .sp-wf > div:first-child { border-top: 0; }
.admin-shell .sp-wf > div[data-total] { font-weight: 600; color: var(--adm-text); }
.admin-shell .sp-wf dt, .admin-shell .sp-wf dd { margin: 0; }
.admin-shell .sp-wf dd { font-variant-numeric: tabular-nums; white-space: nowrap; }
.admin-shell .sp .mda-table td.r, .admin-shell .sp .mda-table th { white-space: nowrap; font-variant-numeric: tabular-nums; }
.admin-shell .sp-bar { display: block; height: 6px; margin-top: 6px; max-width: 220px; border-radius: 999px; background: var(--adm-surface-3); overflow: hidden; }
.admin-shell .sp-bar span { display: block; height: 100%; border-radius: 999px; }
@media (max-width: 960px) {
  .admin-shell .sp-kpis { grid-template-columns: 1fr 1fr; }
  .admin-shell .sp-grid { grid-template-columns: minmax(0, 1fr); }
}
`;
