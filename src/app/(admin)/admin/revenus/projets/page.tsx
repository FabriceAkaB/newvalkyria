import Link from "next/link";

import { ProjectActions } from "@/components/project-actions";
import { requireAdmin } from "@/lib/admin-auth";
import { DECISION_LABEL, JP_HOUR_TARGET_CENTS, MAYBE_CONVERSION, YES_CONVERSION, type Decision } from "@/lib/project-pipeline";
import { getProjectBoard } from "@/lib/project-pipeline-repo";

export const metadata = { title: "Projets à lancer — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const TONE: Record<Decision, string> = { lancer: "good", "a-risque": "warn", "pas-assez": "bad", non: "bad", "a-chiffrer": "info", "en-attente": "" };
const money = (c: number | null) => (c === null ? "—" : `${Math.round(c / 100).toLocaleString("fr-CA")} $`);
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** « Quels projets valent la peine ? » (JP, 17 nov. 2026). Pour chaque projet du sondage d'intérêt : les familles
 *  intéressées, les inscrites probables, le seuil de survie et le bénéfice du calculateur de lancement, ce que rapporte
 *  une heure de JP, puis les étapes placées dans ses tâches. */
export default async function ProjectsPage() {
  await requireAdmin({ roles: ["admin"] });
  const { rows, surveys } = await getProjectBoard();
  const toLaunch = rows.filter((r) => r.evaluation.decision === "lancer");
  const survey = surveys[0] ?? null;

  return (
    <div className="admin-content">
      <div className="admin-section mda">
        <header>
          <p className="mda-eyebrow">Projets 2027 · intérêt des familles × calculateur de lancement</p>
          <h1 className="mda-h1">{toLaunch.length ? `${toLaunch.length} projet${toLaunch.length > 1 ? "s" : ""} à lancer` : "Aucun projet prêt à lancer pour l'instant"}</h1>
          <p className="mda-lead">
            Un projet est à lancer quand les familles intéressées dépassent son seuil de survie et qu&apos;une heure de ton temps y rapporte au moins {money(JP_HOUR_TARGET_CENTS)}.
            Inscrites probables = {pct(YES_CONVERSION)} des « oui » + {pct(MAYBE_CONVERSION)} des « peut-être ». Chiffre chaque projet (prix, places, coûts, tes heures), puis mets les retenus dans ton agenda.
          </p>
          <p className="mda-muted" style={{ marginTop: 8 }}>
            {survey ? (
              <>
                Sondage : <Link href={`/admin/sondages/${survey.id}`}>{survey.title}</Link> · {survey.status === "brouillon" ? "pas encore envoyé" : `${survey.responded} réponse${survey.responded > 1 ? "s" : ""} sur ${survey.invited} familles`}
              </>
            ) : (
              <>Aucun sondage des projets : en créer un dans <Link href="/admin/sondages">Voix des familles</Link> (modèle « Intérêt »).</>
            )}
          </p>
        </header>

        <section className="mda-card-flush">
          <div className="admin-table-wrap mda-scroll" style={{ margin: 0, border: 0, boxShadow: "none" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Projet</th>
                  <th style={{ textAlign: "right" }}>Oui</th>
                  <th style={{ textAlign: "right" }}>Peut-être</th>
                  <th style={{ textAlign: "right" }}>Probables</th>
                  <th style={{ textAlign: "right" }}>Seuil</th>
                  <th style={{ textAlign: "right" }}>Bénéfice probable</th>
                  <th style={{ textAlign: "right" }}>Par heure de JP</th>
                  <th>Verdict</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => !r.project.dropped).map(({ project, interest, interestedNames, scenario, evaluation, scheduled }) => (
                  <tr key={project.key}>
                    <td style={{ minWidth: 220 }}>
                      <strong>{project.label}</strong>
                      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{project.when}</span>
                      {project.proposed ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-accent)", marginTop: 4 }}>Nouvelle idée, tirée du sondage : {project.proposed}</span> : null}
                      <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--adm-text-2)", marginTop: 4 }}>{evaluation.sentence}</span>
                      {project.market ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)", marginTop: 4 }}>Marché : {project.market}</span> : null}
                      {project.funding ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)", marginTop: 4 }}>Financement : {project.funding}</span> : null}
                      {interestedNames.length ? (
                        <details style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>
                          <summary style={{ cursor: "pointer" }}>Qui est intéressé</summary>
                          {interestedNames.join(", ")}
                        </details>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{interest.yes}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{interest.maybe}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{evaluation.probable}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{evaluation.breakEven ?? "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: (evaluation.profitCents ?? 0) < 0 ? "var(--adm-bad)" : "var(--adm-text)" }}>{money(evaluation.profitCents)}
                      {evaluation.profitWithGrantCents !== null ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-good)" }}>{money(evaluation.profitWithGrantCents)} avec subvention</span> : null}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{evaluation.profitPerJpHourCents === null ? (scenario?.results.ready ? "heures à mettre" : "—") : money(evaluation.profitPerJpHourCents)}</td>
                    <td><span className="mda-pill" data-tone={TONE[evaluation.decision] || undefined}>{DECISION_LABEL[evaluation.decision]}</span></td>
                    <td>
                      <ProjectActions projectKey={project.key} scenarioId={scenario?.id ?? null} canSchedule={!project.existing && (evaluation.decision === "lancer" || evaluation.decision === "a-risque")} scheduled={scheduled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {rows.some((r) => r.project.dropped) ? (
          <section className="mda-card">
            <h2 className="mda-h2">Projets écartés</h2>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6, color: "var(--adm-text-2)" }}>
              {rows.filter((r) => r.project.dropped).map((r) => (
                <li key={r.project.key}><strong style={{ color: "var(--adm-text)" }}>{r.project.label}</strong> ({r.interest.yes} oui sur {r.interest.answered}) : {r.project.dropped}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
