import "./player-dossier.css";

import { ClipboardList, Eye, Video } from "lucide-react";
import Link from "next/link";

import { BulletinReport } from "@/components/bulletin-report";
import { ObjectivesPanel, RoutinesPanel } from "@/components/coach-joueur-detail";
import { DossierTabs, type DossierTab } from "@/components/dossier-tabs";
import { FamilyPassport } from "@/components/family-passport";
import { FamilyProgressVideos } from "@/components/family-progress-videos";
import { MatchPlayer } from "@/components/match-player";
import { SeasonSummaryCard } from "@/components/season-summary-card";
import { QUICK_CRITERIA, PARTICIPATED } from "@/lib/coach-report";
import { championLabel } from "@/lib/player-points";
import { familyAverages, matchCriteria, POSITION_LABELS, scoreOn10 } from "@/lib/match-evaluation";
import { bulletinChecklist, bulletinProgress, dossierAlerts, overallTrend, shortDay, surveyStats, type SurveyStats } from "@/lib/player-dossier";
import type { PlayerDossier } from "@/lib/player-dossier-repo";
import { disagreements } from "@/lib/player-reports";
import { HEAD_KNOCK_RULE, kindLabel, statusLabel } from "@/lib/player-incidents";
import { SHEET_FIELDS } from "@/lib/player-sheet";
import { beforeAfter, checkpointLabel } from "@/lib/progress-videos";

/** Le dossier complet d'une joueuse dans l'Espace Technique (JP, 26 nov. 2026) : un onglet par source (rapports,
 *  sondages, matchs, vidéos, passeport, fiche du parent, blessures), l'aperçu fidèle de ce que voit sa famille et son
 *  bulletin de mi-saison en construction. Composant serveur : chaque onglet est préparé ici, DossierTabs les montre. */

const num = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-CA", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
const STATUS: Record<string, string> = { present: "Présente", absent: "Absente", injured: "Blessée", late: "En retard", left_early: "Partie plus tôt", unknown: "Attendue, pas de réponse dans MonClubSportif" };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

interface Props {
  d: PlayerDossier;
  canEdit: boolean;
  isVideographer: boolean;
  exercises: { id: string; title: string }[];
}

/* ── Petits morceaux ── */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="pd-card">
      <p className="pd-empty">{children}</p>
    </div>
  );
}

/** Plaisir et fatigue (sur 10) pratique par pratique : deux courbes, étiquetées au bout. */
function SurveyChart({ series }: { series: SurveyStats["series"] }) {
  if (series.length < 2) return <p className="pd-empty">La courbe apparaît après deux sondages.</p>;
  const W = 640;
  const H = 160;
  const pad = { l: 28, r: 70, t: 12, b: 24 };
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (series.length - 1);
  const y = (v: number) => pad.t + ((10 - v) * (H - pad.t - pad.b)) / 9;
  const line = (k: "pleasure" | "fatigue") =>
    series
      .map((p, i) => (p[k] == null ? null : `${x(i)},${y(p[k]!)}`))
      .filter(Boolean)
      .join(" ");
  const last = (k: "pleasure" | "fatigue") => {
    for (let i = series.length - 1; i >= 0; i--) if (series[i][k] != null) return { i, v: series[i][k]! };
    return null;
  };
  const lp = last("pleasure");
  const lf = last("fatigue");
  return (
    <>
      <svg className="pd-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Plaisir et fatigue à chaque pratique, sur 10">
        {[1, 5, 10].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--adm-line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(g) + 4} textAnchor="end" fontSize={11} fill="var(--adm-text-3)">{g}</text>
          </g>
        ))}
        <polyline points={line("pleasure")} fill="none" stroke="var(--adm-series-1)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={line("fatigue")} fill="none" stroke="var(--adm-series-2)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 4" />
        {series.map((p, i) => (
          <g key={i}>
            {p.pleasure != null ? <circle cx={x(i)} cy={y(p.pleasure)} r={3.5} fill="var(--adm-series-1)"><title>{`${shortDay(p.date)} : plaisir ${p.pleasure}/10`}</title></circle> : null}
            {p.fatigue != null ? <circle cx={x(i)} cy={y(p.fatigue)} r={3.5} fill="var(--adm-series-2)"><title>{`${shortDay(p.date)} : fatigue ${p.fatigue}/10`}</title></circle> : null}
          </g>
        ))}
        {lp ? <text x={x(lp.i) + 8} y={y(lp.v) + 4} fontSize={12} fill="var(--adm-text)">Plaisir {lp.v}</text> : null}
        {lf ? <text x={x(lf.i) + 8} y={y(lf.v) + (lp && Math.abs(y(lp.v) - y(lf.v)) < 14 ? 18 : 4)} fontSize={12} fill="var(--adm-text)">Fatigue {lf.v}</text> : null}
        <text x={pad.l} y={H - 6} fontSize={11} fill="var(--adm-text-3)">{shortDay(series[0].date)}</text>
        <text x={W - pad.r} y={H - 6} fontSize={11} fill="var(--adm-text-3)" textAnchor="end">{shortDay(series[series.length - 1].date)}</text>
      </svg>
      <div className="pd-legend">
        <span><i style={{ background: "var(--adm-series-1)" }} />Plaisir (plus haut = mieux)</span>
        <span><i style={{ background: "var(--adm-series-2)" }} />Fatigue (plus bas = plus en forme)</span>
      </div>
    </>
  );
}

