import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Bar, Pill, dayLabel, pctLabel } from "@/components/mandalart/ui";
import { NewSurveyForm } from "@/components/surveys-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { SURVEY_KIND_LABEL, SURVEY_TEMPLATES, getFamiliesToCall, getSurveyKpis, listSurveys } from "@/lib/surveys-repo";

export const metadata = { title: "Voix des familles — Sondages", robots: "noindex" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone?: "good" | "info" }> = { brouillon: { label: "Brouillon" }, envoye: { label: "Envoyé", tone: "good" as const }, ferme: { label: "Fermé", tone: "info" as const } };

/** « Les familles sont-elles contentes ? » : satisfaction, familles à rappeler, et tous les sondages. */
export default async function SurveysPage() {
  await requireAdmin({ roles: ["admin"] });
  const [surveys, kpis, toCall] = await Promise.all([listSurveys(), getSurveyKpis(), getFamiliesToCall()]);
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Les familles contentes sont celles qui reviennent</p>
            <h1 className="mda-h1">{kpis.recommend !== null ? `Note de recommandation : ${kpis.recommend.toLocaleString("fr-CA")}/10` : "Voix des familles"}</h1>
            <p className="mda-lead">Un lien personnel par famille : on sait qui a répondu quoi. Une note sous 7, ou une demande d'appel, met la famille dans « À rappeler » (et dans Aujourd'hui).</p>
          </header>

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">{kpis.satisfaction !== null ? `${kpis.satisfaction.toLocaleString("fr-CA")} %` : "—"}</p>
              <p className="mda-label">Familles satisfaites (8 sur 10 et plus) · cible 90 %</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{kpis.responseRate !== null ? `${kpis.responseRate.toLocaleString("fr-CA")} %` : "—"}</p>
              <p className="mda-label">Taux de réponse du dernier sondage · cible 70 %</p>
            </div>
            <div className="mda-card" style={toCall.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
              <p className="mda-num" style={{ color: toCall.length ? "var(--adm-warn)" : undefined }}>{toCall.length}</p>
              <p className="mda-label">Famille{toCall.length > 1 ? "s" : ""} à rappeler sous 48 h</p>
            </div>
          </section>

          {toCall.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">À rappeler</h2>
              </div>
              <ul className="mda-tasks">
                {toCall.map((c) => (
                  <li key={c.responseId} className="mda-task" style={{ display: "block" }}>
                    <Link href={`/admin/sondages/${c.surveyId}#r-${c.responseId}`} style={{ color: "var(--adm-text)", fontWeight: 600, textDecoration: "none" }}>
                      {c.parentName ?? "Famille"}
                      {c.playerNames ? <span className="mda-muted" style={{ fontWeight: 400 }}> · {c.playerNames}</span> : null}
                    </Link>
                    <div className="mda-task-meta">
                      <span>{c.surveyTitle}</span>
                      {c.score !== null ? <span style={{ color: c.score < 7 ? "var(--adm-bad)" : undefined }}>Note {c.score}/10</span> : <span>A demandé un appel</span>}
                      <span>{dayLabel(c.at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Sondages · {surveys.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>Mi-saison, fin de saison, après un bulletin, « vous avez dit, on a fait », intérêt pour un projet, Valkyria Lab.</p>
              </div>
            </div>
            {surveys.length === 0 ? (
              <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)", fontSize: "0.9rem" }}>Aucun sondage pour l'instant. Commencez par celui de mi-saison (tâche P4.8.07, 15 déc.).</p>
            ) : (
              <ul className="mda-tasks">
                {surveys.map((s) => (
                  <li key={s.id} className="mda-task" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <Link href={`/admin/sondages/${s.id}`} style={{ color: "var(--adm-text)", fontWeight: 600, textDecoration: "none" }}>
                        {s.title}
                      </Link>
                      <Pill tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Pill>
                    </div>
                    <div className="mda-task-meta">
                      <span>{SURVEY_KIND_LABEL[s.kind]}</span>
                      <span>{s.responded} réponse{s.responded > 1 ? "s" : ""} sur {s.sent} envoyés ({pctLabel(s.responseRate)})</span>
                      {s.avgRecommend !== null ? <span>Recommandation {s.avgRecommend.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}/10</span> : null}
                      {s.toCall ? <span style={{ color: "var(--adm-warn)" }}>{s.toCall} à rappeler</span> : null}
                      <span>Créé le {dayLabel(s.created_at)}</span>
                    </div>
                    {s.sent ? (
                      <div style={{ marginTop: 8, maxWidth: 320 }}>
                        <Bar value={s.responseRate ?? 0} thin color={(s.responseRate ?? 0) >= 0.7 ? "var(--adm-good)" : undefined} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Nouveau sondage</h2>
            <p className="mda-sub">Partez d'un modèle : les questions sont déjà écrites et se modifient avant l'envoi.</p>
            <NewSurveyForm templates={SURVEY_TEMPLATES.map((t) => ({ kind: t.kind, title: t.title, label: SURVEY_KIND_LABEL[t.kind], count: t.questions.length }))} />
          </section>
        </div>
      </div>
    </>
  );
}
