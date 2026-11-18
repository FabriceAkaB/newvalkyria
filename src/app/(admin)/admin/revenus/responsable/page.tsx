import Link from "next/link";

import { FinanceRequirement } from "@/components/finance-requirement";
import { ProjectActions } from "@/components/project-actions";
import { requireAdmin } from "@/lib/admin-auth";
import { SMALL_SUPPLIER_CENTS, requirementsDone } from "@/lib/finance-officer";
import { getFinanceOfficer } from "@/lib/finance-officer-repo";
import { DECISION_LABEL, type Decision } from "@/lib/project-pipeline";

export const metadata = {
  title: "Responsable financier — Admin New Valkyria",
  robots: "noindex",
};
export const dynamic = "force-dynamic";

const money = (c: number | null) =>
  c === null ? "—" : `${Math.round(c / 100).toLocaleString("fr-CA")} $`;
const day = (iso: string | null) =>
  iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "sans date";
const TONE: Record<Decision, string> = {
  lancer: "good",
  "a-risque": "warn",
  "pas-assez": "bad",
  non: "bad",
  "a-chiffrer": "info",
  "en-attente": "",
};
const HEALTH = {
  excellente: { t: "Saine", c: "var(--adm-good)" },
  "a-surveiller": { t: "À surveiller", c: "var(--adm-warn)" },
  critique: { t: "Critique", c: "var(--adm-bad)" },
} as const;

/** « Est-ce que l'argent va bien, et qu'est-ce qu'on lance ? » (JP, 17 nov. 2026). Le responsable financier lit la
 *  trésorerie, ce qui est à payer, les taxes, chaque projet avec ses conditions, et les dossiers d'argent en cours. */