/* ── Le dossier ── */

export function PlayerDossierView({ d, canEdit, isVideographer, exercises }: Props) {
  const now = today();
  const practices = d.attendance.filter((a) => a.type === "Pratique" && a.date <= now);
  const present = practices.filter((a) => PARTICIPATED.includes(a.status)).length;
  const rate = practices.length ? Math.round((present / practices.length) * 100) : null;
  const noAnswer = practices.filter((a) => a.status === "unknown").length;
  const overalls = d.reports.map((r) => r.merged.overall).filter((v): v is number => v !== null);
  const avgOverall = overalls.length ? Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10 : null;
  const trend = overallTrend(d.reports.map((r) => ({ date: r.date, overall: r.merged.overall })));
  const stats = surveyStats(d.survey);
  const lastEvaluation = d.reports[0]?.date ?? null;
  const openIncidents = d.incidents.filter((i) => i.status !== "fermee");
  const alerts = dossierAlerts({
    today: now,
    incidents: d.incidents.map((i) => ({ status: i.status, kind: i.kind, date: i.activityDate })),
    attendance: d.attendance.map((a) => ({ date: a.date, status: a.status, activityType: a.type })),
    evaluations: d.reports.map((r) => ({ date: r.date, ratings: r.merged.ratings as Record<string, number> })),
    feedback: d.survey.map((s) => ({ date: s.date, practice_rating: s.practiceRating, fatigue: s.fatigue })),
    lastEvaluation,
    health: d.sheet?.answers.health ?? null
  });
  const allVideos = d.videos?.videos ?? [];
  const pair = beforeAfter(allVideos);
  const name = `${d.firstName} ${d.lastName}`.trim();
  const groupLine = [d.category ? `Filles ${d.category}` : null, d.advanced ? "groupe avancé" : null, d.group].filter(Boolean).join(" · ") || "Groupe à venir";

  /* Résumé */
  const resume = (
    <div className="pd-cols">
      <div className="pd-stack">
        <div className="pd-card">
          <p className="pd-card__label">À savoir avant la prochaine pratique</p>
          {alerts.length ? (
            <ul className="pd-alerts">
              {alerts.map((a, i) => (
                <li key={i} data-tone={a.tone}>{a.text}</li>
              ))}
            </ul>
          ) : (
            <p className="pd-empty">Rien à signaler : présences régulières, aucune blessure ouverte.</p>
          )}
        </div>
        {d.summary ? <SeasonSummaryCard summary={d.summary} firstName={d.firstName} /> : null}
        <div className="pd-card">
          <p className="pd-card__label">
            Derniers rapports des éducateurs <a href="#rapports">Tout voir</a>
          </p>
          {d.reports.length ? (
            <div className="pd-table-wrap">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th>Pratique</th>
                    {QUICK_CRITERIA.map((c) => (
                      <th key={c} className="pd-num">{c}</th>
                    ))}
                    <th className="pd-num">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {d.reports.slice(0, 5).map((r) => (
                    <tr key={`${r.activityId}`}>
                      <td>
                        {shortDay(r.date)} <span className="coach-muted">· {r.evaluations.map((e) => e.coachName).join(", ")}</span>
                      </td>
                      {QUICK_CRITERIA.map((c) => (
                        <td key={c} className="pd-num">{num(r.merged.ratings[c])}</td>
                      ))}
                      <td className="pd-num"><b>{num(r.merged.overall)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pd-empty">Pas encore évaluée cette saison.</p>
          )}
        </div>
      </div>
      <div className="pd-stack">
        <div className="pd-card">
          <p className="pd-card__label">Présences · {practices.length} pratique{practices.length > 1 ? "s" : ""} attendue{practices.length > 1 ? "s" : ""}</p>
          {practices.length ? (
            <>
              <div className="pd-dots" aria-label="Présences, de la plus ancienne à la plus récente">
                {[...practices].reverse().map((a) => (
                  <span key={a.activityId} className="pd-dot" data-s={a.status} title={`${shortDay(a.date)} : ${STATUS[a.status] ?? a.status}`} />
                ))}
              </div>
              <p className="pd-note" style={{ marginTop: 10 }}>
                Dernière : {longDay(practices[0].date)}, {(STATUS[practices[0].status] ?? practices[0].status).toLowerCase()}.
              </p>
              <p className="pd-note" style={{ marginTop: 4 }}>
                MonClubSportif fait foi : {present} présence{present > 1 ? "s" : ""} sur {practices.length} pratique{practices.length > 1 ? "s" : ""} où elle était attendue
                {noAnswer ? ` (${noAnswer} sans réponse)` : ""}. Les pratiques annulées ne comptent pas.
              </p>
            </>
          ) : (
            <p className="pd-empty">Aucune présence notée.</p>
          )}
        </div>
        <div className="pd-card">
          <p className="pd-card__label">Points Valkyria et titres</p>
          <div className="pd-tiles" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="pd-tile" style={{ padding: 0 }}>
              <strong>{d.points?.earned ?? 0}</strong>
              <span>points gagnés cette saison</span>
            </div>
            <div className="pd-tile" style={{ padding: 0 }}>
              <strong>{d.titles.length}</strong>
              <span>fois championne du jour</span>
            </div>
          </div>
          {d.titles.length ? (
            <ul className="pd-alerts" style={{ marginTop: 12 }}>
              {d.titles.slice(0, 4).map((t) => (
                <li key={t.id} data-tone="info">
                  {shortDay(t.date)} · {t.title ?? championLabel(t.kind).label}{t.coachName ? ` (${t.coachName})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="pd-card">
          <p className="pd-card__label">
            Ce que dit le parent <a href="#fiche">Fiche complète</a>
          </p>
          {d.sheet ? (
            <dl className="pd-dl">
              {(["encouragement", "stress", "likes"] as const)
                .filter((k) => d.sheet!.answers[k])
                .map((k) => (
                  <div key={k}>
                    <dt>{SHEET_FIELDS.find((f) => f.key === k)!.label}</dt>
                    <dd>{d.sheet!.answers[k]}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="pd-empty">Le parent n&apos;a pas encore rempli sa fiche.</p>
          )}
        </div>
      </div>
    </div>
  );

  /* Rapports des éducateurs */
  const coachCount = new Set(d.reports.flatMap((r) => r.evaluations.map((e) => e.coachId))).size;
  const rapports = d.reports.length ? (
    <div className="pd-stack">
      <div className="pd-tiles">
        <div className="pd-tile"><strong>{d.reports.length}</strong><span>{d.reports.length > 1 ? "pratiques évaluées" : "pratique évaluée"}</span></div>
        <div className="pd-tile"><strong>{num(avgOverall)}<small>/5</small></strong><span>moyenne de la saison</span></div>
        <div className="pd-tile">
          <strong>{trend ? `${num(trend.start)} → ${num(trend.recent)}` : "—"}</strong>
          <span>{trend ? `tendance : ${trend.dir === "hausse" ? "en progrès" : trend.dir === "baisse" ? "en baisse" : "stable"}` : "tendance après 4 pratiques"}</span>
        </div>
        <div className="pd-tile"><strong>{coachCount}</strong><span>{coachCount > 1 ? "éducateurs différents" : "éducateur"}</span></div>
      </div>
      {d.reports.map((r) => {
        const gaps = disagreements(r.evaluations);
        return (
          <article key={r.activityId} className="pd-report">
            <div className="pd-report__head">
              <div>
                <p className="pd-report__title">{longDay(r.date)}{r.start ? ` · ${r.start.replace(":", " h ")}` : ""}</p>
                <p className="pd-report__meta">{r.group} · {r.evaluations.length} éducateur{r.evaluations.length > 1 ? "s" : ""}{gaps.length ? ` · écart de 2 points sur ${gaps.join(", ")}` : ""}</p>
              </div>
              <div className="pd-scores">
                {QUICK_CRITERIA.map((c) => (
                  <span key={c} className="pd-score">{c} <b>{num(r.merged.ratings[c])}</b></span>
                ))}
                <span className="pd-score" data-strong>Moyenne <b>{num(r.merged.overall)}</b></span>
              </div>
            </div>
            {r.evaluations.map((e) => (
              <div key={e.coachId} className="pd-coach">
                <p className="pd-coach__name">
                  {e.coachName}
                  <span className="coach-muted" style={{ fontWeight: 400 }}>
                    {" · "}
                    {QUICK_CRITERIA.map((c) => `${c} ${e.ratings?.[c] ?? "—"}`).join(" · ")}
                  </span>
                </p>
                {Object.keys(e.gestureScores ?? {}).length ? (
                  <p className="pd-coach__small">Gestes du ball mastery : {Object.entries(e.gestureScores).map(([g, v]) => `${g} ${v}/10`).join(" · ")}</p>
                ) : null}
                {e.difficult?.length ? <p className="pd-coach__small">Gestes difficiles : {e.difficult.join(", ")}</p> : null}
                {e.comment ? <p className="pd-coach__text">{e.comment}</p> : null}
              </div>
            ))}
          </article>
        );
      })}
      <p className="pd-note">Les observations écrites sont des notes internes de l&apos;équipe : la famille ne les voit jamais.</p>
    </div>
  ) : (
    <Empty>Pas encore évaluée cette saison. Les rapports apparaissent ici après chaque pratique, un par éducateur.</Empty>
  );

  /* Sondages de la borne */
  const sondages = stats.answers ? (
    <div className="pd-stack">
      <div className="pd-tiles">
        <div className="pd-tile"><strong>{num(stats.pleasure)}<small>/10</small></strong><span>plaisir moyen</span></div>
        <div className="pd-tile"><strong>{num(stats.fatigue)}<small>/10</small></strong><span>fatigue moyenne</span></div>
        <div className="pd-tile"><strong>{stats.coachHelpedRate ?? "—"}<small>%</small></strong><span>une coach l&apos;a aidée</span></div>
        <div className="pd-tile"><strong>{stats.peerHelpedRate ?? "—"}<small>%</small></strong><span>une amie l&apos;a aidée</span></div>
        <div className="pd-tile"><strong>{stats.theme.asked ? `${stats.theme.correct}/${stats.theme.asked}` : "—"}</strong><span>thème compris</span></div>
      </div>
      <div className="pd-cols">
        <div className="pd-card">
          <p className="pd-card__label">Plaisir et fatigue, pratique par pratique</p>
          <SurveyChart series={stats.series} />
        </div>
        <div className="pd-card">
          <p className="pd-card__label">Qui l&apos;aide, qui elle aide</p>
          <dl className="pd-dl">
            <div>
              <dt>Les coachs qu&apos;elle nomme</dt>
              <dd>{stats.topCoaches.length ? stats.topCoaches.map((c) => `${c.name} (${c.times})`).join(", ") : "Personne encore"}</dd>
            </div>
            <div>
              <dt>Les amies qui l&apos;ont aidée</dt>
              <dd>{stats.topPeers.length ? stats.topPeers.map((c) => `${c.name} (${c.times})`).join(", ") : "Personne encore"}</dd>
            </div>
            <div>
              <dt>Nommée par ses coéquipières</dt>
              <dd>{d.namedByPeers.length ? `${d.namedByPeers.length} fois : ${[...new Set(d.namedByPeers.map((n) => n.name))].slice(0, 5).join(", ")}` : "Pas encore"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="pd-card">
        <p className="pd-card__label">Ses réponses ({stats.answers})</p>
        <div className="pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Pratique</th>
                <th className="pd-num">Plaisir</th>
                <th className="pd-num">Fatigue</th>
                <th>Coach qui l&apos;a aidée</th>
                <th>Amie qui l&apos;a aidée</th>
                <th>Thème de la semaine</th>
              </tr>
            </thead>
            <tbody>
              {d.survey.map((s, i) => (
                <tr key={i}>
                  <td>{shortDay(s.date)} <span className="coach-muted">· {s.group}</span></td>
                  <td className="pd-num">{s.practiceRating ?? "—"}</td>
                  <td className="pd-num">{s.fatigue ?? "—"}</td>
                  <td>{s.coachHelped == null ? "—" : s.coachHelped ? s.coachHelpers.join(", ") || "Oui" : "Non"}</td>
                  <td>{s.peerHelped == null ? "—" : s.peerHelped ? s.peerHelpers.join(", ") || "Oui" : "Non"}</td>
                  <td>
                    {s.themeAnswer == null ? (
                      "—"
                    ) : (
                      <span className="pd-badge" data-tone={s.themeCorrect ? "good" : "warn"} title={s.themeCorrect ? undefined : `Le bon thème : ${s.themeExpected ?? ""}`}>
                        {s.themeCorrect ? "Compris" : "Pas compris"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pd-note" style={{ marginTop: 12 }}>Ses réponses à la borne, à la fin de chaque pratique. Elle ne voit jamais si elle a bon au thème.</p>
      </div>
    </div>
  ) : (
    <Empty>Elle n&apos;a pas encore répondu au sondage de la borne.</Empty>
  );

  /* Matchs */
  const matchs = (
    <div className="pd-stack">
      {d.matchEvals.length ? (
        d.matchEvals.map((m) => {
          const s10 = Object.keys(m.criteria).length ? scoreOn10(m.criteria) : m.score !== null ? (m.scale === 100 ? m.score / 10 : m.score) : null;
          const fams = familyAverages(m.criteria).filter((f) => f.avg !== null);
          const crit = matchCriteria(m.position);
          return (
            <article key={m.id} className="pd-report">
              <div className="pd-report__head">
                <div>
                  <p className="pd-report__title">{m.date ? longDay(m.date) : "Match"} · {m.title}</p>
                  <p className="pd-report__meta">{m.coach}{m.position ? ` · ${POSITION_LABELS[m.position] ?? m.position}` : ""}</p>
                </div>
                <div className="pd-scores">
                  {fams.map((f) => (
                    <span key={f.family} className="pd-score">{f.family} <b>{num(f.avg)}</b></span>
                  ))}
                  <span className="pd-score" data-strong>Note <b>{num(s10)}/10</b></span>
                </div>
              </div>
              {Object.keys(m.criteria).length ? (
                <p className="pd-coach__small" style={{ marginTop: 10 }}>
                  {crit.filter((c) => typeof m.criteria[c.key] === "number").map((c) => `${c.label} ${m.criteria[c.key]}/5`).join(" · ")}
                </p>
              ) : null}
              {m.strengths || m.toImprove || m.comment ? (
                <dl className="pd-dl pd-dl--two" style={{ marginTop: 12 }}>
                  {m.strengths ? <div><dt>Points forts</dt><dd>{m.strengths}</dd></div> : null}
                  {m.toImprove ? <div><dt>À travailler</dt><dd>{m.toImprove}</dd></div> : null}
                  {m.comment ? <div><dt>Commentaire</dt><dd>{m.comment}</dd></div> : null}
                </dl>
              ) : null}
            </article>
          );
        })
      ) : (
        <Empty>Aucune évaluation de match pour elle encore.</Empty>
      )}
      <div className="pd-card">
        <p className="pd-card__label">Matchs filmés où elle apparaît ({d.matchVideos.length})</p>
        {d.matchVideos.length ? (
          <div className="pd-videos">
            {d.matchVideos.map((v) => (
              <div key={v.id} style={{ display: "grid", gap: 6 }}>
                <MatchPlayer id={v.id} endpoint={`/api/coach/videos/${v.id}`} label={`Regarder ${v.teamName ?? v.title}`} poster={v.poster} />
                <p className="pd-coach__small">{v.date ? longDay(v.date) : ""} · {v.teamName ?? v.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="pd-empty">Aucun match filmé avec son équipe pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );

  /* Vidéos de progression */
  const videos = (
    <div className="pd-stack">
      {isVideographer ? (
        <p className="pd-note">
          <Link href={`/entraineur/videos-joueuses/joueuse/${d.registrationId}`} className="pd-btn" style={{ display: "inline-flex" }}>
            <Video size={14} aria-hidden /> Ajouter ou classer ses vidéos
          </Link>
        </p>
      ) : null}
      {pair ? (
        <div className="pd-card">
          <p className="pd-card__label">Avant / après</p>
          <div className="pd-videos">
            {[pair.before, pair.after].map((v) => (
              <figure key={v.id} className="pd-video">
                {v.url ? <video src={v.url} controls preload="none" playsInline /> : null}
                <figcaption>{checkpointLabel(v.checkpoint)} · {v.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
      {allVideos.length ? (
        <div className="pd-card">
          <p className="pd-card__label">Toutes ses vidéos ({allVideos.length})</p>
          <div className="pd-videos">
            {[...allVideos].reverse().map((v) => (
              <figure key={v.id} className="pd-video">
                {v.url ? <video src={v.url} controls preload="none" playsInline /> : null}
                <figcaption>
                  {v.filmedOn ? shortDay(v.filmedOn) : shortDay(v.createdAt.slice(0, 10))} · {v.checkpoint ? checkpointLabel(v.checkpoint) : "Capsule"} · {v.title}
                  {v.note ? ` · ${v.note}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="pd-note" style={{ marginTop: 12 }}>La famille voit seulement les vidéos d&apos;étape (début, mi-saison, fin) ; les capsules restent à l&apos;interne.</p>
        </div>
      ) : (
        <Empty>Pas encore filmée. Ses vidéos de progression arrivent ici dès qu&apos;elles sont déposées.</Empty>
      )}
    </div>
  );

  /* Passeport et objectifs */
  const passeport = (
    <div className="pd-cols">
      <div className="pd-stack">
        {d.parcours ? (
          <div inert>
            <FamilyPassport registrationId={d.registrationId} firstName={d.firstName} photoUrl={d.photoUrl} data={d.parcours} staffView />
          </div>
        ) : (
          <Empty>Le passeport se remplit avec les tests et les gestes notés à chaque pratique.</Empty>
        )}
      </div>
      <div className="pd-stack">
        <ObjectivesPanel registrationId={d.registrationId} objectives={d.objectives} readOnly={!canEdit} />
        <RoutinesPanel registrationId={d.registrationId} routines={d.routines} exercises={exercises} readOnly={!canEdit} />
      </div>
    </div>
  );

  /* Fiche remplie par le parent */
  const fiche = d.sheet ? (
    <div className="pd-card">
      <p className="pd-card__label">Remplie par le parent{d.sheet.updatedAt ? ` · mise à jour le ${shortDay(d.sheet.updatedAt)}` : ""}</p>
      <dl className="pd-dl pd-dl--two">
        {SHEET_FIELDS.map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd style={{ color: d.sheet!.answers[f.key] ? undefined : "var(--adm-text-3)" }}>{d.sheet!.answers[f.key] ?? "Pas de réponse"}</dd>
          </div>
        ))}
      </dl>
    </div>
  ) : (
    <Empty>Le parent n&apos;a pas encore rempli la fiche de sa fille (espace famille, « Sa fiche »). Elle apparaîtra ici et dans le briefing.</Empty>
  );

  /* Blessures */
  const blessures = (
    <div className="pd-stack">
      {d.incidents.length ? (
        d.incidents.map((i) => (
          <article key={i.id} className="pd-report">
            <div className="pd-report__head">
              <div>
                <p className="pd-report__title">{kindLabel(i.kind)}{i.bodyPart ? ` · ${i.bodyPart}` : ""}</p>
                <p className="pd-report__meta">{i.activityDate ? longDay(i.activityDate) : shortDay(i.createdAt.slice(0, 10))}{i.activityLabel ? ` · ${i.activityLabel}` : ""}{i.reportedBy ? ` · signalée par ${i.reportedBy}` : ""}</p>
              </div>
              <span className="pd-badge" data-tone={i.status === "fermee" ? "good" : i.status === "ouverte" ? "bad" : "warn"}>{statusLabel(i.status)}</span>
            </div>
            <dl className="pd-dl pd-dl--two" style={{ marginTop: 12 }}>
              <div><dt>Ce qui s&apos;est passé</dt><dd>{i.description}</dd></div>
              {i.firstAid ? <div><dt>Premiers soins</dt><dd>{i.firstAid}</dd></div> : null}
              <div><dt>Sur place</dt><dd>{i.stoppedPlaying ? "Elle a arrêté de jouer." : "Elle a continué à jouer."} {i.parentNotified ? "Parent avisé." : "Parent pas encore avisé."}</dd></div>
              {i.followUp ? <div><dt>Suivi</dt><dd>{i.followUp}</dd></div> : null}
              {i.returnOn ? <div><dt>Retour au jeu</dt><dd>{longDay(i.returnOn)}</dd></div> : null}
            </dl>
          </article>
        ))
      ) : (
        <Empty>Aucune blessure signalée. Une blessure se signale depuis la page de la pratique (étape « Pendant »).</Empty>
      )}
      <p className="pd-note">{HEAD_KNOCK_RULE}</p>
    </div>
  );

  /* Ce que voit la famille */
  const famille = (
    <div className="pd-stack">
      <p className="pd-note">
        <Eye size={14} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
        Aperçu fidèle de l&apos;onglet Progression de sa famille, en lecture seulement : vidéos d&apos;étape, passeport, puis le bulletin flou jusqu&apos;à sa date de remise. Jamais les notes internes.
      </p>
      <div className="pd-preview">
        <div className="pd-preview__inner" inert>
          {d.familyVideos ? <FamilyProgressVideos firstName={d.firstName} checkpoints={d.familyVideos.checkpoints} videos={d.familyVideos.videos} photoUrl={d.photoUrl} /> : null}
          {d.parcours ? <FamilyPassport registrationId={d.registrationId} firstName={d.firstName} photoUrl={d.photoUrl} data={d.parcours} /> : null}
          {d.familyBulletin ? <BulletinReport data={{ ...d.familyBulletin, player: { ...d.familyBulletin.player, photoUrl: d.photoUrl } }} audience="equipe" /> : <p className="pd-empty">Pas encore de bulletin.</p>}
        </div>
      </div>
    </div>
  );

  /* Bulletin en construction */
  let bulletin: React.ReactNode = <Empty>Le bulletin n&apos;a pas pu être préparé.</Empty>;
  let bulletinCount: number | null = null;
  if (d.bulletin) {
    const b = d.bulletin;
    const daysLeft = Math.round((Date.parse(`${b.range.to}T12:00:00Z`) - Date.parse(`${now}T12:00:00Z`)) / 86_400_000);
    const checks = bulletinChecklist({
      criteria: b.summary.criteria.map((c) => ({ label: c.label, count: c.count })),
      wellbeingAnswers: Math.max(0, ...b.summary.wellbeing.map((w) => w.count)),
      attendanceTotal: b.summary.attendance.total,
      practicesEvaluated: b.summary.evaluated,
      coaches: b.summary.coaches,
      objectives: b.objectives.length,
      familyComments: b.familyComments.length,
      captainTimes: b.summary.leadership.times,
      checkpointVideo: d.videos ? d.videos.videos.some((v) => v.checkpoint === "mi") : null,
      firstName: d.firstName,
      daysLeft
    });
    const prog = bulletinProgress(checks);
    bulletinCount = prog.total - prog.done || null;
    bulletin = (
      <div className="pd-cols">
        <div style={{ minWidth: 0 }}>
          <BulletinReport data={{ ...b, player: { ...b.player, photoUrl: d.photoUrl } }} />
        </div>
        <div className="pd-stack pd-sticky">
          <div className="pd-card">
            <p className="pd-card__label">{b.range.label} · remis le {shortDay(b.range.to)}</p>
            <p style={{ margin: 0, fontSize: "1.4rem", fontWeight: 600, color: "var(--adm-text)", fontVariantNumeric: "tabular-nums" }}>
              {prog.done} sur {prog.total} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--adm-text-3)" }}>éléments prêts</span>
            </p>
            <div className="pd-bar"><div style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} /></div>
            <ul className="pd-checks">
              {checks.map((c) => (
                <li key={c.label} data-done={c.done || undefined}>
                  <i aria-hidden />
                  <div>
                    <strong>{c.label}</strong>
                    <span>{c.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {b.notes.length ? (
            <div className="pd-card">
              <p className="pd-card__label">Notes de l&apos;équipe (internes) · {b.notes.length}</p>
              <p className="pd-note">Pour t&apos;aider à écrire le mot pour la famille ; elles ne sont jamais montrées aux parents.</p>
            </div>
          ) : null}
          <Link href={`/entraineur/joueuses/${d.registrationId}/bulletin`} className="pd-btn pd-btn--primary" style={{ justifyContent: "center" }}>
            <ClipboardList size={16} aria-hidden /> {canEdit ? "Ouvrir le bulletin et écrire le mot" : "Ouvrir le bulletin"}
          </Link>
        </div>
      </div>
    );
  }

  const tabs: DossierTab[] = [
    { key: "resume", label: "Résumé", content: resume },
    { key: "rapports", label: "Rapports des éducateurs", count: d.reports.length, content: rapports },
    { key: "sondages", label: "Sondages", count: stats.answers, content: sondages },
    { key: "matchs", label: "Matchs", count: d.matchEvals.length + d.matchVideos.length, content: matchs },
    { key: "videos", label: "Vidéos de progression", count: allVideos.length, content: videos },
    { key: "passeport", label: "Passeport et objectifs", count: d.objectives.length, content: passeport },
    { key: "fiche", label: "Fiche du parent", content: fiche },
    { key: "blessures", label: "Blessures", count: openIncidents.length || d.incidents.length, tone: openIncidents.length ? "bad" : undefined, content: blessures },
    { key: "famille", label: "Ce que voit la famille", content: famille },
    { key: "bulletin", label: "Bulletin en construction", count: bulletinCount, tone: bulletinCount ? "warn" : undefined, content: bulletin }
  ];

  return (
    <>
      <p className="coach-eyebrow">
        <Link href="/entraineur/joueuses" style={{ color: "inherit" }}>Joueuses</Link> · Dossier
      </p>
      <header className="pd-head">
        <div className="pd-id">
          {d.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="pd-avatar" src={d.photoUrl} alt="" />
          ) : (
            <span className="pd-avatar" aria-hidden>{d.firstName.charAt(0)}{d.lastName.charAt(0)}</span>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 className="pd-name">{name}</h1>
            <p className="pd-sub">{groupLine}</p>
            {openIncidents.length ? (
              <div className="pd-badges" style={{ marginTop: 8 }}>
                <span className="pd-badge" data-tone="bad">Blessure en cours</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="pd-kpis">
          <div className="pd-kpi"><strong>{rate === null ? "—" : rate}<small>{rate === null ? "" : "%"}</small></strong><span>présence ({present}/{practices.length})</span></div>
          <div className="pd-kpi"><strong>{num(avgOverall)}<small>/5</small></strong><span>{d.reports.length} pratique{d.reports.length > 1 ? "s" : ""} évaluée{d.reports.length > 1 ? "s" : ""}</span></div>
          <div className="pd-kpi"><strong>{num(stats.pleasure)}<small>/10</small></strong><span>plaisir ({stats.answers} sondage{stats.answers > 1 ? "s" : ""})</span></div>
          <div className="pd-kpi"><strong>{d.points?.earned ?? 0}</strong><span>points Valkyria</span></div>
          <div className="pd-kpi"><strong>{d.titles.length}</strong><span>titres de championne</span></div>
        </div>
      </header>
      <DossierTabs tabs={tabs} />
    </>
  );
}
