import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { Bar, Pill, dayLabel, pctLabel } from "@/components/mandalart/ui";
import { AudiencePicker, FollowupForm, RemoveInviteButton, SendControls, SurveyEditor, SurveyStatusButton } from "@/components/surveys-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { SURVEY_KIND_LABEL, getSurvey, isInterested, surveyLink, type SurveyQuestion, type SurveyResponse } from "@/lib/surveys-repo";

export const metadata = { title: "Voix des familles — Sondage", robots: "noindex" };
export const dynamic = "force-dynamic";

function answerText(q: SurveyQuestion, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (q.type === "note10") return `${v}/10`;
  if (q.type === "echelle5") return `${v}/5`;
  return String(v);
}

function QuestionSummary({ q, responses, nameOf }: { q: SurveyQuestion; responses: SurveyResponse[]; nameOf: (r: SurveyResponse) => string }) {
  const vals = responses.map((r) => ({ r, v: r.answers[q.id] })).filter((x) => x.v !== undefined && x.v !== "");
  if (q.type === "note10" || q.type === "echelle5") {
    const max = q.type === "note10" ? 10 : 5;
    const nums = vals.map((x) => Number(x.v));
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    const low = vals.filter((x) => Number(x.v) <= (q.type === "note10" ? 6 : 2));
    return (
      <div>
        <p className="mda-num" style={{ fontSize: "1.3rem" }}>{avg === null ? "—" : `${avg.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}/${max}`}</p>
        <Bar value={avg ? avg / max : 0} thin color={avg && avg / max >= 0.8 ? "var(--adm-good)" : avg && avg / max < 0.6 ? "var(--adm-bad)" : undefined} />
        <p className="mda-label">{nums.length} réponse{nums.length > 1 ? "s" : ""}{low.length ? ` · notes basses : ${low.map((x) => `${nameOf(x.r)} (${x.v})`).join(", ")}` : ""}</p>
      </div>
    );
  }
  if (q.type === "texte") {
    return vals.length ? (
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.86rem", color: "var(--adm-text-2)", lineHeight: 1.55 }}>
        {vals.map((x) => (
          <li key={x.r.id}>
            <strong style={{ color: "var(--adm-text)" }}>{nameOf(x.r)} :</strong> {String(x.v)}
          </li>
        ))}
      </ul>
    ) : (
      <p className="mda-label">Aucune réponse écrite.</p>
    );
  }
  const options = q.type === "oui_non" ? ["Oui", "Non"] : q.options ?? [];
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {options.map((opt) => {
        const who = vals.filter((x) => (Array.isArray(x.v) ? x.v.includes(opt) : x.v === opt));
        return (
          <div key={opt}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span>{opt}</span>
              <span className="mda-tnum">{who.length} · {pctLabel(vals.length ? who.length / vals.length : 0)}</span>
            </div>
            <Bar value={vals.length ? who.length / vals.length : 0} thin />
            {who.length && q.role === "interet" && !/^(non|aucune)/i.test(opt) ? <p className="mda-label mda-muted">{who.map((x) => nameOf(x.r)).join(", ")}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Un sondage : questions, familles invitées, envoi et relances, résultats, réponses par famille et suivi. */
export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const data = await getSurvey((await params).id);
  if (!data) notFound();
  const { survey, invites, responses } = data;
  const inviteOf = (r: SurveyResponse) => invites.find((i) => i.id === r.invite_id);
  const nameOf = (r: SurveyResponse) => {
    const i = inviteOf(r);
    return i?.parent_name || i?.parent_email || "Famille";
  };
  const sent = invites.filter((i) => i.sent_at).length;
  const notSent = invites.filter((i) => !i.sent_at).length;
  const toRemind = invites.filter((i) => i.sent_at && !i.responded_at).length;
  const scores = responses.map((r) => r.recommend_score).filter((x): x is number => typeof x === "number");
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const interestQ = survey.questions.find((q) => q.role === "interet");
  const interested = interestQ ? responses.filter((r) => isInterested(interestQ, r.answers[interestQ.id])) : [];

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              <Link href="/admin/sondages" style={{ color: "var(--adm-text-3)" }}>Voix des familles</Link> · {SURVEY_KIND_LABEL[survey.kind]}
            </p>
            <h1 className="mda-h1">{survey.title}</h1>
            <p className="mda-lead">
              {survey.status === "brouillon" ? "Brouillon : rien n'a été envoyé." : survey.status === "ferme" ? "Fermé : les familles ne peuvent plus répondre." : `Envoyé le ${dayLabel(survey.sent_at)}.`}
              {survey.audience_label ? ` Familles : ${survey.audience_label}.` : ""}
            </p>
          </header>

          <section className="mda-cols-4">
            <div className="mda-card">
              <p className="mda-num">{responses.length}/{sent}</p>
              <p className="mda-label">Réponses sur les familles jointes ({pctLabel(sent ? responses.length / sent : null)})</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{avg === null ? "—" : `${avg.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}/10`}</p>
              <p className="mda-label">Recommandation moyenne</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{scores.length ? pctLabel(scores.filter((s) => s >= 8).length / scores.length) : "—"}</p>
              <p className="mda-label">Satisfaites (8 et plus)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{responses.filter((r) => r.followup_status === "a_appeler").length}</p>
              <p className="mda-label">À rappeler</p>
            </div>
          </section>

          {/* Envoi */}
          <section className="mda-card">
            <h2 className="mda-h2">1. Les familles</h2>
            <p className="mda-sub">Choisissez les publics, vérifiez la liste, puis ajoutez-les. Les familles déjà ajoutées ne sont jamais en double.</p>
            {survey.status !== "ferme" ? <AudiencePicker id={survey.id} /> : null}
            <h2 className="mda-h2" style={{ marginTop: 24 }}>2. Envoyer</h2>
            <p className="mda-sub">{invites.length} famille{invites.length > 1 ? "s" : ""} au sondage · {sent} déjà jointe{sent > 1 ? "s" : ""}. Le courriel part d'info@newvalkyria.com avec la signature d'Annie.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              {survey.status !== "ferme" ? <SendControls id={survey.id} notSent={notSent} toRemind={toRemind} /> : null}
              <SurveyStatusButton id={survey.id} status={survey.status} />
            </div>
          </section>

          {/* Résultats */}
          {responses.length > 0 && (
            <section>
              <h2 className="mda-h2" style={{ marginBottom: 12 }}>Résultats</h2>
              <div className="mda-cols-2">
                {survey.questions.map((q) => (
                  <div key={q.id} className="mda-card">
                    <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: "0.9rem" }}>{q.label}</p>
                    <QuestionSummary q={q} responses={responses} nameOf={nameOf} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {interestQ ? (
            <section className="mda-card">
              <h2 className="mda-h2">Familles intéressées · {interested.length}</h2>
              <p className="mda-sub">{survey.project_label ? `Projet : ${survey.project_label}. ` : ""}À informer en premier au lancement, avec les meilleurs prix.</p>
              {interested.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.86rem", color: "var(--adm-text-2)", lineHeight: 1.6 }}>
                  {interested.map((r) => {
                    const i = inviteOf(r);
                    return (
                      <li key={r.id}>
                        <strong style={{ color: "var(--adm-text)" }}>{nameOf(r)}</strong>
                        {i?.player_names ? ` · ${i.player_names}` : ""} · {answerText(interestQ, r.answers[interestQ.id])}
                        <span className="mda-muted"> · {i?.parent_email}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mda-label">Personne pour l'instant.</p>
              )}
            </section>
          ) : null}

          {/* Réponses par famille */}
          {responses.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Qui a répondu quoi · {responses.length}</h2>
              </div>
              <ul className="mda-tasks">
                {responses.map((r) => {
                  const i = inviteOf(r);
                  return (
                    <li key={r.id} id={`r-${r.id}`} className="mda-task" style={{ display: "block", scrollMarginTop: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600 }}>
                          {nameOf(r)}
                          {i?.player_names ? <span className="mda-muted" style={{ fontWeight: 400 }}> · {i.player_names}</span> : null}
                        </span>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          {r.recommend_score !== null ? <Pill tone={r.recommend_score >= 9 ? "good" : r.recommend_score >= 7 ? "warn" : "bad"}>{r.recommend_score}/10</Pill> : null}
                          {r.followup_status === "a_appeler" ? <Pill tone="warn">À rappeler</Pill> : r.followup_status === "appele" ? <Pill tone="info">Appelée</Pill> : r.followup_status === "regle" ? <Pill tone="good">Réglé</Pill> : null}
                        </span>
                      </div>
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "var(--adm-text-3)", marginTop: 6 }}>Voir les réponses · {dayLabel(r.created_at)}</summary>
                        <dl style={{ margin: "8px 0 0", display: "grid", gap: 6, fontSize: "0.85rem" }}>
                          {survey.questions.map((q) => (
                            <div key={q.id}>
                              <dt className="mda-muted">{q.label}</dt>
                              <dd style={{ margin: 0, color: "var(--adm-text)" }}>{answerText(q, r.answers[q.id])}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                      <FollowupForm responseId={r.id} status={r.followup_status} note={r.followup_note} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Familles invitées */}
          {invites.length > 0 && (
            <details className="mda-card-flush">
              <summary style={{ cursor: "pointer", padding: "16px 20px" }}>
                <span className="mda-h2">Familles invitées · {invites.length}</span>
                <span className="mda-sub" style={{ display: "block", margin: "4px 0 0" }}>Envoyé, ouvert, répondu ; relances.</span>
              </summary>
              <div className="mda-scroll">
                <table className="mda-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th>Famille</th>
                      <th>Joueuse(s)</th>
                      <th>État</th>
                      <th className="r">Relances</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((i) => (
                      <tr key={i.id}>
                        <td>
                          {i.parent_name ?? "—"}
                          <span className="mda-muted" style={{ display: "block", fontSize: "0.78rem" }}>{i.parent_email}</span>
                        </td>
                        <td>{i.player_names ?? "—"}</td>
                        <td style={{ color: i.responded_at ? "var(--adm-good)" : undefined }}>{i.responded_at ? "Répondu" : i.opened_at ? "Ouvert" : i.sent_at ? "Envoyé" : "Pas encore envoyé"}</td>
                        <td className="r">{i.reminder_count}</td>
                        <td>
                          {!i.responded_at ? <RemoveInviteButton inviteId={i.id} /> : null}
                          {!i.sent_at ? null : (
                            <a href={surveyLink(i.token)} target="_blank" rel="noreferrer" className="mda-task-more" style={{ marginLeft: 8 }}>
                              Lien
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Questions */}
          <details className="mda-card" open={survey.status === "brouillon"}>
            <summary style={{ cursor: "pointer" }}>
              <span className="mda-h2">Questions et texte · {survey.questions.length}</span>
            </summary>
            <div style={{ marginTop: 14 }}>
              <SurveyEditor id={survey.id} title={survey.title} intro={survey.intro ?? ""} questions={survey.questions} projectLabel={survey.project_label} locked={responses.length > 0} />
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