export default async function FinanceOfficerPage() {
  await requireAdmin({ roles: ["admin"] });
  const f = await getFinanceOfficer();
  const { dashboard: d, tax } = f;
  const late = f.tasks.filter((t) => t.due && t.due < f.today);
  const toLaunch = f.projects.filter((p) => p.evaluation.decision === "lancer");
  const billsTotal = f.billsSoon.reduce((s, b) => s + b.amountCents, 0);
  const taxAlert = tax.rate <= 0 && tax.threshold.overThreshold;
  const alerts = [
    ...(taxAlert
      ? [
          {
            level: "critical" as const,
            message: `Ventes au-dessus de ${money(SMALL_SUPPLIER_CENTS)} depuis ${tax.threshold.firstOver} : l'inscription à la TPS/TVQ est probablement déjà obligatoire. À régler avec le comptable.`,
          },
        ]
      : []),
    ...(late.length
      ? [
          {
            level: "warning" as const,
            message: `${late.length} dossier${late.length > 1 ? "s" : ""} d'argent en retard (voir plus bas).`,
          },
        ]
      : []),
    ...d.alerts,
  ];
  const headline = alerts.some((a) => a.level === "critical")
    ? "Une chose urgente à régler"
    : toLaunch.length
      ? `${toLaunch.length} projet${toLaunch.length > 1 ? "s" : ""} prêt${toLaunch.length > 1 ? "s" : ""} à lancer`
      : "Rien d'urgent : chiffrer les projets";

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">
            Responsable financier · santé {HEALTH[d.health].t.toLowerCase()}
          </p>
          <h1 className="mda-h1">{headline}</h1>
          <p className="mda-lead">
            L&apos;argent d&apos;abord : la trésorerie, ce qui est à payer, les
            taxes qui reviennent à l&apos;État, puis chaque projet avec ce
            qu&apos;il faut avoir en main avant de le lancer.
          </p>
        </header>

        <div className="admin-stats">
          <div className="admin-stat-card">
            <p className="admin-stat-label">Encaisse</p>
            <p
              className="admin-stat-value"
              style={{ color: HEALTH[d.health].c }}
            >
              {money(d.cashAvailableCents)}
            </p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">À payer d&apos;ici 60 jours</p>
            <p className="admin-stat-value">{money(billsTotal)}</p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">Versements des parents à venir</p>
            <p className="admin-stat-value">
              {money(d.parentPaymentsDueCents)}
            </p>
          </div>
          <div className="admin-stat-card">
            <p className="admin-stat-label">TPS/TVQ</p>
            <p
              className="admin-stat-value"
              style={{
                fontSize: "1.1rem",
                color: taxAlert ? "var(--adm-bad)" : "var(--adm-text)",
              }}
            >
              {tax.rate > 0
                ? `${money(tax.collectedCents)} à remettre`
                : taxAlert
                  ? "Inscription à faire"
                  : "Pas encore inscrit"}
            </p>
          </div>
        </div>

        {alerts.length ? (
          <section className="mda-card" style={{ marginTop: 16 }}>
            {alerts.map((a, i) => (
              <p
                key={i}
                style={{
                  margin: i ? "8px 0 0" : 0,
                  fontSize: "0.875rem",
                  color:
                    a.level === "critical"
                      ? "var(--adm-bad)"
                      : "var(--adm-warn)",
                }}
              >
                {a.level === "critical" ? "● " : "○ "}
                {a.message}
              </p>
            ))}
          </section>
        ) : null}

        <h2 className="mda-h" style={{ marginTop: 28 }}>
          Projets : lancer ou pas
        </h2>
        <p className="mda-sub">
          {f.surveyInfo
            ? `Intérêt des familles : ${f.surveyInfo.responded} réponse${f.surveyInfo.responded > 1 ? "s" : ""} sur ${f.surveyInfo.invited} (${f.surveyInfo.status === "brouillon" ? "envoi programmé" : "envoyé"}). `
            : ""}
          Un projet se lance quand tout est coché. Détail des chiffres :{" "}
          <Link href="/admin/revenus/projets">Projets à lancer</Link>.
        </p>
        <div className="mda-cols-2">
          {f.projects
            .filter((p) => !p.project.existing)
            .map(
              ({ project, scenario, evaluation, requirements, scheduled }) => (
                <section
                  key={project.key}
                  className="mda-card"
                  style={{ display: "grid", gap: 8, alignContent: "start" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          color: "var(--adm-text)",
                        }}
                      >
                        {project.label}
                      </p>
                      <p
                        className="mda-muted"
                        style={{ margin: 0, fontSize: "0.75rem" }}
                      >
                        {project.when}
                      </p>
                    </div>
                    <span
                      className="mda-pill"
                      data-tone={TONE[evaluation.decision] || undefined}
                    >
                      {DECISION_LABEL[evaluation.decision]}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8125rem",
                      color: "var(--adm-text-2)",
                    }}
                  >
                    Bénéfice probable :{" "}
                    <strong>{money(evaluation.profitCents)}</strong>
                    {evaluation.profitPerJpHourCents !== null
                      ? ` · ${money(evaluation.profitPerJpHourCents)} par heure de ton temps`
                      : ""}
                    {scenario?.results.ready
                      ? ` · ${requirementsDone(requirements)}/${requirements.length} conditions`
                      : ""}
                  </p>
                  {!scenario?.results.ready ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.8125rem",
                        color: "var(--adm-text)",
                      }}
                    >
                      <span
                        style={{ color: "var(--adm-text-3)", marginRight: 8 }}
                      >
                        ○
                      </span>
                      Prochaine étape : chiffrer le prix, les places et les
                      coûts. Ensuite, la liste des {requirements.length}{" "}
                      conditions s&apos;affiche ici.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 0 }}>
                      {requirements.map((r) =>
                        r.auto || !scenario ? (
                          <p
                            key={r.key}
                            style={{
                              margin: 0,
                              padding: "4px 0",
                              fontSize: "0.8125rem",
                              color: r.done
                                ? "var(--adm-text-3)"
                                : "var(--adm-text)",
                            }}
                            title={r.hint}
                          >
                            <span
                              style={{
                                color: r.done
                                  ? "var(--adm-good)"
                                  : "var(--adm-text-3)",
                                marginRight: 8,
                              }}
                            >
                              {r.done ? "✓" : "○"}
                            </span>
                            {r.label}
                            {!r.done && r.hint && r.auto ? (
                              <span
                                className="mda-muted"
                                style={{ fontSize: "0.75rem" }}
                              >
                                {" "}
                                · {r.hint}
                              </span>
                            ) : null}
                          </p>
                        ) : (
                          <FinanceRequirement
                            key={r.key}
                            scenarioId={scenario.id}
                            requirement={r.key}
                            label={r.label}
                            hint={r.hint}
                            done={r.done}
                          />
                        ),
                      )}
                    </div>
                  )}
                  <ProjectActions
                    projectKey={project.key}
                    scenarioId={scenario?.id ?? null}
                    canSchedule={
                      evaluation.decision === "lancer" ||
                      evaluation.decision === "a-risque"
                    }
                    scheduled={scheduled}
                  />
                </section>
              ),
            )}
        </div>

        <div className="mda-cols-2" style={{ marginTop: 28 }}>
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <strong>À payer d&apos;ici 60 jours</strong>
              <Link
                href="/admin/revenus/tresorerie"
                className="mda-muted"
                style={{ fontSize: "0.8125rem" }}
              >
                Trésorerie →
              </Link>
            </div>
            {f.billsSoon.length ? (
              <table className="admin-table">
                <tbody>
                  {f.billsSoon.map((b, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          whiteSpace: "nowrap",
                          color:
                            b.date < f.today
                              ? "var(--adm-bad)"
                              : "var(--adm-text-3)",
                        }}
                      >
                        {day(b.date)}
                      </td>
                      <td style={{ fontSize: "0.8125rem" }}>{b.description}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {money(b.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p
                className="mda-muted"
                style={{ padding: "16px 20px", margin: 0 }}
              >
                Rien à payer d&apos;ici 60 jours.
              </p>
            )}
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <strong>Dossiers d&apos;argent en cours</strong>
              <Link
                href="/admin/moi"
                className="mda-muted"
                style={{ fontSize: "0.8125rem" }}
              >
                Ma journée →
              </Link>
            </div>
            {f.tasks.length ? (
              <table className="admin-table">
                <tbody>
                  {f.tasks.map((t) => (
                    <tr key={t.id}>
                      <td
                        style={{
                          whiteSpace: "nowrap",
                          color:
                            t.due && t.due < f.today
                              ? "var(--adm-bad)"
                              : "var(--adm-text-3)",
                        }}
                      >
                        {day(t.due)}
                      </td>
                      <td style={{ fontSize: "0.8125rem" }}>{t.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p
                className="mda-muted"
                style={{ padding: "16px 20px", margin: 0 }}
              >
                Aucun dossier en cours.
              </p>
            )}
          </section>
        </div>

        <section className="mda-card" style={{ marginTop: 16 }}>
          <strong>Taxes (TPS/TVQ)</strong>
          <p className="mda-sub" style={{ margin: "6px 0 0" }}>
            Ventes des 4 derniers trimestres :{" "}
            {money(tax.threshold.last4QuartersCents)} (seuil du petit
            fournisseur : {money(SMALL_SUPPLIER_CENTS)}).{" "}
            {tax.rate > 0
              ? `Inscrit à ${(tax.rate * 100).toLocaleString("fr-CA", { maximumFractionDigits: 3 })} %${tax.from ? ` depuis le ${day(tax.from)}` : ""} : ${money(tax.collectedCents)} perçus, qui reviennent à l'État et ne comptent pas dans tes objectifs.`
              : "Dès l'inscription, mets la date dans Revenus → « Taux de taxe » : le site retirera la taxe des revenus et des objectifs à partir de ce jour-là."}
          </p>
        </section>
      </div>
    </div>
  );
}
